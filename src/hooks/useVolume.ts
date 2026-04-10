import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";
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
    if (isPendingRef.current) return;
    isPendingRef.current = true;
    try {
      const result = await tauriInvoke<{ level: number; is_muted: boolean }>("get_system_volume");
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
    await tauriInvoke("set_system_volume", { level: clampedLevel });
    setVolumeState(prev => ({ ...prev, level: clampedLevel }));
    triggerActivity(); // Mark user as active
  }, [triggerActivity]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    const newMuted = await tauriInvoke<boolean>("toggle_mute");
    if (newMuted !== null) {
      setVolumeState(prev => ({ ...prev, isMuted: newMuted }));
    }
    triggerActivity(); // Mark user as active
  }, [triggerActivity]);

  // Start polling when mounted
  useEffect(() => {
    let isMounted = true;
    
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (isMounted && !isDeepSleep) {
        const interval = getCurrentInterval();
        pollIntervalRef.current = setInterval(() => {
          if (isMounted) fetchVolume();
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
      if (!isMounted) return;
      
      if (document.hidden) {
        stopPolling();
      } else {
        if (isMounted) {
          fetchVolume();
          resetIdleTimer(); // Reset idle timer when becoming visible
          startPolling();
        }
      }
    };

    if (isMounted) fetchVolume();
    startPolling();
    
    if (isMounted) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isMounted = false;
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
