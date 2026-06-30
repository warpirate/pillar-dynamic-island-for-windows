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

export interface LayoutSettingsData {
  visible_tabs: {
    timer: boolean;
    media: boolean;
    notifications: boolean;
    settings: boolean;
    prism: boolean;
    productivity: boolean;
  };
  idle_indicators: {
    media: boolean;
    battery: boolean;
    notifications: boolean;
  };
}

export interface AppSettings {
  appearance: AppearanceSettingsData;
  motion: MotionSettingsData;
  behavior: BehaviorSettingsData;
  timer: TimerSettingsData;
  layout: LayoutSettingsData;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  appearance: {
    mode: "island",
    opacity: 94,
    accent_color: "#EB0028",
    use_album_accent: true,
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
  layout: {
    visible_tabs: {
      timer: true,
      media: true,
      notifications: true,
      settings: true,
      prism: true,
      productivity: true,
    },
    idle_indicators: {
      media: true,
      battery: true,
      notifications: true,
    },
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

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch as T) ?? base;
  }

  const result: Record<string, unknown> = { ...base as Record<string, unknown> };
  for (const key of Object.keys(patch)) {
    const patchValue = (patch as Record<string, unknown>)[key];
    if (patchValue === undefined) continue;
    const baseValue = (base as Record<string, unknown>)[key];
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      result[key] = deepMerge(baseValue, patchValue as DeepPartial<typeof baseValue>);
    } else {
      result[key] = patchValue;
    }
  }
  return result as T;
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
