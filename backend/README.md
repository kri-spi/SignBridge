# SignBridge Backend - MediaPipe Sign Language Recognition

Python backend for real-time sign language keyword spotting using MediaPipe Hands.

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
