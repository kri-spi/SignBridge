import { Stack } from "expo-router";

import { GestureTextProvider } from "../contexts/gesture-text";

export default function RootLayout() {
  return (
    <GestureTextProvider>
      <Stack />
    </GestureTextProvider>
  );
}
