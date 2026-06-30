import { useState, useEffect, useCallback, useRef } from "react";
import { platformApi } from "../lib/platform";
import { useAdaptivePolling } from "./useAdaptivePolling";
import { useGracefulDegradation } from "./useGracefulDegradation";

// =============================================================================
// Types
// =============================================================================

export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

interface UseAudioDevicesReturn {
  devices: AudioDevice[];
  defaultDevice: AudioDevice | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAudioDevices(pollInterval = 5000): UseAudioDevicesReturn {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [defaultDevice, setDefaultDevice] = useState<AudioDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);
  const isMountedRef = useRef(true);
  const { handleError, clearError } = useGracefulDegradation({
    maxRetries: 3,
    retryDelay: 1500,
  });

  // Adaptive polling for reduced CPU usage
  const { activityLevel, isDeepSleep, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(2000, pollInterval / 2),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 3,
    deepSleepThreshold: 300000,
  });

  // Fetch devices list (with in-flight guard)
  const fetchDevices = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isPendingRef.current) return;
    isPendingRef.current = true;
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.audioDevices) {
        setDevices([]);
        setDefaultDevice(null);
        return;
      }
      const result = await platformApi.listAudioDevices();

      if (result) {
        const mapped = result.map(d => ({
          id: d.id,
          name: d.name,
          isDefault: d.is_default,
        }));
        setDevices(mapped);

        const def = mapped.find(d => d.isDefault);
        if (def) {
          setDefaultDevice(def);
        }
      }
      clearError("audio_devices");
    } catch (e) {
      handleError("audio_devices", e instanceof Error ? e : "Failed to list audio devices");
    } finally {
      isPendingRef.current = false;
      setIsLoading(false);
    }
  }, [clearError, handleError]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchDevices();
  }, [fetchDevices]);

  // Start polling function
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    // Use adaptive polling interval
    const interval = getCurrentInterval();
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) fetchDevices();
    }, interval);
  }, [getCurrentInterval, fetchDevices]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Start polling when mounted
  useEffect(() => {
    // Re-arm on every effect setup so a previous cleanup doesn't keep the hook dead.
    isMountedRef.current = true;

    const handleVisibilityChange = () => {
      if (!isMountedRef.current) return;
      if (document.hidden) {
        stopPolling();
      } else {
        resetIdleTimer();
        fetchDevices();
        startPolling();
      }
    };

    fetchDevices();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDevices, startPolling, stopPolling, resetIdleTimer]);

  // Restart polling when activity level or deep sleep state changes
  useEffect(() => {
    if (!document.hidden) {
      startPolling();
    }
  }, [activityLevel, isDeepSleep, startPolling]);

  return {
    devices,
    defaultDevice,
    isLoading,
    refresh,
  };
}
