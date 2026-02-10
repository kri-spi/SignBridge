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

## Handoff: next steps for a teammate

### 1) Verify the backend is running

```bash
cd backend
source venv/bin/activate
python server.py
```

Confirm the console shows the server listening on port 8000.

### 2) Replace the heuristic classifier with prototypes

In `server.py`, update `SignRecognizer.classify()` to use prototype vectors:

- Collect ~20–30 examples per keyword (frames → landmarks → features)
- Store a mean feature vector per keyword
- At runtime, compute cosine similarity or L2 distance
- Choose the closest prototype; map distance to confidence

Suggested structure:

```python
# pseudo
prototypes = {"HELLO": vec1, "THANK_YOU": vec2, ...}
token = argmin_distance(features, prototypes)
confidence = distance_to_confidence(...)
```

### 3) Add a data collection script (optional but recommended)

Create a small script that:

- Reads saved images or streams frames
- Extracts features with the same `extract_features()`
- Saves feature vectors + labels to disk (e.g., `.npz` or `.json`)

### 4) Tune smoothing parameters

Look in `smooth_prediction()` and adjust:

- window size (`deque(maxlen=10)`)
- stability threshold (`>= 0.7`)
- confidence threshold (`>= 0.75`)
- stable duration (`>= 400ms`)
- cooldown (`>= 1000ms`)

### 5) Confirm end-to-end flow with the Expo client

- Start server
- Run Expo app
- Open gesture screen and start recognition
- Verify predictions arrive and commit to transcript
