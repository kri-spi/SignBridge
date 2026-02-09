import { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import { useRouter } from "expo-router";

import { useGestureText } from "../contexts/gesture-text";

export default function Index() {
  const [inputMode, setInputMode] = useState<"speech" | "text" | "gesture">(
    "speech"
  );
  const { text, setText } = useGestureText();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const router = useRouter();

  const handleSpeak = () => {
    const value = text.trim();
    if (!value || isSpeaking) {
      return;
    }

    setIsSpeaking(true);
    Speech.speak(value, {
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  return (
    <View style={styles.stage}>
      <View style={styles.deviceFrame}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.dynamicIsland} />
          <View style={styles.backgroundGlowTop} />
          <View style={styles.backgroundGlowBottom} />

          <View style={styles.header}>
            <Text style={styles.callerName}>Morgan Lee</Text>
            <Text style={styles.callStatus}>Call in progress</Text>
            <Text style={styles.callTime}>04:28</Text>
          </View>

          <View style={styles.avatarWrap}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitials}>ML</Text>
            </View>
          </View>

          <View style={styles.inputModeCard}>
            <Text style={styles.inputModeTitle}>Input mode</Text>
            <View style={styles.inputModeRow}>
              <Pressable
                style={[
                  styles.inputModeButton,
                  inputMode === "speech" && styles.inputModeButtonActive,
                ]}
                onPress={() => setInputMode("speech")}
              >
                <Text
                  style={[
                    styles.inputModeLabel,
                    inputMode === "speech" && styles.inputModeLabelActive,
                  ]}
                >
                  Speech
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.inputModeButton,
                  inputMode === "text" && styles.inputModeButtonActive,
                ]}
                onPress={() => setInputMode("text")}
              >
                <Text
                  style={[
                    styles.inputModeLabel,
                    inputMode === "text" && styles.inputModeLabelActive,
                  ]}
                >
                  Text
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.inputModeButton,
                  inputMode === "gesture" && styles.inputModeButtonActive,
                ]}
                onPress={() => {
                  setInputMode("gesture");
                  router.push("/gesture");
                }}
              >
                <Text
                  style={[
                    styles.inputModeLabel,
                    inputMode === "gesture" && styles.inputModeLabelActive,
                  ]}
                >
                  Gesture
                </Text>
              </Pressable>
            </View>
          </View>

          {inputMode !== "speech" && (
            <View style={styles.textInputCard}>
              <Text style={styles.textInputLabel}>
                {inputMode === "gesture" ? "Gesture output" : "Type to speak"}
              </Text>
              <View style={styles.textInputRow}>
                <TextInput
                  style={styles.textInputField}
                  placeholder={
                    inputMode === "gesture"
                      ? "Waiting for gestures"
                      : "Enter message"
                  }
                  placeholderTextColor="#667085"
                  value={text}
                  onChangeText={setText}
                  returnKeyType="done"
                  onSubmitEditing={handleSpeak}
                />
                <Pressable
                  style={[
                    styles.speakButton,
                    (!text.trim() || isSpeaking) && styles.speakButtonDisabled,
                  ]}
                  onPress={handleSpeak}
                >
                  <Text style={styles.speakButtonText}>
                    {isSpeaking ? "Speaking" : "Send"}
                  </Text>
                </Pressable>
              </View>
              {inputMode === "gesture" && (
                <Pressable
                  style={styles.gestureShortcut}
                  onPress={() => router.push("/gesture")}
                >
                  <Text style={styles.gestureShortcutText}>Open gesture camera</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.controls}>
            <View style={styles.controlRow}>
              <ControlButton label="Mute" icon="MIC" />
              <ControlButton label="Keypad" icon="KEY" />
              <ControlButton label="Speaker" icon="SPK" />
            </View>
            <View style={styles.controlRow}>
              <ControlButton label="Add" icon="ADD" />
              <ControlButton label="FaceTime" icon="VID" />
              <ControlButton label="Contacts" icon="CNT" />
            </View>
          </View>

          <Pressable style={styles.endCallButton}>
            <Text style={styles.endCallText}>End Call</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </View>
  );
}

type ControlButtonProps = {
  label: string;
  icon: string;
};

function ControlButton({ label, icon }: ControlButtonProps) {
  return (
    <Pressable style={styles.controlButton}>
      <View style={styles.controlIcon}>
        <Text style={styles.controlIconText}>{icon}</Text>
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: "#0a0c10",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  deviceFrame: {
    width: 320,
    aspectRatio: 9 / 19.5,
    borderRadius: 44,
    backgroundColor: "#111317",
    borderWidth: 2,
    borderColor: "#1b1f2a",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
  },
  screen: {
    flex: 1,
    backgroundColor: "#0b0b0d",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 26,
  },
  dynamicIsland: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    width: 130,
    height: 34,
    borderRadius: 18,
    backgroundColor: "#050506",
    borderWidth: 1,
    borderColor: "#15181f",
  },
  backgroundGlowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#1b1f2a",
    opacity: 0.7,
  },
  backgroundGlowBottom: {
    position: "absolute",
    bottom: -140,
    right: -60,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#151925",
    opacity: 0.8,
  },
  header: {
    alignItems: "center",
    marginTop: 8,
  },
  callerName: {
    color: "#f5f7fb",
    fontSize: 34,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  callStatus: {
    color: "#8f96a3",
    fontSize: 16,
    marginTop: 6,
  },
  callTime: {
    color: "#c6c9d2",
    fontSize: 18,
    marginTop: 12,
    letterSpacing: 1.2,
  },
  avatarWrap: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "#2a2f3a",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18, 20, 27, 0.8)",
  },
  avatarInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#232734",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#eef1f6",
    fontSize: 44,
    fontWeight: "600",
    letterSpacing: 2,
  },
  inputModeCard: {
    width: "100%",
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2a2f3a",
    backgroundColor: "rgba(18, 20, 27, 0.85)",
  },
  inputModeTitle: {
    color: "#8f96a3",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  inputModeRow: {
    flexDirection: "row",
    backgroundColor: "#141824",
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: "#232837",
    gap: 6,
  },
  inputModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  inputModeButtonActive: {
    backgroundColor: "#2a3247",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  inputModeLabel: {
    color: "#9aa1ad",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  inputModeLabelActive: {
    color: "#f0f3f8",
  },
  textInputCard: {
    width: "100%",
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2a2f3a",
    backgroundColor: "rgba(12, 14, 21, 0.9)",
  },
  textInputLabel: {
    color: "#8f96a3",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  textInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInputField: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#141824",
    borderWidth: 1,
    borderColor: "#232837",
    color: "#f5f7fb",
    paddingHorizontal: 12,
    fontSize: 14,
  },
  speakButton: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#2a3247",
    alignItems: "center",
    justifyContent: "center",
  },
  speakButtonDisabled: {
    backgroundColor: "#1f2433",
    opacity: 0.6,
  },
  speakButtonText: {
    color: "#f0f3f8",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  gestureShortcut: {
    marginTop: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  gestureShortcutText: {
    color: "#8fc1ff",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  controls: {
    width: "100%",
    gap: 20,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  controlButton: {
    alignItems: "center",
    width: 92,
  },
  controlIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1f232f",
    borderWidth: 1,
    borderColor: "#2b303c",
    alignItems: "center",
    justifyContent: "center",
  },
  controlIconText: {
    color: "#d4d7df",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  controlLabel: {
    color: "#c6c9d2",
    fontSize: 12,
    marginTop: 8,
  },
  endCallButton: {
    width: 220,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ef3b2d",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#ef3b2d",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  endCallText: {
    color: "#fff7f6",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
});
