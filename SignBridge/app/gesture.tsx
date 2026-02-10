import { useEffect, useRef, useState, useCallback } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import Svg, { Circle, Line } from "react-native-svg";

import { useGestureText } from "../contexts/gesture-text";
import { useSignRecognition } from "../hooks/useSignRecognition";

// Keywords we're recognizing
const KEYWORDS = [
  "HELLO", "THANK_YOU", "YES", "NO", "HELP", 
  "PLEASE", "SORRY", "STOP", "WHERE", "WATER"
];

// MediaPipe hand landmark connections for drawing skeleton
const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm
  [5, 9], [9, 13], [13, 17]
];

export default function GestureScreen() {
  const { appendText } = useGestureText();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCommittedRef = useRef<string>("");

  const { status, currentSign, confidence, stabilityMs, landmarks, sendFrame } = useSignRecognition();

  const [isCapturing, setIsCapturing] = useState(false);
  const isMountedRef = useRef(true);

  // Capture frames at 5-8 fps (every 150-200ms)
  const captureFrame = useCallback(async () => {
    if (!cameraRef.current || !isMountedRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
        skipProcessing: true,
      });

      if (photo?.base64 && isMountedRef.current) {
        // Send to backend
        sendFrame(photo.base64, photo.width, photo.height);
      }
    } catch (error) {
      // Silently ignore camera unmount errors during cleanup
      if (error instanceof Error && !error.message?.includes("unmounted")) {
        console.error("Failed to capture frame:", error);
      }
    }
  }, [sendFrame]);

  // Start/stop frame capture
  useEffect(() => {
    if (isCapturing && status === "connected") {
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
  }, [isCapturing, status, captureFrame]);

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Handle committed predictions
  useEffect(() => {
    if (currentSign !== "NONE" && currentSign !== lastCommittedRef.current && confidence > 0.8) {
      appendText(currentSign.toLowerCase().replace("_", " "));
      lastCommittedRef.current = currentSign;
      
      // Reset after cooldown
      setTimeout(() => {
        lastCommittedRef.current = "";
      }, 1000);
    }
  }, [currentSign, confidence, appendText]);

  const toggleCapture = () => {
    setIsCapturing(!isCapturing);
  };

  if (!permission) {
    return (
      <View style={styles.stage}>
        <SafeAreaView style={styles.screen}>
          <Text style={styles.fallbackText}>Loading camera...</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.stage}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.cameraFallback}>
            <Text style={styles.fallbackTitle}>Camera permission required</Text>
            <Text style={styles.fallbackText}>
              Allow camera access to recognize sign language gestures.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestPermission}>
              <Text style={styles.permissionButtonText}>Grant permission</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.stage}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Sign Language Recognition</Text>
          <Text style={styles.subtitle}>
            {status === "connected" ? "Connected to server" : `Status: ${status}`}
          </Text>
        </View>

        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          />
          
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
                  fill={idx === 0 ? "#ef4444" : idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20 ? "#10b981" : "#3b82f6"}
                  opacity={0.9}
                />
              ))}
            </Svg>
          )}
          
          {/* Overlay with current prediction */}
          <View style={styles.overlay}>
            <View style={styles.predictionBox}>
              <Text style={styles.signLabel}>Current sign:</Text>
              <Text style={styles.signText}>
                {currentSign === "NONE" ? "—" : currentSign.replace("_", " ")}
              </Text>
              <Text style={styles.confidenceText}>
                {currentSign !== "NONE" && `${(confidence * 100).toFixed(0)}% confident`}
              </Text>
            </View>

            {/* Stability bar */}
            {stabilityMs > 0 && currentSign !== "NONE" && (
              <View style={styles.stabilityBar}>
                <View 
                  style={[
                    styles.stabilityFill, 
                    { width: `${Math.min((stabilityMs / 400) * 100, 100)}%` }
                  ]} 
                />
              </View>
            )}
          </View>
        </View>

        {/* Keywords reference */}
        <View style={styles.keywordsBox}>
          <Text style={styles.keywordsTitle}>Recognizable signs:</Text>
          <View style={styles.keywordsGrid}>
            {KEYWORDS.map((keyword) => (
              <View key={keyword} style={styles.keywordChip}>
                <Text style={styles.keywordText}>{keyword.replace("_", " ")}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable 
            style={[
              styles.captureButton, 
              isCapturing && styles.captureButtonActive,
              status !== "connected" && styles.captureButtonDisabled
            ]} 
            onPress={toggleCapture}
            disabled={status !== "connected"}
          >
            <Text style={styles.captureButtonText}>
              {isCapturing ? "⏸ Stop Recognition" : "▶ Start Recognition"}
            </Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back to call</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Live recognition with MediaPipe + keyword spotting
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: "#0a0c10",
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    color: "#f5f7fb",
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "#9aa1ad",
    fontSize: 14,
    marginTop: 6,
  },
  cameraWrap: {
    flex: 1,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#2a2f3a",
    backgroundColor: "#141824",
    position: "relative",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  predictionBox: {
    backgroundColor: "rgba(10, 12, 16, 0.85)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#2a2f3a",
  },
  signLabel: {
    color: "#9aa1ad",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  signText: {
    color: "#f5f7fb",
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  confidenceText: {
    color: "#8fc1ff",
    fontSize: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  stabilityBar: {
    height: 4,
    backgroundColor: "rgba(42, 47, 58, 0.6)",
    borderRadius: 2,
    marginTop: 12,
    overflow: "hidden",
  },
  stabilityFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  keywordsBox: {
    backgroundColor: "rgba(12, 14, 21, 0.9)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#2a2f3a",
  },
  keywordsTitle: {
    color: "#8f96a3",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  keywordsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  keywordChip: {
    backgroundColor: "#1f2433",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#2a2f3a",
  },
  keywordText: {
    color: "#c6c9d2",
    fontSize: 11,
    fontWeight: "500",
  },
  cameraFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  fallbackTitle: {
    color: "#f5f7fb",
    fontSize: 18,
    fontWeight: "600",
  },
  fallbackText: {
    color: "#9aa1ad",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  permissionButton: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#2a3247",
  },
  permissionButtonText: {
    color: "#f0f3f8",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  actions: {
    marginTop: 18,
    gap: 10,
  },
  captureButton: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonActive: {
    backgroundColor: "#ef3b2d",
  },
  captureButtonDisabled: {
    backgroundColor: "#1f2433",
    opacity: 0.5,
  },
  captureButtonText: {
    color: "#f7f9ff",
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  secondaryButton: {
    height: 46,
    borderRadius: 14,
    backgroundColor: "#1f2433",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#c6c9d2",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  disclaimer: {
    color: "#7a818e",
    fontSize: 12,
    marginTop: 14,
    textAlign: "center",
  },
});
