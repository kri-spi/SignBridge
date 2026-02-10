import React from "react";
import { View, Text, StyleSheet } from "react-native";

type DebugOverlayProps = {
  debugMode: boolean;
};

export default function DebugOverlay({ debugMode }: DebugOverlayProps) {
  if (!debugMode) return null;
  return (
    <View style={styles.overlay}>
      <Text style={styles.text}>Debug Mode Enabled</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  text: {
    color: "#ff3b30",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
});