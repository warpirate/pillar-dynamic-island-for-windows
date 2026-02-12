import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";

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

  // Fetch devices list
  const fetchDevices = useCallback(async () => {
    const result = await tauriInvoke<Array<{
      id: string;
      name: string;
      is_default: boolean;
    }>>("list_audio_devices");
    
    if (result) {
      const mapped = result.map(d => ({
        id: d.id,
        name: d.name,
        isDefault: d.is_default,
      }));
      setDevices(mapped);
      
      // Update default device
      const def = mapped.find(d => d.isDefault);
      if (def) {
        setDefaultDevice(def);
      }
    }
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchDevices();
  }, [fetchDevices]);

  // Start polling when mounted
  useEffect(() => {
    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(fetchDevices, pollInterval);
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
        fetchDevices();
        startPolling();
      }
    };

    fetchDevices();
    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDevices, pollInterval]);

  return {
    devices,
    defaultDevice,
    isLoading,
    refresh,
  };
}
