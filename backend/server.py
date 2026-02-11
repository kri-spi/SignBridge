import asyncio
import base64
import json
import time
from io import BytesIO
from typing import Optional
from collections import deque
import os
import subprocess
import tempfile

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
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)

landmarker = HandLandmarker.create_from_options(options)

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
        
    def transcribe_pcm_with_words(self, pcm_bytes: bytes) -> dict:
        """
        Feed ALL PCM bytes and return final result including word timestamps.
        """
        # Reset recognizer state by creating a new one (simplest / safest)
        r = KaldiRecognizer(vosk_model, 16000)
        r.SetWords(True)

        chunk_size = 4000  # bytes; can be tuned
        for i in range(0, len(pcm_bytes), chunk_size):
            r.AcceptWaveform(pcm_bytes[i:i + chunk_size])

        final = json.loads(r.FinalResult())
        # Vosk final result typically: {"text":"...", "result":[{"word":"...", "start":0.12,"end":0.52,"conf":...}, ...]}
        words = final.get("result", [])
        return {"type": "audio_file_transcript", "text": final.get("text", ""), "words": words}

def mp3_to_pcm16k_mono(mp3_bytes: bytes) -> bytes:
    """
    Decode MP3 bytes to raw PCM: 16kHz, mono, signed 16-bit little-endian.
    Uses ffmpeg CLI.
    """
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=True) as f_in:
        f_in.write(mp3_bytes)
        f_in.flush()

        # ffmpeg output to stdout as raw PCM
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "error",
            "-i", f_in.name,
            "-ac", "1",
            "-ar", "16000",
            "-f", "s16le",
            "pipe:1",
        ]
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg decode failed: {proc.stderr.decode('utf-8', errors='ignore')}")
        return proc.stdout


# =========================
# Sign Recognition Logic
# =========================
KEYWORDS = [
    "HELLO", "THANK_YOU", "YES", "NO", "HELP",
    "PLEASE", "SORRY", "STOP", "WHERE", "WATER", "NONE"
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

        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks])
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

        avg_distance = np.mean(features[-5:])

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
        self.prediction_window.append((token, confidence))

        from collections import Counter
        dominant, count = Counter(t for t, _ in self.prediction_window).most_common(1)[0]
        stability = count / len(self.prediction_window)
        avg_conf = np.mean(c for t, c in self.prediction_window if t == dominant)

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
            "confidence": float(avg_conf),
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


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    speech_recognizer = SpeechRecognizer()
    print("Client connected")

    try:
        while True:
            message = json.loads(await ws.receive_text())
            msg_type = message.get("type")

            if msg_type == "frame":
                image = Image.open(BytesIO(base64.b64decode(message["image_b64"])))
                mp_image = mp.Image(
                    image_format=mp.ImageFormat.SRGB,
                    data=np.array(image, dtype=np.uint8),
                )

                # Run MediaPipe detection in executor to avoid blocking
                loop = asyncio.get_event_loop()
                results = await loop.run_in_executor(None, landmarker.detect, mp_image)

                if results.hand_landmarks:
                    landmarks = results.hand_landmarks[0]
                    features = sign_recognizer.extract_features(landmarks)
                    token, conf = sign_recognizer.classify(features)
                    landmarks_out = [{"x": l.x, "y": l.y, "z": l.z} for l in landmarks]
                else:
                    token, conf, landmarks_out = "NONE", 0.0, []

                prediction = sign_recognizer.smooth_prediction(token, conf)
                prediction["landmarks"] = landmarks_out

                await ws.send_text(json.dumps(prediction))

            elif msg_type == "audio":
                audio_bytes = base64.b64decode(message["audio_b64"])
                result = speech_recognizer.accept_audio(audio_bytes)
                await ws.send_text(json.dumps(result))
                
            elif msg_type == "audio_file":
                # expects {"type":"audio_file","audio_mp3_b64":"..."}
                mp3_bytes = base64.b64decode(message["audio_mp3_b64"])
                pcm = mp3_to_pcm16k_mono(mp3_bytes)
                transcript = speech_recognizer.transcribe_pcm_with_words(pcm)
                await ws.send_text(json.dumps(transcript))

            else:
                print("Unknown message type received:", msg_type)

    except WebSocketDisconnect:
        print("Client disconnected")


@app.get("/")
async def root():
    return {"message": "SignBridge Backend API", "keywords": KEYWORDS}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
