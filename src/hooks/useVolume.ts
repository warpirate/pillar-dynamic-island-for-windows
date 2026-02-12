import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";

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

  // Fetch volume info
  const fetchVolume = useCallback(async () => {
    const result = await tauriInvoke<{ level: number; is_muted: boolean }>("get_system_volume");
    if (result) {
      setVolumeState({
        level: result.level,
        isMuted: result.is_muted,
      });
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
  }, []);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    const newMuted = await tauriInvoke<boolean>("toggle_mute");
    if (newMuted !== null) {
      setVolumeState(prev => ({ ...prev, isMuted: newMuted }));
    }
  }, []);

  // Start polling when mounted
  useEffect(() => {
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(fetchVolume, pollInterval);
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
        fetchVolume();
        startPolling();
      }
    };

    fetchVolume();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchVolume, pollInterval]);

  return {
    volume,
    isLoading,
    setVolume,
    toggleMute,
    refresh,
  };
}
