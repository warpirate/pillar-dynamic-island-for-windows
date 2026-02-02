import { useState, useEffect, useCallback, useRef } from "react";

// =============================================================================
// Types
// =============================================================================

export interface AudioSession {
  sessionId: string;
  appName: string;
  processId: number;
  volume: number;        // 0.0 - 1.0
  isMuted: boolean;
  isActive: boolean;
}

interface UsePerAppMixerReturn {
  sessions: AudioSession[];
  isLoading: boolean;
  setSessionVolume: (processId: number, volume: number) => Promise<void>;
  setSessionMute: (processId: number, muted: boolean) => Promise<void>;
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

export function usePerAppMixer(pollInterval = 3000): UsePerAppMixerReturn {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch sessions list
  const fetchSessions = useCallback(async () => {
    const result = await tauriInvoke<Array<{
      session_id: string;
      app_name: string;
      process_id: number;
      volume: number;
      is_muted: boolean;
      is_active: boolean;
    }>>("list_audio_sessions");
    
    if (result) {
      setSessions(result.map(s => ({
        sessionId: s.session_id,
        appName: s.app_name,
        processId: s.process_id,
        volume: s.volume,
        isMuted: s.is_muted,
        isActive: s.is_active,
      })));
    }
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchSessions();
  }, [fetchSessions]);

  // Set session volume
  const setSessionVolume = useCallback(async (processId: number, volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    await tauriInvoke("set_session_volume", { processId, level: clampedVolume });
    
    // Update local state optimistically
    setSessions(prev => prev.map(s => 
      s.processId === processId 
        ? { ...s, volume: clampedVolume }
        : s
    ));
  }, []);

  // Set session mute
  const setSessionMute = useCallback(async (processId: number, muted: boolean) => {
    await tauriInvoke("set_session_mute", { processId, muted });
    
    // Update local state optimistically
    setSessions(prev => prev.map(s => 
      s.processId === processId 
        ? { ...s, isMuted: muted }
        : s
    ));
  }, []);

  // Start polling when mounted
  useEffect(() => {
    // Initial fetch
    fetchSessions();

    // Poll for session changes (apps starting/stopping)
    pollIntervalRef.current = setInterval(fetchSessions, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchSessions, pollInterval]);

  return {
    sessions,
    isLoading,
    setSessionVolume,
    setSessionMute,
    refresh,
  };
}
