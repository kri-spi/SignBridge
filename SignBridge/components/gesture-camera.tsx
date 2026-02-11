import { useEffect, useRef, useState, useCallback } from "react";
import { StyleSheet, Text, View, Animated, Easing } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Svg, { Circle, Line } from "react-native-svg";

import { useSignRecognition } from "../hooks/useSignRecognition";

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

type GestureCameraProps = {
  onStatusChange?: (status: ConnectionStatus) => void;
};

// MediaPipe hand landmark connections for drawing skeleton
const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index finger
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle finger
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring finger
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm
  [5, 9],
  [9, 13],
  [13, 17],
];

export default function GestureCamera({ onStatusChange }: GestureCameraProps) {
  const [permission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, currentSign, confidence, landmarks, sendFrame, isSending } =
    useSignRecognition();

  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const isMountedRef = useRef(true);

  // ✅ Sending animation
  const sendingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    if (isSending) {
      sendingAnim.setValue(0);
      loop = Animated.loop(
        Animated.timing(sendingAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        })
      );
      loop.start();
    } else {
      sendingAnim.stopAnimation();
      sendingAnim.setValue(0);
    }

    return () => {
      loop?.stop();
    };
  }, [isSending, sendingAnim]);

  const dot1 = sendingAnim.interpolate({
    inputRange: [0, 0.33, 1],
    outputRange: [0.2, 1, 0.2],
  });
  const dot2 = sendingAnim.interpolate({
    inputRange: [0, 0.66, 1],
    outputRange: [0.2, 1, 0.2],
  });
  const dot3 = sendingAnim.interpolate({
    inputRange: [0, 0.99, 1],
    outputRange: [0.2, 1, 0.2],
  });

  const handleCameraReady = useCallback(() => {
    // Add a short delay to ensure the video stream has real frames
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsCameraReady(true);
      }
    }, 500);
  }, []);

  // Capture frames at ~6–7 fps
  const captureFrame = useCallback(async () => {
    if (!cameraRef.current || !isMountedRef.current || !isCameraReady) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
        skipProcessing: true,
      });

      if (photo?.base64 && isMountedRef.current) {
        sendFrame(photo.base64, photo.width, photo.height);
      }
    } catch (error) {
      // Common during camera startup: skip quietly
      if (
        error instanceof Error &&
        error.message?.toLowerCase().includes("enough camera data")
      ) {
        return;
      }

      // Silently ignore camera unmount errors during cleanup
      if (error instanceof Error && !error.message?.includes("unmounted")) {
        console.error("Failed to capture frame:", error);
      }
    }
  }, [isCameraReady, sendFrame]);

  // Start/stop frame capture
  useEffect(() => {
    if (isCapturing && status === "connected" && isCameraReady) {
      frameIntervalRef.current = setInterval(captureFrame, 150); // ~6.6 fps
    } else {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    }

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isCapturing, status, isCameraReady, captureFrame]);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onStatusChange?.(status as ConnectionStatus);
  }, [status, onStatusChange]);

  // Auto-start capture when permissions are granted
  useEffect(() => {
    if (permission?.granted) {
      setIsCapturing(true);
    }
  }, [permission?.granted]);

  if (!permission) {
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.fallbackText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.cameraContainer}>
        <Text style={styles.fallbackTitle}>Camera permission required</Text>
        <Text style={styles.fallbackText}>
          Allow camera access to recognize sign language gestures.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={handleCameraReady}
        />

        {/* ✅ Sending overlay */}
        {isSending && (
          <View style={styles.sendingWrap}>
            <View style={styles.sendingPill}>
              <Text style={styles.sendingText}>Sending</Text>
              <Animated.Text style={[styles.sendingDot, { opacity: dot1 }]}>
                .
              </Animated.Text>
              <Animated.Text style={[styles.sendingDot, { opacity: dot2 }]}>
                .
              </Animated.Text>
              <Animated.Text style={[styles.sendingDot, { opacity: dot3 }]}>
                .
              </Animated.Text>
            </View>
          </View>
        )}

        {/* Hand landmarks visualization */}
        {landmarks.length > 0 && (
          <Svg
            style={StyleSheet.absoluteFill}
            viewBox="0 0 1 1"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Hand connections */}
            {HAND_CONNECTIONS.map(([start, end], idx) => (
              <Line
                key={`line-${idx}`}
                x1={landmarks[start].y}
                y1={1 - landmarks[start].x}
                x2={landmarks[end].y}
                y2={1 - landmarks[end].x}
                stroke="#3b82f6"
                strokeWidth="0.002"
                opacity={0.8}
              />
            ))}

            {/* Landmarks */}
            {landmarks.map((landmark, idx) => (
              <Circle
                key={`point-${idx}`}
                cx={landmark.y}
                cy={1 - landmark.x}
                r="0.005"
                fill={
                  idx === 0
                    ? "#ef4444"
                    : idx === 4 ||
                      idx === 8 ||
                      idx === 12 ||
                      idx === 16 ||
                      idx === 20
                    ? "#10b981"
                    : "#3b82f6"
                }
                opacity={0.9}
              />
            ))}
          </Svg>
        )}

        {/* Overlay with current prediction */}
        <View style={styles.overlay}>
          <View style={styles.predictionBox}>
            <Text style={styles.signText}>
              {currentSign === "NONE" ? "—" : currentSign.replace("_", " ")}
            </Text>
            {currentSign !== "NONE" && (
              <Text style={styles.confidenceText}>
                {(confidence * 100).toFixed(0)}%
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    width: "100%",
  },
  cameraWrap: {
    flex: 1,
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#141824",
    position: "relative",
  },

  // ✅ NEW
  sendingWrap: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  sendingPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(10, 12, 16, 0.9)",
    borderWidth: 1,
    borderColor: "#2a2f3a",
  },
  sendingText: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  sendingDot: {
    color: "#f5f7fb",
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 1,
  },

  fallbackTitle: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "600",
  },
  fallbackText: {
    color: "#9aa1ad",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
  },
  predictionBox: {
    backgroundColor: "rgba(10, 12, 16, 0.85)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2f3a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signText: {
    color: "#f5f7fb",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.2,
    flex: 1,
  },
  confidenceText: {
    color: "#8fc1ff",
    fontSize: 14,
    fontWeight: "500",
  },
});
