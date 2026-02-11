import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Speech from "expo-speech";

import { useGestureText } from "../contexts/gesture-text";
import { useAudioTranscript } from "../contexts/audio-transcript";
import GestureCamera from "../components/gesture-camera";
import DebugOverlay from "../components/DebugOverlay";



type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export default function Index() {
  const [inputMode, setInputMode] = useState<"speech" | "text" | "gesture">(
    "speech"
  );
  const { text, setText } = useGestureText();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [, setWsStatus] = useState<ConnectionStatus>("disconnected");
  const [debugMode] = useState(false);

  const handleSpeak = () => {
    const value = text.trim();
    if (!value || isSpeaking) return;
    if (!value || isSpeaking) return;

    setIsSpeaking(true);
    Speech.speak(value, {
      onDone: () => setIsSpeaking(false),
    });
  };

  // NOTE: keep this if you still want to enable debug via some hidden gesture later

  const isGestureMode = inputMode === "gesture";

  // kept in case you still track status internally; UI pill removed

    return (
  <SafeAreaView style={styles.container}>
    <View style={styles.phoneShell}>
      <View style={styles.phoneBezel}>
        <View style={[styles.screen, isGestureMode && styles.screenGestureMode]}>
          
          <View style={styles.dynamicIsland} />
          <View style={styles.backgroundGlowTop} />
          <View style={styles.backgroundGlowBottom} />

          {/* Audio overlay */}
          <AudioPlayOverlayButton />
          <LiveTranscriptBar />

          {isGestureMode ? (
            <View style={styles.gestureModeContainer}>
              
              {/* Top layer */}
              <View style={styles.gestureTopLayer}>
                <View style={styles.gestureCallerInfo}>
                  <View style={styles.gestureTopBar}>
                    <Pressable
                      style={styles.gestureBackButton}
                      onPress={() => setInputMode("speech")}
                    >
                      <Text style={styles.gestureBackText}>← Back</Text>
                    </Pressable>
                  </View>

                  <View style={styles.gestureHeader}>
                    <Text style={styles.gestureCallerName}>Morgan Lee</Text>
                    <Text style={styles.gestureCallStatus}>Call in progress</Text>
                    <Text style={styles.gestureCallTime}>04:28</Text>
                  </View>

                  <View style={styles.gestureAvatarWrap}>
                    <View style={styles.gestureAvatarInner}>
                      <Text style={styles.gestureAvatarInitials}>ML</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Bottom layer */}
              <View style={styles.gestureBottomLayer}>
                <View style={styles.gestureCameraContainer}>
                  <GestureCamera onStatusChange={setWsStatus} />
                </View>

                <View style={styles.gestureTextContainer}>
                  <Text style={styles.gestureTextLabel}>Detected Text</Text>
                  <View style={styles.gestureTextBox}>
                    <Text style={styles.gestureTextContent}>
                      {text || "Waiting for gestures..."}
                    </Text>
                  </View>

                  <Pressable
                    style={[
                      styles.speakButton,
                      styles.gestureSendButton,
                      (!text.trim() || isSpeaking) &&
                        styles.gestureSendButtonDisabled,
                    ]}
                    onPress={handleSpeak}
                  >
                    <Text style={styles.speakButtonText}>
                      {isSpeaking ? "Speaking" : "🔊 Send"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : (
            <>
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

              <DebugBox
                label="inputModeCard"
                style={styles.inputModeCard}
                debugMode={debugMode}
              >
                <Text style={styles.inputModeTitle}>Input mode</Text>
                <View style={styles.inputModeRow}>
                  <Pressable
                    style={[
                      styles.inputModeButton,
                      inputMode === "speech" && styles.inputModeButtonActive,
                    ]}
                    onPress={() => setInputMode("speech")}
                  >
                    <Text style={styles.inputModeIcon}>🎤</Text>
                    <Text style={styles.inputModeLabel}>Speech</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.inputModeButton,
                      inputMode === "text" && styles.inputModeButtonActive,
                    ]}
                    onPress={() => setInputMode("text")}
                  >
                    <Text style={styles.inputModeIcon}>🔤</Text>
                    <Text style={styles.inputModeLabel}>Text</Text>
                  </Pressable>

                  <Pressable
                    style={styles.inputModeButton}
                    onPress={() => setInputMode("gesture")}
                  >
                    <Text style={styles.inputModeIcon}>👋</Text>
                    <Text style={styles.inputModeLabel}>Gesture</Text>
                  </Pressable>
                </View>
              </DebugBox>

              {inputMode === "text" && (
                <DebugBox
                  label="textInputCard"
                  style={styles.textInputCard}
                  debugMode={debugMode}
                >
                  <Text style={styles.textInputLabel}>Type to speak</Text>
                  <View style={styles.textInputRow}>
                    <TextInput
                      style={styles.textInputField}
                      placeholder="Enter message"
                      placeholderTextColor="#667085"
                      value={text}
                      onChangeText={setText}
                      returnKeyType="done"
                      onSubmitEditing={handleSpeak}
                    />
                    <Pressable
                      style={[
                        styles.speakButton,
                        (!text.trim() || isSpeaking) &&
                          styles.speakButtonDisabled,
                      ]}
                      onPress={handleSpeak}
                    >
                      <Text style={styles.speakButtonText}>
                        {isSpeaking ? "Speaking" : "Send"}
                      </Text>
                    </Pressable>
                  </View>
                </DebugBox>
              )}

              <Pressable style={styles.endCallButton}>
                <Text style={styles.endCallText}>End Call</Text>
              </Pressable>
            </>
          )}

          <DebugOverlay debugMode={debugMode} />

        </View>
      </View>
    </View>
  </SafeAreaView>
);
}



