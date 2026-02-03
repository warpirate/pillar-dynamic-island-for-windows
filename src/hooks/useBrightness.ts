import { useState, useEffect, useCallback, useRef } from "react";

// =============================================================================
// Types
// =============================================================================

export interface BrightnessInfo {
  level: number;      // 0-100
  min: number;        // minimum brightness level
  max: number;        // maximum brightness level
  isSupported: boolean;
}

interface UseBrightnessReturn {
  brightness: BrightnessInfo;
  isLoading: boolean;
  setBrightness: (level: number) => Promise<void>;
  refresh: () => Promise<void>;
}

// Tauri invoke helper - Tauri v2 uses window.__TAURI__.core.invoke
const tauriInvoke = async <T,>(cmd: string, args?: Record<string, unknown>): Promise<T | null> => {
  if (!(window as any).__TAURI__?.core?.invoke) return null;
  try {
    return await (window as any).__TAURI__.core.invoke(cmd, args) as T;
  } catch (e) {
    console.error(`Tauri invoke failed (${cmd}):`, e);
    return null;
  }
};

// =============================================================================
// Hook
// =============================================================================

export function useBrightness(pollInterval = 10000): UseBrightnessReturn {
  const [brightness, setBrightnessState] = useState<BrightnessInfo>({
    level: 100,
    min: 0,
    max: 100,
    isSupported: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch brightness info
  const fetchBrightness = useCallback(async () => {
    const result = await tauriInvoke<{
      level: number;
      min: number;
      max: number;
      is_supported: boolean;
    }>("get_system_brightness");
    
    if (result) {
      setBrightnessState({
        level: result.level,
        min: result.min,
        max: result.max,
        isSupported: result.is_supported,
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchBrightness();
    setIsLoading(false);
  }, [fetchBrightness]);

  // Set brightness level — only update state if backend succeeds
  const setBrightness = useCallback(async (level: number) => {
    const clampedLevel = Math.max(0, Math.min(100, Math.round(level)));
    const ok = await tauriInvoke("set_system_brightness", { level: clampedLevel });
    if (ok !== null) {
      setBrightnessState(prev => ({ ...prev, level: clampedLevel }));
    }
  }, []);

  // Start polling when mounted
  useEffect(() => {
    // Initial fetch
    fetchBrightness();

    // Poll less frequently for brightness (it rarely changes externally)
    pollIntervalRef.current = setInterval(fetchBrightness, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchBrightness, pollInterval]);

  return {
    brightness,
    isLoading,
    setBrightness,
    refresh,
  };
}
