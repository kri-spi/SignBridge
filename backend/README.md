# SignBridge Backend - MediaPipe Sign Language Recognition

Python backend for real-time sign language keyword spotting using MediaPipe Hands.

## Status (what's done so far)

- WebSocket server accepts base64 JPEG frames at `/ws`
- MediaPipe Tasks Hand Landmarker runs on each frame
- Landmarks are normalized into feature vectors
- Simple heuristic classifier outputs `token` + `confidence`
- Temporal smoothing + commit logic stabilizes predictions
- Server responds with prediction payloads to the client

Note: The classifier is a placeholder and should be replaced with a prototype-based or trained model.

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Run

```bash
python server.py
```

Server will start on `ws://localhost:8000/ws`

If you see a missing model error, download the MediaPipe model file once:

```bash
curl -L -o hand_landmarker.task https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
```

## Keywords

Currently recognizes 10 keywords:
- HELLO
- THANK_YOU
- YES
- NO
- HELP
- PLEASE
- SORRY
- STOP
- WHERE
- WATER

Plus `NONE` for no gesture detected.

## How it works

1. Client sends base64-encoded frames via WebSocket
2. MediaPipe Hands extracts 21 landmarks per hand
3. Features are normalized and classified
4. Temporal smoothing ensures stable predictions
5. Server returns predictions with confidence scores