function AudioPlayOverlayButton() {
  const { isPlaying, togglePlay } = useAudioTranscript();
  return (
    <Pressable style={styles.audioPlayButton} onPress={togglePlay}>
      <Text style={styles.audioPlayButtonText}>{isPlaying ? "⏸" : "▶️"}</Text>
    </Pressable>
  );
}

function LiveTranscriptBar() {
  const { liveText } = useAudioTranscript();
  return (
    <View style={styles.transcriptBar}>
      <Text style={styles.transcriptLabel}>Audio transcript</Text>
      <Text style={styles.transcriptText} numberOfLines={2}>
        {liveText || "—"}
      </Text>
    </View>
  );
}

type DebugBoxProps = {
  children: React.ReactNode;
  label: string;
  style?: any;
  debugMode?: boolean;
};

function DebugBox({ children, label, style, debugMode = false }: DebugBoxProps) {
  if (!debugMode) return <>{children}</>;
  return (
    <View style={[style, styles.debugBorder]}>
      <Text style={styles.debugLabel}>{label}</Text>
      {children}
    </View>
  );
}

const { height: screenHeight } = Dimensions.get("window");

// Keep realistic iPhone ratio (390x844 ≈ 0.46 width/height ratio)
const PHONE_RATIO = 390 / 844;

// Make phone 90% of screen height max
const phoneHeight = Math.min(screenHeight * 0.9, 780);
const phoneWidth = phoneHeight * PHONE_RATIO;


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0c10",
    alignItems: "center",
    justifyContent: "center",
  },

