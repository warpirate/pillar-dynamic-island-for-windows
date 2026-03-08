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
  const isPendingRef = useRef(false);
  const suppressPollUntilRef = useRef(0);

  // Fetch brightness info (with in-flight guard)
  const fetchBrightness = useCallback(async () => {
    if (isPendingRef.current) return;
    // Skip poll if we recently set brightness manually
    if (Date.now() < suppressPollUntilRef.current) return;
    isPendingRef.current = true;
    try {
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
    } catch {
      // Silently handle errors to prevent crashes
    } finally {
      isPendingRef.current = false;
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
    // Suppress polling for 2s so it doesn't overwrite with the old value
    suppressPollUntilRef.current = Date.now() + 2000;
    // Optimistically update UI immediately
    setBrightnessState(prev => ({ ...prev, level: clampedLevel }));
    const ok = await tauriInvoke("set_system_brightness", { level: clampedLevel });
    if (ok === null) {
      // Backend failed — re-fetch actual brightness
      suppressPollUntilRef.current = 0;
      await fetchBrightness();
    }
  }, [fetchBrightness]);

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
