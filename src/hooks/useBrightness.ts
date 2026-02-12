import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";

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
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(fetchBrightness, pollInterval);
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchBrightness();
        startPolling();
      }
    };

    fetchBrightness();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBrightness, pollInterval]);

  return {
    brightness,
    isLoading,
    setBrightness,
    refresh,
  };
}