phoneShell: {
  width: phoneWidth,
  height: phoneHeight,
  borderRadius: 50,
  padding: 10,
  backgroundColor: "#0b0c10",
  shadowColor: "#000",
  shadowOpacity: 0.45,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 18 },
  elevation: 20,
},

  // NEW: bezel ring
  phoneBezel: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: "#111318",
    padding: 6,
    borderWidth: 1,
    borderColor: "#222636",
    overflow: "hidden",
  },

  screen: {
    flex: 1,
    borderRadius: 38,
    backgroundColor: "#0b0b0d",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    overflow: "hidden",
  },

  screenGestureMode: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    justifyContent: "flex-start",
  },

  dynamicIsland: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    width: 126,
    height: 34,
    borderRadius: 18,
    backgroundColor: "#050506",
    borderWidth: 1,
    borderColor: "#15181f",
    opacity: 0.95,
  },

  // status pill REMOVED (was statusIcon)
  // toggle debug button REMOVED

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
    padding: 5,
    borderWidth: 1,
    borderColor: "#232837",
    gap: 6,
  },
  inputModeButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 4,
  },
  inputModeButtonActive: {
    backgroundColor: "#2a3247",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  inputModeIcon: {
    fontSize: 24,
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

  controls: {
    width: "90%",
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
    fontSize: 28,
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

  debugBorder: {
    borderWidth: 2,
    borderColor: "#ff3b30",
    borderStyle: "dashed",
  },
  debugLabel: {
    position: "absolute",
    top: 2,
    left: 2,
    fontSize: 10,
    color: "#ff3b30",
    backgroundColor: "rgba(255, 59, 48, 0.2)",
    paddingHorizontal: 4,
    zIndex: 999,
  },
  debugDivider: {
    height: 2,
    width: "100%",
    backgroundColor: "#ff3b30",
    opacity: 0.6,
  },
  debugSectionLabel: {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: 11,
    color: "#ff3b30",
    backgroundColor: "rgba(255, 59, 48, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 2,
  },

  // Gesture mode layout
  gestureModeContainer: {
    flex: 1,
    width: "100%",
  },
  gestureTopLayer: {
    flex: 0.25,
    backgroundColor: "#0b0b0d",
    borderBottomWidth: 1,
    borderBottomColor: "#232837",
  },
  gestureCallerInfo: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  gestureTopBar: {
    position: "absolute",
    top: 12,
    left: 16,
    zIndex: 2,
  },
  gestureBackButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#1f2433",
  },
  gestureBackText: {
    color: "#d6d9e1",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  gestureHeader: {
    alignItems: "center",
    marginTop: 20,
  },
  gestureCallerName: {
    color: "#f5f7fb",
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  gestureCallStatus: {
    color: "#8f96a3",
    fontSize: 12,
    marginTop: 4,
  },
  gestureCallTime: {
    color: "#c6c9d2",
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 1.2,
  },
  gestureAvatarWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#2a2f3a",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18, 20, 27, 0.8)",
    marginTop: 12,
  },
  gestureAvatarInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#232734",
    alignItems: "center",
    justifyContent: "center",
  },
  gestureAvatarInitials: {
    color: "#eef1f6",
    fontSize: 18,
    fontWeight: "600",
  },
  gestureBottomLayer: {
    flex: 0.75,
  },
  gestureCameraContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  gestureTextContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#0b0b0d",
    padding: 16,
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
  },
  gestureTextLabel: {
    color: "#8f96a3",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  gestureTextBox: {
    flex: 1,
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#232837",
    backgroundColor: "#141824",
    padding: 16,
    justifyContent: "center",
    marginBottom: 12,
  },
  gestureTextContent: {
    color: "#f0f3f8",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  gestureSendButton: {
    position: "absolute",
    right: 16,
    bottom: 16,
    backgroundColor: "#2f7bff",
  },
  gestureSendButtonDisabled: {
    backgroundColor: "#2f7bff",
    opacity: 0.6,
  },

  audioPlayButton: {
    position: "absolute",
    top: 12,
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(31, 36, 51, 0.95)",
    borderWidth: 1,
    borderColor: "#2b303c",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  audioPlayButtonText: {
    color: "#f0f3f8",
    fontSize: 18,
    fontWeight: "700",
  },
  transcriptBar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#232837",
    backgroundColor: "rgba(12, 14, 21, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    zIndex: 1500,
  },
  transcriptLabel: {
    color: "#8f96a3",
    fontSize: 11,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  transcriptText: {
    color: "#f0f3f8",
    fontSize: 14,
    lineHeight: 20,
  },
});

