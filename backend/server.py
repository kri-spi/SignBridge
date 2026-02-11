import asyncio
import base64
import json
import time
from io import BytesIO
from typing import Optional
from collections import deque
import os

import numpy as np
from PIL import Image
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import mediapipe as mp
from vosk import Model, KaldiRecognizer

# =========================
# Base Paths
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

HAND_MODEL_PATH = os.path.join(BASE_DIR, "hand_landmarker.task")
VOSK_MODEL_PATH = os.path.join(BASE_DIR, "vosk-model-small-en-us-0.15")

# =========================
# MediaPipe Hand Landmarker
# =========================
BaseOptions = mp.tasks.BaseOptions
HandLandmarker = mp.tasks.vision.HandLandmarker
HandLandmarkerOptions = mp.tasks.vision.HandLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

# Ensure model exists (download if missing)
if not os.path.exists(HAND_MODEL_PATH):
    import urllib.request

    print("Downloading MediaPipe hand model...")
    urllib.request.urlretrieve(
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        HAND_MODEL_PATH,
    )

options = HandLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=HAND_MODEL_PATH),
    running_mode=VisionRunningMode.IMAGE,
    num_hands=1,
    # Lowered thresholds improve detection robustness in real usage
    min_hand_detection_confidence=0.3,
    min_hand_presence_confidence=0.3,
    min_tracking_confidence=0.3,
)

try:
    landmarker = HandLandmarker.create_from_options(options)
    print("✅ MediaPipe hand landmarker loaded successfully")
except Exception as e:
    # Retry once: redownload into the correct path and load again
    print(f"Warning: Could not load MediaPipe model: {e}")
    print("Re-downloading model file...")
    import urllib.request

    url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
    urllib.request.urlretrieve(url, HAND_MODEL_PATH)
    landmarker = HandLandmarker.create_from_options(options)
    print("✅ MediaPipe hand landmarker loaded successfully")

# =========================
# Vosk Speech Recognition
# =========================
if not os.path.isdir(VOSK_MODEL_PATH):
    raise RuntimeError(f"Vosk model not found at: {VOSK_MODEL_PATH}")

print("Loading Vosk model from:", VOSK_MODEL_PATH)
vosk_model = Model(VOSK_MODEL_PATH)


class SpeechRecognizer:
    def __init__(self, sample_rate=16000):
        self.recognizer = KaldiRecognizer(vosk_model, sample_rate)
        self.recognizer.SetWords(True)

    def accept_audio(self, pcm_bytes: bytes) -> dict:
        if not pcm_bytes:
            return {"type": "speech", "final": False, "text": ""}

        if self.recognizer.AcceptWaveform(pcm_bytes):
            result = json.loads(self.recognizer.Result())
            return {"type": "speech", "final": True, "text": result.get("text", "")}
        else:
            partial = json.loads(self.recognizer.PartialResult()).get("partial", "")
            return {"type": "speech", "final": False, "text": partial}


# =========================
# Sign Recognition Logic
# =========================
KEYWORDS = [
    "HELLO",
    "THANK_YOU",
    "YES",
    "NO",
    "HELP",
    "PLEASE",
    "SORRY",
    "STOP",
    "WHERE",
    "WATER",
    "NONE",
]


