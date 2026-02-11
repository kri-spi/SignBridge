import { useEffect, useRef, useState, useCallback } from "react";
import { WS_URL } from "../config";

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
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [currentSign, setCurrentSign] = useState<string>("NONE");
  const [confidence, setConfidence] = useState<number>(0);
  const [stabilityMs, setStabilityMs] = useState<number>(0);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  // Connect to WebSocket
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
          console.log("📨 Received message:", event.data);
          try {
            const message: PredictionMessage = JSON.parse(event.data);
            if (message.type === "prediction") {
              console.log("🤚 Prediction:", message.token, "confidence:", message.confidence);
              setCurrentSign(message.token);
              setConfidence(message.confidence);
              setStabilityMs(message.stable_ms);
              if (message.landmarks) {
                console.log("👆 Landmarks received:", message.landmarks.length);
                setLandmarks(message.landmarks);
              }
            }
          } catch (error) {
            console.error("❌ Failed to parse message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          console.error("Connection URL:", WS_URL);
          console.error("Error event:", JSON.stringify(error));
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
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const ws = wsRef.current;
      if (!ws) {
        setStatus((prev) => (prev === "disconnected" ? prev : "disconnected"));
        return;
      }
      if (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED) {
        setStatus((prev) => (prev === "disconnected" ? prev : "disconnected"));
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
      const normalizedBase64 = normalizeBase64(imageBase64);
      const message: FrameMessage = {
        type: "frame",
        ts: Date.now(),
        image_b64: normalizedBase64,
        w: width,
        h: height,
      };
      console.log("📤 Sending frame to server, size:", normalizedBase64.length, "bytes");
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.log("⚠️ Cannot send frame - WebSocket not open. State:", wsRef.current?.readyState);
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