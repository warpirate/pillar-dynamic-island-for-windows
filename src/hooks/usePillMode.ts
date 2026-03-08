import { useState, useCallback } from "react";

export type PillMode = "island" | "notch";

const STORAGE_KEY = "pillar-pill-mode";

export function usePillMode() {
  const [mode, setModeState] = useState<PillMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "island" || stored === "notch") return stored;
    } catch { /* ignore */ }
    return "island";
  });

  const setMode = useCallback((newMode: PillMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch { /* ignore */ }
  }, []);

  return { mode, setMode };
}