class SignRecognizer:
    def __init__(self):
        self.prediction_window = deque(maxlen=10)
        self.last_commit_time = 0
        self.last_committed_token = None
        self.stable_start = None

    def extract_features(self, landmarks) -> Optional[np.ndarray]:
        if not landmarks:
            return None

        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
        points -= points[0]

        palm_size = np.linalg.norm(points[9] - points[0])
        if palm_size > 0:
            points /= palm_size

        features = points.flatten()

        palm_center = np.mean(points[[0, 5, 17]], axis=0)
        fingertips = [4, 8, 12, 16, 20]
        for tip in fingertips:
            features = np.append(features, np.linalg.norm(points[tip] - palm_center))

        return features

    def classify(self, features):
        if features is None:
            return "NONE", 0.0

        avg_distance = float(np.mean(features[-5:]))

        if avg_distance < 0.3:
            return "STOP", 0.85
        elif avg_distance < 0.5:
            return "HELLO", 0.82
        elif avg_distance < 0.7:
            return "YES", 0.78
        else:
            return "NONE", 0.9

    def smooth_prediction(self, token, confidence):
        now = int(time.monotonic() * 1000)
        self.prediction_window.append((token, float(confidence)))

        from collections import Counter

        dominant, count = Counter(t for t, _ in self.prediction_window).most_common(1)[0]
        stability = count / len(self.prediction_window)
        avg_conf = float(np.mean([c for t, c in self.prediction_window if t == dominant]))

        is_stable = stability >= 0.7 and avg_conf >= 0.75 and dominant != "NONE"

        if is_stable:
            self.stable_start = self.stable_start or now
            stable_ms = now - self.stable_start
        else:
            self.stable_start = None
            stable_ms = 0

        commit = False
        if is_stable and stable_ms >= 400:
            if now - self.last_commit_time >= 1000:
                if dominant != self.last_committed_token:
                    commit = True
                    self.last_commit_time = now
                    self.last_committed_token = dominant

        return {
            "type": "prediction",
            "token": dominant,
            "confidence": avg_conf,
            "stable_ms": stable_ms,
            "commit": commit,
            "ts": now,
        }


# =========================
# FastAPI App
# =========================
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sign_recognizer = SignRecognizer()
frame_count = 0

# Toggle this to reduce spam while debugging
DEBUG_FRAMES = True


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print("✅ Client connected")

    global frame_count
    speech_recognizer = SpeechRecognizer()

    try:
        while True:
            message = json.loads(await ws.receive_text())
            msg_type = message.get("type")

            if msg_type == "frame":
                frame_count += 1

                # Decode base64 image into PIL
                image_data = base64.b64decode(message["image_b64"])
                pil_image = Image.open(BytesIO(image_data))

                # Ensure RGB
                if pil_image.mode != "RGB":
                    pil_image = pil_image.convert("RGB")

                image_np = np.array(pil_image, dtype=np.uint8)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_np)

                if DEBUG_FRAMES and frame_count % 15 == 0:
                    print(
                        f"📸 Frame {frame_count}: size={pil_image.size}, np={image_np.shape}, dtype={image_np.dtype}"
                    )

                # Run detection in executor to avoid blocking the event loop
                loop = asyncio.get_event_loop()
                results = await loop.run_in_executor(None, landmarker.detect, mp_image)

                if results.hand_landmarks:
                    landmarks = results.hand_landmarks[0]
                    features = sign_recognizer.extract_features(landmarks)
                    token, conf = sign_recognizer.classify(features)
                    landmarks_out = [{"x": l.x, "y": l.y, "z": l.z} for l in landmarks]

                    if DEBUG_FRAMES and frame_count % 15 == 0:
                        print(f"   🤚 Detected hand → {token} ({conf:.2f})")
                else:
                    token, conf, landmarks_out = "NONE", 0.0, []
                    if DEBUG_FRAMES and frame_count % 30 == 0:
                        print("   ❌ No hand detected")

                prediction = sign_recognizer.smooth_prediction(token, conf)
                prediction["landmarks"] = landmarks_out
                await ws.send_text(json.dumps(prediction))

            elif msg_type == "audio":
                audio_bytes = base64.b64decode(message["audio_b64"])
                result = speech_recognizer.accept_audio(audio_bytes)
                await ws.send_text(json.dumps(result))

            else:
                print("Unknown message type received:", msg_type)

    except WebSocketDisconnect:
        print("❌ Client disconnected")
    except Exception as e:
        print(f"❌ Error in websocket loop: {e}")
        import traceback

        traceback.print_exc()
        try:
            await ws.close()
        except Exception:
            pass


@app.get("/")
async def root():
    return {"message": "SignBridge Backend API", "keywords": KEYWORDS}


if __name__ == "__main__":
    import uvicorn

    print("🚀 Starting SignBridge backend server...")
    print("📋 Keywords:", KEYWORDS)
    uvicorn.run(app, host="0.0.0.0", port=8000)
