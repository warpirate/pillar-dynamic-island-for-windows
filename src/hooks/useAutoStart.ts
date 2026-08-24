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
    try {
      const result = await tauriInvoke<boolean>("check_autostart_enabled");
      if (result !== null) {
        setIsEnabled(result);
      }
    } catch (e) {
      // Backend unavailable: leave current state rather than spinning forever.
      console.warn("[useAutoStart] Failed to check autostart status", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await checkStatus();
  }, [checkStatus]);

  // Enable or disable autostart — after calling backend, re-check so UI reflects actual state
  const setEnabled = useCallback(async (enabled: boolean) => {
    setIsLoading(true);
    try {
      await tauriInvoke("set_autostart_enabled", { enabled });
      const actual = await tauriInvoke<boolean>("check_autostart_enabled");
      if (actual !== null) {
        setIsEnabled(actual);
      } else {
        setIsEnabled(enabled);
      }
    } catch (e) {
      console.warn("[useAutoStart] Failed to change autostart setting", e);
      throw e;
    } finally {
      setIsLoading(false);
    }
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
