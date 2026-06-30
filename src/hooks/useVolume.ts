import { useState, useEffect, useCallback, useRef } from "react";
import { platformApi } from "../lib/platform";
import { useAdaptivePolling } from "./useAdaptivePolling";

// =============================================================================
// Types
// =============================================================================

export interface VolumeInfo {
  level: number; // 0-100
  isMuted: boolean;
}

interface UseVolumeReturn {
  volume: VolumeInfo;
  isLoading: boolean;
  setVolume: (level: number) => Promise<void>;
  toggleMute: () => Promise<void>;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useVolume(pollInterval = 5000): UseVolumeReturn {
  const [volume, setVolumeState] = useState<VolumeInfo>({ level: 50, isMuted: false });
  const [isLoading, setIsLoading] = useState(false);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);
  const isMountedRef = useRef(true);
  
  // Adaptive polling for reduced CPU usage
  const { isDeepSleep, triggerActivity, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(1000, pollInterval / 2),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 3,
    deepSleepThreshold: 300000,
  });

  // Fetch volume info (with in-flight guard)
  const fetchVolume = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isPendingRef.current) return;
    isPendingRef.current = true;
    try {
      const result = await platformApi.getSystemVolume();
      if (!isMountedRef.current) return;
      if (result) {
        setVolumeState({
          level: result.level,
          isMuted: result.is_muted,
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
    await fetchVolume();
    setIsLoading(false);
  }, [fetchVolume]);

  // Set volume level
  const setVolume = useCallback(async (level: number) => {
    const clampedLevel = Math.max(0, Math.min(100, Math.round(level)));
    await platformApi.setSystemVolume(clampedLevel);
    setVolumeState(prev => ({ ...prev, level: clampedLevel }));
    triggerActivity(); // Mark user as active
  }, [triggerActivity]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    const newMuted = await platformApi.toggleMute();
    if (newMuted !== null) {
      setVolumeState(prev => ({ ...prev, isMuted: newMuted }));
    }
    triggerActivity(); // Mark user as active
  }, [triggerActivity]);

  // Start polling when mounted
  useEffect(() => {
    // Re-arm on every effect setup so a previous cleanup doesn't keep the hook dead.
    isMountedRef.current = true;

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (!isDeepSleep) {
        const interval = getCurrentInterval();
        pollIntervalRef.current = setInterval(() => {
          if (isMountedRef.current) fetchVolume();
        }, interval);
      }
    };

    const stopPolling = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (!isMountedRef.current) return;

      if (document.hidden) {
        stopPolling();
      } else {
        fetchVolume();
        resetIdleTimer();
        startPolling();
      }
    };

    fetchVolume();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchVolume, getCurrentInterval, isDeepSleep, resetIdleTimer]);

  return {
    volume,
    isLoading,
    setVolume,
    toggleMute,
    refresh,
  };
}
