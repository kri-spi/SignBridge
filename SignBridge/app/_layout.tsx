import { Stack } from "expo-router";
import { GestureTextProvider } from "../contexts/gesture-text";
import { AudioTranscriptProvider } from "../contexts/audio-transcript";

export default function RootLayout() {
  return (
    <GestureTextProvider>
      <AudioTranscriptProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AudioTranscriptProvider>
    </GestureTextProvider>
  );
}