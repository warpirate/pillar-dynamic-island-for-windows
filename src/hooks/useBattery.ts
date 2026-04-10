import { useState, useEffect, useCallback, useRef } from "react";
import { platformApi } from "../lib/platform";
import { useAdaptivePolling } from "./useAdaptivePolling";

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
  const isMountedRef = useRef(true);

  // Adaptive polling for reduced CPU usage
  const { activityLevel, isDeepSleep, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(10000, pollInterval / 2),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 3,
    deepSleepThreshold: 300000,
  });

  const fetchBattery = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isPendingRef.current) return;
    isPendingRef.current = true;
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.battery) {
        setBattery({
          percent: 0,
          isCharging: false,
          isBatterySaver: false,
          hasBattery: false,
        });
        return;
      }
      const result = await platformApi.getBatteryInfo();
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

  // Start polling function
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    // Use adaptive polling interval
    const interval = getCurrentInterval();
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) fetchBattery();
    }, interval);
  }, [getCurrentInterval, fetchBattery]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const handleVisibilityChange = () => {
      if (!isMounted) return;
      if (document.hidden) {
        stopPolling();
      } else {
        resetIdleTimer();
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
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchBattery, startPolling, stopPolling, resetIdleTimer]);

  // Restart polling when activity level or deep sleep state changes
  useEffect(() => {
    if (!document.hidden) {
      startPolling();
    }
  }, [activityLevel, isDeepSleep, startPolling]);

  return {
    battery,
    isLow: battery.hasBattery && !battery.isCharging && battery.percent <= 15,
    isCritical: battery.hasBattery && !battery.isCharging && battery.percent <= 5,
  };
}
