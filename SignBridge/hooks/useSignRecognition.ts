import { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL } from "../config";
import { useGestureText } from "../contexts/gesture-text";
import * as Speech from "expo-speech";

export type Landmark = {
  x: number;
  y: number;
  z: number;
};

export type PredictionMessage = {
  type: "prediction";
  ts: number;
  token: string;
  confidence: number;
  stable_ms: number;
  commit: boolean;
  landmarks?: Landmark[];
};

export type FrameMessage = {
  type: "frame";
  ts: number;
  image_b64: string;
  w: number;
  h: number;
};

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function useSignRecognition() {
  const wsRef = useRef<WebSocket | null>(null);
  const { text, setText } = useGestureText();

  const sentenceRef = useRef<string>("");

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [currentSign, setCurrentSign] = useState<string>("NONE");
  const [confidence, setConfidence] = useState<number>(0);
  const [stabilityMs, setStabilityMs] = useState<number>(0);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  // Keep sentenceRef synced
  useEffect(() => {
    sentenceRef.current = text ?? "";
  }, [text]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("✅ WebSocket connected");
      setStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const message: PredictionMessage = JSON.parse(event.data);
        if (message.type !== "prediction") return;

        setCurrentSign(message.token);
        setConfidence(message.confidence);
        setStabilityMs(message.stable_ms);
        setLandmarks(message.landmarks ?? []);

        if (message.commit && message.token && message.token !== "NONE") {
          const word = message.token.toUpperCase();

          // 🔵 YES triggers SEND
          if (word === "YES") {
            const sentence = sentenceRef.current.trim();

            if (sentence.length > 0) {
              console.log("📤 YES detected — sending message:", sentence);

              // Speak it
              Speech.speak(sentence);

              // Clear sentence
              sentenceRef.current = "";
              setText("");
            }

            return;
          }

          // 🔵 Otherwise append word
          const formatted = word.replace(/_/g, " ").toLowerCase();
          const current = sentenceRef.current.trim();
          const last = current
            ? current.split(/\s+/).slice(-1)[0]?.toLowerCase()
            : "";

          if (last === formatted) return;

          const next = current ? `${current} ${formatted}` : formatted;

          sentenceRef.current = next;
          setText(next);
        }
      } catch (err) {
        console.error("❌ Parse error:", err);
      }
    };

    ws.onerror = () => setStatus("error");

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
    };

    wsRef.current = ws;

    return () => ws.close();
  }, [setText]);

  const normalizeBase64 = (input: string) => {
    const stripped = input.includes(",") ? input.split(",")[1] : input;
    const padding = stripped.length % 4;
    if (padding === 0) return stripped;
    return stripped + "=".repeat(4 - padding);
  };

  const sendFrame = useCallback((imageBase64: string, width: number, height: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: FrameMessage = {
        type: "frame",
        ts: Date.now(),
        image_b64: normalizeBase64(imageBase64),
        w: width,
        h: height,
      };

      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    status,
    currentSign,
    confidence,
    stabilityMs,
    landmarks,
    sendFrame,
  };
}
