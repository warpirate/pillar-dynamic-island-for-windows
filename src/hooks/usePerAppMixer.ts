import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";
import { useAdaptivePolling } from "./useAdaptivePolling";
import { useGracefulDegradation } from "./useGracefulDegradation";

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

// =============================================================================
// Hook
// =============================================================================

export function usePerAppMixer(pollInterval = 3000): UsePerAppMixerReturn {
  const [sessions, setSessions] = useState<AudioSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);
  const isMountedRef = useRef(true);
  const { handleError, clearError } = useGracefulDegradation({
    maxRetries: 3,
    retryDelay: 1200,
  });

  // Adaptive polling for reduced CPU usage
  const { activityLevel, isDeepSleep, triggerActivity, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(1000, pollInterval / 2),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 3,
    deepSleepThreshold: 300000,
  });

  // Fetch sessions list (with in-flight guard)
  const fetchSessions = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isPendingRef.current) return;
    isPendingRef.current = true;
    try {
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
      clearError("audio_mixer");
    } catch (e) {
      handleError("audio_mixer", e instanceof Error ? e : "Failed to list audio sessions");
    } finally {
      isPendingRef.current = false;
      setIsLoading(false);
    }
  }, [clearError, handleError]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchSessions();
  }, [fetchSessions]);

  // Set session volume
  const setSessionVolume = useCallback(async (processId: number, volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    // Mark user as active
    triggerActivity();
    try {
      await tauriInvoke("set_session_volume", { processId, level: clampedVolume });
      clearError("audio_mixer_control");
    } catch (e) {
      handleError("audio_mixer_control", e instanceof Error ? e : "Failed to set app volume");
    }
    
    // Update local state optimistically
    setSessions(prev => prev.map(s =>
      s.processId === processId
        ? { ...s, volume: clampedVolume }
        : s
    ));
  }, [clearError, handleError, triggerActivity]);

  // Set session mute
  const setSessionMute = useCallback(async (processId: number, muted: boolean) => {
    // Mark user as active
    triggerActivity();
    try {
      await tauriInvoke("set_session_mute", { processId, muted });
      clearError("audio_mixer_control");
    } catch (e) {
      handleError("audio_mixer_control", e instanceof Error ? e : "Failed to set app mute");
    }
    
    // Update local state optimistically
    setSessions(prev => prev.map(s =>
      s.processId === processId
        ? { ...s, isMuted: muted }
        : s
    ));
  }, [clearError, handleError, triggerActivity]);

  // Start polling function
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    // Use adaptive polling interval
    const interval = getCurrentInterval();
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) fetchSessions();
    }, interval);
  }, [getCurrentInterval, fetchSessions]);

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
        fetchSessions();
        startPolling();
      }
    };

    fetchSessions();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchSessions, startPolling, stopPolling, resetIdleTimer]);

  // Restart polling when activity level or deep sleep state changes
  useEffect(() => {
    if (!document.hidden) {
      startPolling();
    }
  }, [activityLevel, isDeepSleep, startPolling]);

  return {
    sessions,
    isLoading,
    setSessionVolume,
    setSessionMute,
    refresh,
  };
}
