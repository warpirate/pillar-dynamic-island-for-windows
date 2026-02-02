import { useState, useEffect, useCallback, useRef } from "react";

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
    // Initial fetch
    fetchVolume();

    // Poll less frequently for volume (it doesn't change often)
    pollIntervalRef.current = setInterval(fetchVolume, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
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
