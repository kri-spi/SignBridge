# SignBridge - Quick Start Guide

## Step 1: Backend Setup (Python Server)

### 1.1 Navigate to backend directory
```bash
cd backend
```

### 1.2 Create virtual environment
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 1.3 Install dependencies
```bash
pip install -r requirements.txt
```

### 1.4 Start the server
```bash
python server.py
```

You should see:
```
Starting SignBridge backend server...
Keywords: ['HELLO', 'THANK_YOU', 'YES', 'NO', 'HELP', 'PLEASE', 'SORRY', 'STOP', 'WHERE', 'WATER', 'NONE']
INFO:     Uvicorn running on http://0.0.0.0:8000
```

The WebSocket server is now running at `ws://localhost:8000/ws`

---

## Step 2: Frontend Setup (Expo React Native)

### 2.1 Navigate to the app directory
```bash
cd ../SignBridge  # From backend directory
```

### 2.2 Install dependencies
```bash
npm install
```

### 2.3 Create configuration file

Copy the template configuration:
```bash
cp config.ts.template config.ts
```

Then edit `config.ts` and update the `SERVER_IP` with your computer's local IP address.

**To find your IP:**
- **macOS/Linux**: `ipconfig getifaddr en0` or `ifconfig`
- **Windows**: `ipconfig` (look for IPv4 Address)

Example `config.ts`:
```typescript
export const SERVER_IP = "192.168.1.100";  // Your actual IP here
export const SERVER_PORT = 8000;
export const WS_URL = `ws://${SERVER_IP}:${SERVER_PORT}/ws`;
```

**Note**: For testing on web browser or iOS simulator, you can use `"localhost"` instead.

### 2.4 Start the Expo app
```bash
npx expo start
```

### 2.5 Open on device
- **iOS**: Scan QR code with Camera app
- **Android**: Scan QR code with Expo Go app

---

## Step 3: Test the Sign Recognition

1. **Grant camera permissions** when prompted
2. **Navigate to gesture screen** by tapping "Gesture" input mode
3. **Tap "▶ Start Recognition"** to begin capturing
4. **Make hand gestures** in front of the camera
5. **Watch the prediction** update in real-time
6. **See committed words** appear in the transcript when stable

---

## Current Status

✅ **Completed:**
- Camera capture at 5-8 fps with low-res frames (320px, 0.3 quality)
- WebSocket communication (client → server → client)
- MediaPipe Hands integration
- Feature extraction (21 landmarks normalized)
- Temporal smoothing (10 frame window, 70% threshold)
- Commit logic (400ms stability, 1s cooldown)
- Live UI with confidence and stability indicators

⏳ **Next Steps:**
- Collect training data for each keyword (20+ examples per sign)
- Implement prototype-based classifier or train MLP
- Fine-tune smoothing parameters
- Add gesture recording UI for data collection

---

## Architecture

```
┌─────────────────┐         WebSocket          ┌──────────────────┐
│  Expo RN App    │ ─────────────────────────> │  Python Backend  │
│                 │                             │                  │
│ - Camera (5fps) │   Frame (base64, 320px)    │ - MediaPipe      │
│ - WebSocket     │ ─────────────────────────> │ - Landmark ext.  │
│ - UI            │                             │ - Classifier     │
│                 │ <───────────────────────── │ - Smoothing      │
│                 │   Prediction (token+conf)   │                  │
└─────────────────┘                             └──────────────────┘
```

---

## Message Formats

### Client → Server (Frame)
```json
{
  "type": "frame",
  "ts": 1700000000000,
  "image_b64": "...base64...",
  "w": 320,
  "h": 240
}
```

### Server → Client (Prediction)
```json
{
  "type": "prediction",
  "ts": 1700000000100,
  "token": "THANK_YOU",
  "confidence": 0.92,
  "stable_ms": 420,
  "commit": true
}
```

---

## Keywords

Current keyword set (10 signs + NONE):
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

---

## Troubleshooting

### Backend won't start
- Make sure Python 3.8+ is installed
- Check all dependencies installed: `pip list`
- Check port 8000 is not in use: `lsof -i :8000`

### Frontend can't connect
- Verify backend is running and showing "Uvicorn running..."
- Check WebSocket URL matches your setup (localhost vs IP address)
- For physical devices, use your computer's local IP, not localhost
- Ensure both devices are on the same WiFi network

### Camera not working
- Grant camera permissions in device settings
- Check app.json has camera permissions configured
- Restart Expo app after granting permissions

### No predictions showing
- Check browser/server console for errors
- Verify hands are visible in camera frame
- Ensure good lighting conditions
- Check WebSocket status shows "connected"

---

## Performance Tips

- **Lighting**: Demo under bright, even lighting
- **Background**: Plain background works best
- **Distance**: Keep hand 1-2 feet from camera
- **Stability**: Hold gestures steady for 400ms to commit
- **Cooldown**: Wait 1 second between different signs

---

## Next: Data Collection

To improve accuracy, you'll need to collect training data:

1. Record 20-30 examples per keyword
2. Extract features for each frame
3. Compute prototype (mean feature vector) per keyword
4. Use cosine similarity or L2 distance for classification

The current classifier uses simple heuristics - replace with real prototypes!
