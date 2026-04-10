import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";

// =============================================================================
// Types (mirrors Rust AppSettings)
// =============================================================================

export interface AppearanceSettingsData {
  mode: "island" | "notch";
  opacity: number;
  accent_color: string;
  use_album_accent: boolean;
}

export interface MotionSettingsData {
  animation_speed: number; // multiplier: 0.5, 0.75, 1.0, 1.5, 2.0
  reduced_motion_override: "system" | "on" | "off";
}

export interface BehaviorSettingsData {
  launch_at_startup: boolean;
  pause_other_sessions: boolean;
}

export interface TimerSettingsData {
  last_custom_label: string;
  last_custom_minutes: number;
}

export interface AppSettings {
  appearance: AppearanceSettingsData;
  motion: MotionSettingsData;
  behavior: BehaviorSettingsData;
  timer: TimerSettingsData;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  appearance: {
    mode: "island",
    opacity: 94,
    accent_color: "#EB0028",
    use_album_accent: false,
  },
  motion: {
    animation_speed: 1.0,
    reduced_motion_override: "system",
  },
  behavior: {
    launch_at_startup: false,
    pause_other_sessions: false,
  },
  timer: {
    last_custom_label: "",
    last_custom_minutes: 25,
  },
};

// =============================================================================
// Hook
// =============================================================================

interface UseSettingsReturn {
  settings: AppSettings;
  isLoaded: boolean;
  update: (patch: DeepPartial<AppSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function deepMerge(base: AppSettings, patch: DeepPartial<AppSettings>): AppSettings {
  const result = { ...base };
  for (const section of Object.keys(patch) as (keyof AppSettings)[]) {
    const patchSection = patch[section];
    if (patchSection && typeof patchSection === "object") {
      result[section] = { ...result[section], ...patchSection } as never;
    }
  }
  return result;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(SETTINGS_DEFAULTS);
  const [isLoaded, setIsLoaded] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const load = useCallback(async () => {
    const loaded = await tauriInvoke<AppSettings>("load_settings");
    if (loaded) {
      const merged = deepMerge(SETTINGS_DEFAULTS, loaded as DeepPartial<AppSettings>);
      setSettings(merged);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(async (patch: DeepPartial<AppSettings>) => {
    const merged = deepMerge(settingsRef.current, patch);
    setSettings(merged);
    await tauriInvoke("save_settings", { settings: merged });
  }, []);

  return { settings, isLoaded, update, reload: load };
}
