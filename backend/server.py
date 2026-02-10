import asyncio
import base64
import json
import time
from io import BytesIO
from typing import Optional
from collections import deque

import cv2
import numpy as np
from PIL import Image
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp

# Glossary
# - Landmark: a 3D point (x,y,z) on the hand, MediaPipe returns 21 per hand.
# - Feature vector: numeric representation of a hand pose used for classification.
# - Token: predicted keyword label (e.g., HELLO, YES) or NONE.
# - Stability: how consistently a token appears in a recent frame window.
# - Commit: a stable token emitted to the transcript after a time threshold.

# --- MediaPipe Task setup ---
# We use MediaPipe Tasks (not the older mp.solutions API) to run a hand
# landmark model from a .task file. This supports modern builds of MediaPipe.
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Create the hand landmarker with a model file on disk.
# running_mode=IMAGE is suitable for per-frame inference from the client.
options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path='hand_landmarker.task'),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5
)

try:
    landmarker = HandLandmarker.create_from_options(options)
except Exception as e:
    # If the model file isn't present yet, download it once and retry.
    print(f"Warning: Could not load MediaPipe model: {e}")
    print("Downloading model file...")
    import urllib.request
    url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    urllib.request.urlretrieve(url, "hand_landmarker.task")
    landmarker = HandLandmarker.create_from_options(options)

# Keywords the demo will output. "NONE" means no confident gesture detected.
KEYWORDS = [
    "HELLO", "THANK_YOU", "YES", "NO", "HELP",
    "PLEASE", "SORRY", "STOP", "WHERE", "WATER", "NONE"
]

# FastAPI app instance used for HTTP + WebSocket endpoints.
app = FastAPI()

# Enable CORS so the Expo client can connect without browser restrictions.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SignRecognizer:
    """
    Keeps state for smoothing and converts landmarks to predictions.
    The classifier is intentionally simple for hackathon speed.
    """
    
    def __init__(self):
        # Rolling window of recent predictions to smooth noisy outputs.
        self.prediction_window = deque(maxlen=10)
        # Used to enforce a cooldown between committed tokens.
        self.last_commit_time = 0
        # Used to avoid repeating the same token back-to-back.
        self.last_committed_token = None
        # Tracks when the current token first became stable.
        self.stable_start = None
        
    def extract_features(self, landmarks) -> Optional[np.ndarray]:
        """
        Convert 21 hand landmarks into a normalized feature vector.
        This reduces sensitivity to hand position/size and improves stability.
        """
        if not landmarks:
            return None
            
        # Convert to numpy array: shape (21, 3)
        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks])
        
        # Translate so wrist is the origin; removes dependence on absolute position.
        wrist = points[0]
        points = points - wrist
        
        # Scale by palm size; removes dependence on hand size and distance to camera.
        palm_size = np.linalg.norm(points[9] - points[0])
        if palm_size > 0:
            points = points / palm_size
        
        # Flatten to 63 values (21 points * 3 coordinates).
        features = points.flatten()
        
        # Add a few geometric features: fingertip distance to palm center.
        # This captures hand openness/shape in a compact way.
        palm_center = np.mean(points[[0, 5, 17]], axis=0)
        fingertips = [4, 8, 12, 16, 20]
        for tip in fingertips:
            dist = np.linalg.norm(points[tip] - palm_center)
            features = np.append(features, dist)
        
        return features
    
    def classify(self, features: np.ndarray) -> tuple[str, float]:
        """
        Convert features into a keyword and a confidence score.
        This is a heuristic placeholder; replace with a prototype classifier
        or a small model trained on labeled data.
        """
        if features is None:
            return "NONE", 0.0
        
        # Heuristic based on average fingertip distance to palm center.
        # Smaller distance ≈ closed hand, larger distance ≈ open hand.
        tip_distances = features[-5:]  # Last 5 features are fingertip distances
        
        # Example rules (replace with real classifier)
        avg_distance = np.mean(tip_distances)
        
        if avg_distance < 0.3:
            token = "STOP"
            confidence = 0.85
        elif avg_distance < 0.5:
            token = "HELLO"
            confidence = 0.82
        elif avg_distance < 0.7:
            token = "YES"
            confidence = 0.78
        else:
            token = "NONE"
            confidence = 0.9
        
        return token, confidence
    
    def smooth_prediction(self, token: str, confidence: float) -> dict:
        """
        Apply temporal smoothing and commit logic.
        Returns a prediction payload used by the client UI.
        """
        current_time = time.time() * 1000  # milliseconds
        
        # Add the latest prediction to the rolling window.
        self.prediction_window.append((token, confidence))
        
        # Count occurrences in the window to find the dominant token.
        window_tokens = [t for t, c in self.prediction_window]
        if len(window_tokens) == 0:
            return {
                "type": "prediction",
                "ts": int(current_time),
                "token": "NONE",
                "confidence": 0.0,
                "stable_ms": 0,
                "commit": False
            }
        
        # Most common token within the window.
        from collections import Counter
        token_counts = Counter(window_tokens)
        dominant_token, count = token_counts.most_common(1)[0]
        
        # Stability = fraction of frames that agree with dominant token.
        stability_ratio = count / len(window_tokens)
        avg_confidence = np.mean([c for t, c in self.prediction_window if t == dominant_token])
        
        # A token is considered stable if it dominates the window
        # and has sufficient confidence.
        is_stable = (
            stability_ratio >= 0.7 and
            avg_confidence >= 0.75 and
            dominant_token != "NONE"
        )
        
        # Track how long the token has remained stable.
        if is_stable:
            if self.stable_start is None:
                self.stable_start = current_time
            stable_ms = current_time - self.stable_start
        else:
            self.stable_start = None
            stable_ms = 0
        
        # Commit logic: only emit commit=True after sustained stability
        # and after a cooldown to prevent repeated tokens.
        should_commit = False
        if is_stable and stable_ms >= 400:  # 400ms threshold
            # Check cooldown
            time_since_commit = current_time - self.last_commit_time
            if time_since_commit >= 1000:  # 1 second cooldown
                if dominant_token != self.last_committed_token:
                    should_commit = True
                    self.last_commit_time = current_time
                    self.last_committed_token = dominant_token
        
        return {
            "type": "prediction",
            "ts": int(current_time),
            "token": dominant_token,
            "confidence": float(avg_confidence),
            "stable_ms": int(stable_ms),
            "commit": should_commit
        }

