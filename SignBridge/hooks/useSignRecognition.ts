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

  // ✅ NEW: sending state for animation
  const [isSending, setIsSending] = useState(false);
  const sendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep sentenceRef synced with global text (in case user edits/clears elsewhere)
  useEffect(() => {
    sentenceRef.current = (text ?? "").toString();
  }, [text]);

  const stopSending = useCallback(() => {
    setIsSending(false);
    if (sendingTimerRef.current) {
      clearTimeout(sendingTimerRef.current);
      sendingTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const connect = () => {
      try {
        console.log("🔌 Attempting to connect to WebSocket:", WS_URL);
        setStatus("connecting");

        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log("✅ WebSocket connected successfully");
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
              const token = String(message.token).toUpperCase();

              // ✅ YES triggers SEND
              if (token === "YES") {
                const sentence = sentenceRef.current.trim();

                if (sentence.length > 0) {
                  // start animation
                  setIsSending(true);

                  // fallback: stop animation even if TTS callback fails
                  if (sendingTimerRef.current) clearTimeout(sendingTimerRef.current);
                  sendingTimerRef.current = setTimeout(stopSending, 1800);

                  Speech.speak(sentence, {
                    onDone: stopSending,
                    onStopped: stopSending,
                    onError: stopSending,
                  });

                  // clear the sentence after sending
                  sentenceRef.current = "";
                  setText("");
                }

                return;
              }

              // otherwise append token to sentence
              const word = token.replace(/_/g, " ").toLowerCase();
              const current = sentenceRef.current.trim();
              const last = current
                ? current.split(/\s+/).slice(-1)[0]?.toLowerCase()
                : "";

              if (last === word) return;

              const next = current ? `${current} ${word}` : word;
              sentenceRef.current = next;
              setText(next);
            }
          } catch (error) {
            console.error("❌ Failed to parse message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          console.error("Connection URL:", WS_URL);
          setStatus("error");
        };

        ws.onclose = () => {
          console.log("🔌 WebSocket disconnected");
          setStatus("disconnected");
          wsRef.current = null;
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("❌ Failed to connect:", error);
        setStatus("error");
      }
    };

    connect();

    return () => {
      stopSending();
      wsRef.current?.close();
    };
  }, [setText, stopSending]);

  // Keep status in sync with readyState
  useEffect(() => {
    const interval = setInterval(() => {
      const ws = wsRef.current;
      if (!ws) {
        setStatus("disconnected");
        return;
      }
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        setStatus("disconnected");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
    isSending, // ✅ expose to UI
  };
}
