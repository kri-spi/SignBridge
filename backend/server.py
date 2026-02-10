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

# Initialize MediaPipe Hands with new API
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Create hand landmarker
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
    print(f"Warning: Could not load MediaPipe model: {e}")
    print("Downloading model file...")
    import urllib.request
    url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    urllib.request.urlretrieve(url, "hand_landmarker.task")
    landmarker = HandLandmarker.create_from_options(options)

# Keywords we're recognizing
KEYWORDS = [
    "HELLO", "THANK_YOU", "YES", "NO", "HELP",
    "PLEASE", "SORRY", "STOP", "WHERE", "WATER", "NONE"
]

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SignRecognizer:
    """Simple prototype-based sign language recognizer"""
    
    def __init__(self):
        self.prediction_window = deque(maxlen=10)  # Last 10 predictions
        self.last_commit_time = 0
        self.last_committed_token = None
        self.stable_start = None
        
    def extract_features(self, landmarks) -> Optional[np.ndarray]:
        """Extract normalized features from hand landmarks"""
        if not landmarks:
            return None
            
        # Convert to numpy array
        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks])
        
        # Normalize: translate to wrist (landmark 0)
        wrist = points[0]
        points = points - wrist
        
        # Scale by palm size (distance from wrist to middle finger MCP)
        palm_size = np.linalg.norm(points[9] - points[0])
        if palm_size > 0:
            points = points / palm_size
        
        # Flatten to feature vector
        features = points.flatten()
        
        # Add some geometric features
        # Distance from each fingertip to palm center
        palm_center = np.mean(points[[0, 5, 17]], axis=0)
        fingertips = [4, 8, 12, 16, 20]
        for tip in fingertips:
            dist = np.linalg.norm(points[tip] - palm_center)
            features = np.append(features, dist)
        
        return features
    
    def classify(self, features: np.ndarray) -> tuple[str, float]:
        """
        Classify features into a keyword.
        For demo purposes, this uses simple heuristics.
        In production, use trained prototypes or a small MLP.
        """
        if features is None:
            return "NONE", 0.0
        
        # Demo: random classification based on hand pose features
        # In reality, you'd compare against stored prototypes
        # or use a trained classifier
        
        # For now, use simple heuristics based on fingertip distances
        tip_distances = features[-5:]  # Last 5 features are fingertip distances
        
        # Example heuristic rules (replace with real classifier)
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
        """Apply temporal smoothing and commit logic"""
        current_time = time.time() * 1000  # milliseconds
        
        # Add to window
        self.prediction_window.append((token, confidence))
        
        # Count occurrences in window
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
        
        # Most common token
        from collections import Counter
        token_counts = Counter(window_tokens)
        dominant_token, count = token_counts.most_common(1)[0]
        
        # Calculate stability
        stability_ratio = count / len(window_tokens)
        avg_confidence = np.mean([c for t, c in self.prediction_window if t == dominant_token])
        
        # Check if stable
        is_stable = (
            stability_ratio >= 0.7 and
            avg_confidence >= 0.75 and
            dominant_token != "NONE"
        )
        
        # Track stability time
        if is_stable:
            if self.stable_start is None:
                self.stable_start = current_time
            stable_ms = current_time - self.stable_start
        else:
            self.stable_start = None
            stable_ms = 0
        
        # Commit logic
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

recognizer = SignRecognizer()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected")
    
    try:
        while True:
            # Receive frame from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "frame":
                # Decode base64 image
                image_data = base64.b64decode(message["image_b64"])
                image = Image.open(BytesIO(image_data))
                
                # Convert to OpenCV format
                frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
                
                # Process with MediaPipe (new API)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(image))
                results = landmarker.detect(mp_image)
                
                # Extract features and classify
                if results.hand_landmarks and len(results.hand_landmarks) > 0:
                    landmarks = results.hand_landmarks[0]
                    features = recognizer.extract_features(landmarks)
                    token, confidence = recognizer.classify(features)
                else:
                    token, confidence = "NONE", 0.0
                
                # Apply smoothing and get prediction
                prediction = recognizer.smooth_prediction(token, confidence)
                
                # Send back to client
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
