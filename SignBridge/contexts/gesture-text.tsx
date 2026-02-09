import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

type GestureTextContextValue = {
  text: string;
  setText: (value: string) => void;
  appendText: (value: string) => void;
  clearText: () => void;
};

const GestureTextContext = createContext<GestureTextContextValue | undefined>(
  undefined
);

type GestureTextProviderProps = {
  children: ReactNode;
};

export function GestureTextProvider({ children }: GestureTextProviderProps) {
  const [text, setText] = useState("");

  const value = useMemo<GestureTextContextValue>(() => {
    const appendText = (valueToAppend: string) => {
      const trimmed = valueToAppend.trim();
      if (!trimmed) {
        return;
      }
      setText((current) => (current ? `${current} ${trimmed}` : trimmed));
    };

    const clearText = () => setText("");

    return {
      text,
      setText,
      appendText,
      clearText,
    };
  }, [text]);

  return (
    <GestureTextContext.Provider value={value}>
      {children}
    </GestureTextContext.Provider>
  );
}

export function useGestureText() {
  const context = useContext(GestureTextContext);
  if (!context) {
    throw new Error("useGestureText must be used within GestureTextProvider");
  }
  return context;
}
