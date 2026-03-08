import { useState, useCallback } from "react";

export type PillMode = "island" | "notch";

export interface AppearanceSettings {
  mode: PillMode;
  opacity: number;
  accentColor: string;
}

export const APPEARANCE_DEFAULTS: AppearanceSettings = {
  mode: "island",
  opacity: 94,
  accentColor: "#EB0028",
};

export const ACCENT_PRESETS = [
  { name: "Red", value: "#EB0028" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Pink", value: "#EC4899" },
  { name: "White", value: "#FFFFFF" },
];

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const STORAGE_KEY = "pillar-appearance";

function loadSettings(): AppearanceSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...APPEARANCE_DEFAULTS, ...parsed };
    }
    // Migrate from old pill-mode key
    const oldMode = localStorage.getItem("pillar-pill-mode");
    if (oldMode === "island" || oldMode === "notch") {
      return { ...APPEARANCE_DEFAULTS, mode: oldMode };
    }
  } catch { /* ignore */ }
  return { ...APPEARANCE_DEFAULTS };
}

export function useAppearance() {
  const [saved, setSaved] = useState<AppearanceSettings>(loadSettings);
  const [draft, setDraft] = useState<AppearanceSettings | null>(null);

  const isEditing = draft !== null;
  const active = draft ?? saved;

  const startEditing = useCallback(() => {
    setDraft({ ...saved });
  }, [saved]);

  const updateDraft = useCallback((changes: Partial<AppearanceSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : null));
  }, []);

  const save = useCallback(() => {
    if (draft) {
      setSaved(draft);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch { /* ignore */ }
      setDraft(null);
    }
  }, [draft]);

  const reset = useCallback(() => {
    const defaults = { ...APPEARANCE_DEFAULTS };
    setSaved(defaults);
    setDraft(null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    } catch { /* ignore */ }
  }, []);

  const discard = useCallback(() => {
    setDraft(null);
  }, []);

  return { active, isEditing, startEditing, updateDraft, save, reset, discard };
}
