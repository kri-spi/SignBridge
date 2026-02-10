import { useEffect, useRef, useState, useCallback } from "react";

// Backend WebSocket URL - update with your server address
const WS_URL = "ws://10.241.140.42:8000/ws"; // Change to your backend URL

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
        setStatus("connecting");
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log("WebSocket connected");
          setStatus("connected");
        };

        ws.onmessage = (event) => {
          try {
            const message: PredictionMessage = JSON.parse(event.data);
            if (message.type === "prediction") {
              setCurrentSign(message.token);
              setConfidence(message.confidence);
              setStabilityMs(message.stable_ms);
              if (message.landmarks) {
                setLandmarks(message.landmarks);
              }
            }
          } catch (error) {
            console.error("Failed to parse message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          console.error("Connection URL:", WS_URL);
          console.error("Error event:", JSON.stringify(error));
          setStatus("error");
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected");
          setStatus("disconnected");
          wsRef.current = null;
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("Failed to connect:", error);
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

  const sendFrame = useCallback((imageBase64: string, width: number, height: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: FrameMessage = {
        type: "frame",
        ts: Date.now(),
        image_b64: imageBase64,
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
