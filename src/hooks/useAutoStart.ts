import { useState, useEffect, useCallback } from "react";
import { tauriInvoke } from "../lib/tauri";

// =============================================================================
// Types
// =============================================================================

interface UseAutoStartReturn {
  isEnabled: boolean;
  isLoading: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

// =============================================================================
// Hook
// =============================================================================

export function useAutoStart(): UseAutoStartReturn {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check autostart status
  const checkStatus = useCallback(async () => {
    const result = await tauriInvoke<boolean>("check_autostart_enabled");
    if (result !== null) {
      setIsEnabled(result);
    }
    setIsLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await checkStatus();
  }, [checkStatus]);

  // Enable or disable autostart — after calling backend, re-check so UI reflects actual state
  const setEnabled = useCallback(async (enabled: boolean) => {
    setIsLoading(true);
    await tauriInvoke("set_autostart_enabled", { enabled });
    const actual = await tauriInvoke<boolean>("check_autostart_enabled");
    if (actual !== null) {
      setIsEnabled(actual);
    } else {
      setIsEnabled(enabled);
    }
    setIsLoading(false);
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isEnabled,
    isLoading,
    setEnabled,
    refresh,
  };
}
