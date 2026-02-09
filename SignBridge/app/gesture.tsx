import { useEffect } from "react";
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Camera, useCameraDevice, useCameraPermission } from "react-native-vision-camera";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";

import { useGestureText } from "../contexts/gesture-text";

const samplePhrases = [
  "Hello, how are you",
  "I need help",
  "Please repeat that",
  "Thank you",
  "I will call you back",
];

export default function GestureScreen() {
  const device = useCameraDevice("front");
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const { appendText } = useGestureText();

  // Auto-request camera permission on mount if on mobile
  useEffect(() => {
    if (Platform.OS !== "web" && !hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleCapture = () => {
    const phrase =
      samplePhrases[Math.floor(Math.random() * samplePhrases.length)];
    appendText(phrase);
    router.back();
  };

  const hasCamera = Boolean(device) && hasPermission && Platform.OS !== "web";

  return (
    <View style={styles.stage}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Gesture input</Text>
          <Text style={styles.subtitle}>Sign toward the front camera.</Text>
        </View>

        <View style={styles.cameraWrap}>
          {hasCamera ? (
            <Camera
              style={styles.camera}
              device={device}
              isActive={isFocused}
            />
          ) : (
            <View style={styles.cameraFallback}>
              <Text style={styles.fallbackTitle}>Camera unavailable</Text>
              <Text style={styles.fallbackText}>
                {Platform.OS === "web"
                  ? "Gesture capture is not supported on web."
                  : "Enable camera access to start gesture capture."}
              </Text>
              {!hasPermission && Platform.OS !== "web" && (
                <Pressable
                  style={styles.permissionButton}
                  onPress={requestPermission}
                >
                  <Text style={styles.permissionButtonText}>Allow camera</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.captureButton} onPress={handleCapture}>
            <Text style={styles.captureButtonText}>Capture gesture</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Back to call</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Recognition is stubbed for now and inserts a sample phrase.
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
  },
  camera: {
    flex: 1,
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
