import { useState, useEffect, useCallback, useRef } from "react";
import { platformApi } from "../lib/platform";
import { useAdaptivePolling } from "./useAdaptivePolling";

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
  const isMountedRef = useRef(true);

  // Adaptive polling for reduced CPU usage
  const { activityLevel, isDeepSleep, triggerActivity, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(2000, pollInterval / 2),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 3,
    deepSleepThreshold: 300000,
  });

  // Fetch brightness info (with in-flight guard)
  const fetchBrightness = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isPendingRef.current) return;
    // Skip poll if we recently set brightness manually
    if (Date.now() < suppressPollUntilRef.current) return;
    isPendingRef.current = true;
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.brightness) {
        setBrightnessState((prev) => ({ ...prev, isSupported: false }));
        return;
      }
      const result = await platformApi.getSystemBrightness();

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
    const caps = await platformApi.getCapabilities();
    if (!caps.brightness) return;
    // Suppress polling for 2s so it doesn't overwrite with the old value
    suppressPollUntilRef.current = Date.now() + 2000;
    // Mark user as active
    triggerActivity();
    // Optimistically update UI immediately
    setBrightnessState(prev => ({ ...prev, level: clampedLevel }));
    const ok = await platformApi.setSystemBrightness(clampedLevel);
    if (ok === null) {
      // Backend failed — re-fetch actual brightness
      suppressPollUntilRef.current = 0;
      await fetchBrightness();
    }
  }, [fetchBrightness, triggerActivity]);

  // Start polling function
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    // Use adaptive polling interval
    const interval = getCurrentInterval();
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) fetchBrightness();
    }, interval);
  }, [getCurrentInterval, fetchBrightness]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Start polling when mounted
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        resetIdleTimer();
        fetchBrightness();
        startPolling();
      }
    };

    fetchBrightness();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBrightness, startPolling, stopPolling, resetIdleTimer]);

  // Restart polling when activity level or deep sleep state changes
  useEffect(() => {
    if (!document.hidden) {
      startPolling();
    }
  }, [activityLevel, isDeepSleep, startPolling]);

  return {
    brightness,
    isLoading,
    setBrightness,
    refresh,
  };
}
