import { useState, useEffect, useCallback, useRef } from "react";

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
    // Initial fetch
    fetchDevices();

    // Poll for device changes
    pollIntervalRef.current = setInterval(fetchDevices, pollInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchDevices, pollInterval]);

  return {
    devices,
    defaultDevice,
    isLoading,
    refresh,
  };
}
