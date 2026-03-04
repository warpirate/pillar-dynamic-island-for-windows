import { useState, useEffect, useCallback, useRef } from "react";
import { tauriInvoke } from "../lib/tauri";

// =============================================================================
// Types
// =============================================================================

export interface BatteryInfo {
  percent: number;       // 0-100
  isCharging: boolean;
  isBatterySaver: boolean;
  hasBattery: boolean;
}

interface UseBatteryReturn {
  battery: BatteryInfo;
  isLow: boolean;        // true when <= 15%
  isCritical: boolean;   // true when <= 5%
}

// =============================================================================
// Hook
// =============================================================================

export function useBattery(pollInterval = 60000): UseBatteryReturn {
  const [battery, setBattery] = useState<BatteryInfo>({
    percent: 100,
    isCharging: false,
    isBatterySaver: false,
    hasBattery: false,
  });

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);

  const fetchBattery = useCallback(async () => {
    if (isPendingRef.current) return;
    isPendingRef.current = true;
    try {
      const result = await tauriInvoke<{
        percent: number;
        is_charging: boolean;
        is_battery_saver: boolean;
        has_battery: boolean;
      }>("get_battery_info");
      if (result) {
        setBattery({
          percent: result.percent,
          isCharging: result.is_charging,
          isBatterySaver: result.is_battery_saver,
          hasBattery: result.has_battery,
        });
      }
    } catch {
      // Silently handle errors
    } finally {
      isPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (isMounted) {
        pollIntervalRef.current = setInterval(() => {
          if (isMounted) fetchBattery();
        }, pollInterval);
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
        if (isMounted) fetchBattery();
        startPolling();
      }
    };

    if (isMounted) fetchBattery();
    startPolling();

    if (isMounted) {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      isMounted = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBattery, pollInterval]);

  return {
    battery,
    isLow: battery.hasBattery && !battery.isCharging && battery.percent <= 15,
    isCritical: battery.hasBattery && !battery.isCharging && battery.percent <= 5,
  };
}