# Single recognizer instance keeps smoothing state across frames.
recognizer = SignRecognizer()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")
    
    try:
        while True:
            # Receive a single JSON message from the client.
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "frame":
                # Decode base64 JPEG into a PIL image.
                image_data = base64.b64decode(message["image_b64"])
                image = Image.open(BytesIO(image_data))
                
                # Convert to OpenCV format (BGR). Useful for any OpenCV ops.
                frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                
                # Run MediaPipe hand detection on the RGB image.
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(image))
                results = landmarker.detect(mp_image)
                
                # Extract features and classify if a hand is detected.
                if results.hand_landmarks and len(results.hand_landmarks) > 0:
                    landmarks = results.hand_landmarks[0]
                    features = recognizer.extract_features(landmarks)
                    token, confidence = recognizer.classify(features)
                    
                    # Convert landmarks to serializable format for visualization
                    landmarks_list = [
                        {"x": lm.x, "y": lm.y, "z": lm.z}
                        for lm in landmarks
                    ]
                else:
                    token, confidence = "NONE", 0.0
                    landmarks_list = []
                
                # Apply smoothing to stabilize predictions across frames.
                prediction = recognizer.smooth_prediction(token, confidence)
                
                # Add landmarks to response for visualization
                prediction["landmarks"] = landmarks_list
                
                # Send the prediction payload back to the client.
                await websocket.send_text(json.dumps(prediction))
                
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")
        await websocket.close()

@app.get("/")
async def root():
    return {
        "message": "SignBridge Backend API",
        "keywords": KEYWORDS,
        "websocket": "/ws"
    }

if __name__ == "__main__":
    import uvicorn
    print("Starting SignBridge backend server...")
    print("Keywords:", KEYWORDS)
    uvicorn.run(app, host="0.0.0.0", port=8000)
