import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import { Audio } from "expo-av";
import { Asset } from "expo-asset";
import { WS_URL } from "../config";

type Word = { word: string; start: number; end: number; conf?: number };

type AudioTranscriptState = {
  isPlaying: boolean;
  liveText: string;
  togglePlay: () => Promise<void>;
};

const AudioTranscriptContext = createContext<AudioTranscriptState | null>(null);

/**
 * Convert a URI to base64:
 * - web: fetch -> blob -> FileReader(dataURL) -> base64
 * - native: expo-file-system legacy readAsStringAsync(base64) via dynamic import
 */
async function uriToBase64(uri: string): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.onloadend = () => {
        const dataUrl = reader.result as string; // data:audio/mpeg;base64,...
        const base64 = dataUrl.split(",")[1] ?? "";
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }

  // Native: use legacy API explicitly (dynamic import so web doesn't crash)
  const FileSystem = await import("expo-file-system/legacy");
  // Typings vary across versions; "base64" is accepted at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await (FileSystem as any).readAsStringAsync(uri, { encoding: "base64" });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function AudioTranscriptProvider({
  children,
  wsUrl = WS_URL,
}: {
  children: React.ReactNode;
  wsUrl?: string;
}) {
  const wsRef = useRef<WebSocket | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [words, setWords] = useState<Word[]>([]);
  const wordsRef = useRef<Word[]>([]); // ✅ ensures playback callback sees latest words
  const [liveText, setLiveText] = useState("");

  // connect WS once
  useEffect(() => {
    console.log("Connecting to WS:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => console.log("Audio WS connected");
    ws.onerror = (e) => console.log("Audio WS error", e);
    ws.onclose = () => console.log("Audio WS closed");

    ws.onmessage = (event) => {
      console.log("Audio WS message:", event.data);
      try {
        const msg = JSON.parse(event.data);
        if (msg?.type === "audio_file_transcript") {
          const incoming = (msg.words || []) as Word[];
          wordsRef.current = incoming;
          setWords(incoming);

          // Optional: show something immediately even before playback position updates
          // setLiveText(msg.text || "");
        }
      } catch (e) {
        console.log("Audio WS parse error", e);
      }
    };

    return () => {
      try {
        ws.close();
      } catch {}
    };
  }, [wsUrl]);

  const waitForWsOpen = async (timeoutMs = 4000) => {
  const start = Date.now();

  while (true) {
    const ws = wsRef.current;

    if (!ws) {
      console.log("WS ref is null (provider not mounted or WS not created yet)");
    } else if (ws.readyState === WebSocket.OPEN) {
      return true;
    } else if (ws.readyState === WebSocket.CLOSED) {
      console.log("WS is CLOSED (will not open):", ws.readyState);
      return false;
    }

    if (Date.now() - start > timeoutMs) {
      console.log("WS did not open in time. Current state:", ws?.readyState);
      return false;
    }

    await new Promise((r) => setTimeout(r, 50));
  }
};

  // load MP3 asset → request transcript
  const ensureTranscriptLoaded = async () => {
    if (wordsRef.current.length > 0) return;

    const asset = Asset.fromModule(require("../assets/sample.mp3"));
    await asset.downloadAsync();

    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error("MP3 asset URI not available");

    const mp3Base64 = await uriToBase64(uri);

    const ok = await waitForWsOpen();
if (!ok) return;

    wsRef.current!.send(
      JSON.stringify({
        type: "audio_file",
        audio_mp3_b64: mp3Base64,
      })
    );
  };

  const startPlayback = async () => {
    await ensureTranscriptLoaded();

    // (re)load sound
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }

    const asset = Asset.fromModule(require("../assets/sample.mp3"));
    await asset.downloadAsync();

    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error("MP3 asset URI not available for playback");

    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: true }
    );

    soundRef.current = sound;
    setIsPlaying(true);
    setLiveText("");

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;

      if (status.didJustFinish) {
        setIsPlaying(false);
        setLiveText("");
        return;
      }

      const t = (status.positionMillis ?? 0) / 1000; // seconds
      const w = wordsRef.current;

      if (w.length > 0) {
        const visible = w.filter((x) => x.end <= t).map((x) => x.word);
        setLiveText(visible.join(" "));
      }
    });
  };

  const stopPlayback = async () => {
    setIsPlaying(false);
    setLiveText("");

    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
  };

  const togglePlay = async () => {
    if (isPlaying) return stopPlayback();
    return startPlayback();
  };

  const value = useMemo(
    () => ({ isPlaying, liveText, togglePlay }),
    [isPlaying, liveText]
  );

  return (
    <AudioTranscriptContext.Provider value={value}>
      {children}
    </AudioTranscriptContext.Provider>
  );
}

export function useAudioTranscript() {
  const ctx = useContext(AudioTranscriptContext);
  if (!ctx) {
    throw new Error(
      "useAudioTranscript must be used within AudioTranscriptProvider"
    );
  }
  return ctx;
}
