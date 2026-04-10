import { useState, useCallback, useEffect } from "react";
import { tauriInvoke } from "../lib/tauri";
import type { AppSettings } from "./useSettings";

export type PillMode = "island" | "notch";

export interface AppearanceSettings {
  mode: PillMode;
  opacity: number;
  accentColor: string;
  useAlbumAccent: boolean;
}

export const APPEARANCE_DEFAULTS: AppearanceSettings = {
  mode: "island",
  opacity: 94,
  accentColor: "#EB0028",
  useAlbumAccent: false,
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

// Migrate old localStorage settings to Rust backend on first load
async function migrateLocalStorage(): Promise<Partial<AppearanceSettings> | null> {
  try {
    const stored = localStorage.getItem("pillar-appearance");
    if (stored) {
      const parsed = JSON.parse(stored);
      localStorage.removeItem("pillar-appearance");
      localStorage.removeItem("pillar-pill-mode");
      return parsed;
    }
    const oldMode = localStorage.getItem("pillar-pill-mode");
    if (oldMode === "island" || oldMode === "notch") {
      localStorage.removeItem("pillar-pill-mode");
      return { mode: oldMode };
    }
  } catch { /* ignore */ }
  return null;
}

export function useAppearance() {
  const [saved, setSaved] = useState<AppearanceSettings>(APPEARANCE_DEFAULTS);
  const [draft, setDraft] = useState<AppearanceSettings | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from Rust backend on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      // First check if there's old localStorage data to migrate
      const migrated = await migrateLocalStorage();

      const loaded = await tauriInvoke<AppSettings>("load_settings");
      if (!mounted) return;

      const fromBackend: AppearanceSettings = loaded
        ? {
            mode: (loaded.appearance.mode as PillMode) || APPEARANCE_DEFAULTS.mode,
            opacity: loaded.appearance.opacity ?? APPEARANCE_DEFAULTS.opacity,
            accentColor: loaded.appearance.accent_color || APPEARANCE_DEFAULTS.accentColor,
            useAlbumAccent: loaded.appearance.use_album_accent ?? false,
          }
        : APPEARANCE_DEFAULTS;

      // If we migrated localStorage data, merge it and save
      if (migrated) {
        const merged = { ...fromBackend, ...migrated };
        setSaved(merged);
        // Save migrated data to Rust backend
        const fullSettings = loaded || {
          appearance: { mode: "island", opacity: 94, accent_color: "#EB0028", use_album_accent: false },
          motion: { animation_speed: 1.0, reduced_motion_override: "system" },
          behavior: { launch_at_startup: false, pause_other_sessions: false },
          timer: { last_custom_label: "", last_custom_minutes: 25 },
          layout: {
            visible_tabs: { timer: true, media: true, notifications: true, settings: true, prism: true },
            idle_indicators: { media: true, battery: true, notifications: true },
          },
        };
        fullSettings.appearance = {
          mode: merged.mode,
          opacity: merged.opacity,
          accent_color: merged.accentColor,
          use_album_accent: merged.useAlbumAccent,
        };
        await tauriInvoke("save_settings", { settings: fullSettings });
      } else {
        setSaved(fromBackend);
      }
      setIsLoaded(true);
    })();
    return () => { mounted = false; };
  }, []);

  const isEditing = draft !== null;
  const active = draft ?? saved;

  const startEditing = useCallback(() => {
    setDraft({ ...saved });
  }, [saved]);

  const updateDraft = useCallback((changes: Partial<AppearanceSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : null));
  }, []);

  const save = useCallback(async () => {
    if (draft) {
      setSaved(draft);
      setDraft(null);
      // Save to Rust backend
      const loaded = await tauriInvoke<AppSettings>("load_settings");
      if (loaded) {
        loaded.appearance = {
          mode: draft.mode,
          opacity: draft.opacity,
          accent_color: draft.accentColor,
          use_album_accent: draft.useAlbumAccent,
        };
        await tauriInvoke("save_settings", { settings: loaded });
      }
    }
  }, [draft]);

  const reset = useCallback(async () => {
    const defaults = { ...APPEARANCE_DEFAULTS };
    setSaved(defaults);
    setDraft(null);
    const loaded = await tauriInvoke<AppSettings>("load_settings");
    if (loaded) {
      loaded.appearance = {
        mode: defaults.mode,
        opacity: defaults.opacity,
        accent_color: defaults.accentColor,
        use_album_accent: defaults.useAlbumAccent,
      };
      await tauriInvoke("save_settings", { settings: loaded });
    }
  }, []);

  const discard = useCallback(() => {
    setDraft(null);
  }, []);

  return { active, isEditing, isLoaded, startEditing, updateDraft, save, reset, discard };
}
