import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export type ActivityLevel = "idle" | "low" | "medium" | "high";

export interface AdaptivePollingConfig {
  baseInterval: number;        // Default polling interval (ms)
  activeInterval: number;       // Interval when user is active (ms)
  idleThreshold: number;        // Time before entering idle mode (ms)
  deepSleepInterval: number;    // Interval during extended idle (ms)
  deepSleepThreshold: number;  // Time before entering deep sleep (ms)
}

interface UseAdaptivePollingReturn {
  activityLevel: ActivityLevel;
  isDeepSleep: boolean;
  triggerActivity: () => void;
  getCurrentInterval: () => number;
  resetIdleTimer: () => void;
}

// =============================================================================
// Hook
// =============================================================================

const DEFAULT_CONFIG: AdaptivePollingConfig = {
  baseInterval: 5000,
  activeInterval: 1000,
  idleThreshold: 30000,      // 30 seconds
  deepSleepInterval: 60000,   // 1 minute
  deepSleepThreshold: 300000, // 5 minutes
};

export function useAdaptivePolling(
  config: Partial<AdaptivePollingConfig> = {}
): UseAdaptivePollingReturn {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("idle");
  const [isDeepSleep, setIsDeepSleep] = useState(false);
  
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deepSleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const activityCountRef = useRef<number>(0);
  
  // Calculate current polling interval based on activity level
  const getCurrentInterval = useCallback((): number => {
    if (isDeepSleep) {
      return fullConfig.deepSleepInterval;
    }
    
    switch (activityLevel) {
      case "high":
        return fullConfig.activeInterval;
      case "medium":
        return fullConfig.baseInterval;
      case "low":
        return fullConfig.baseInterval * 2;
      case "idle":
      default:
        return fullConfig.baseInterval * 3;
    }
  }, [activityLevel, isDeepSleep, fullConfig]);
  
  // Trigger activity (call this when user interacts with the app)
  const triggerActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    activityCountRef.current++;
    
    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    
    // Reset deep sleep timer
    if (deepSleepTimerRef.current) {
      clearTimeout(deepSleepTimerRef.current);
      setIsDeepSleep(false);
    }
    
    // Determine activity level based on recent activity
    const recentActivity = activityCountRef.current;
    if (recentActivity > 10) {
      setActivityLevel("high");
    } else if (recentActivity > 5) {
      setActivityLevel("medium");
    } else if (recentActivity > 2) {
      setActivityLevel("low");
    } else {
      setActivityLevel("idle");
    }
    
    // Decay activity count over time
    setTimeout(() => {
      activityCountRef.current = Math.max(0, activityCountRef.current - 1);
    }, 5000);
    
    // Set idle timer
    idleTimerRef.current = setTimeout(() => {
      setActivityLevel("idle");
      activityCountRef.current = 0;
    }, fullConfig.idleThreshold);
    
    // Set deep sleep timer
    deepSleepTimerRef.current = setTimeout(() => {
      setIsDeepSleep(true);
      setActivityLevel("idle");
    }, fullConfig.deepSleepThreshold);
  }, [fullConfig.idleThreshold, fullConfig.deepSleepThreshold]);
  
  // Reset idle timer (call when content becomes active)
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    if (deepSleepTimerRef.current) {
      clearTimeout(deepSleepTimerRef.current);
      setIsDeepSleep(false);
    }
    lastActivityRef.current = Date.now();
    setActivityLevel("medium");
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (deepSleepTimerRef.current) {
        clearTimeout(deepSleepTimerRef.current);
      }
    };
  }, []);
  
  return {
    activityLevel,
    isDeepSleep,
    triggerActivity,
    getCurrentInterval,
    resetIdleTimer,
  };
}
