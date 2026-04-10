import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// Types
// =============================================================================

export type CrashSeverity = "minor" | "moderate" | "severe" | "critical";

export interface CrashReport {
  id: string;
  timestamp: number;
  error: Error | string;
  severity: CrashSeverity;
  component?: string;
  action?: string;
  stackTrace?: string;
  userAgent?: string;
  appVersion?: string;
}

export interface CrashRecoveryConfig {
  maxCrashReports?: number;
  crashThreshold?: number; // Number of crashes within timeWindow to trigger recovery
  timeWindow?: number; // Time window in ms
  autoRecoveryDelay?: number; // Delay before auto-recovery attempt
  enableAutoRecovery?: boolean;
}

export interface UseCrashRecoveryReturn {
  // Crash reporting
  reportCrash: (error: Error | string, options?: {
    severity?: CrashSeverity;
    component?: string;
    action?: string;
  }) => void;
  
  // Crash history
  crashHistory: CrashReport[];
  recentCrashCount: number;
  isCrashLoopDetected: boolean;
  
  // Recovery actions
  triggerRecovery: () => Promise<void>;
  clearCrashHistory: () => void;
  
  // Health monitoring
  isHealthy: boolean;
  healthScore: number; // 0-100
}

// =============================================================================
// Hook
// =============================================================================

export function useCrashRecovery(
  config: CrashRecoveryConfig = {}
): UseCrashRecoveryReturn {
  const {
    maxCrashReports = 50,
    crashThreshold = 3,
    timeWindow = 60000, // 1 minute
    autoRecoveryDelay = 3000, // 3 seconds
    enableAutoRecovery = true,
  } = config;

  const [crashHistory, setCrashHistory] = useState<CrashReport[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const recoveryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  // Load crash history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pillar_crash_history");
      if (saved) {
        const parsed = JSON.parse(saved) as CrashReport[];
        // Filter to only recent crashes (last 24 hours)
        const recent = parsed.filter(
          crash => Date.now() - crash.timestamp < 86400000
        );
        setCrashHistory(recent.slice(0, maxCrashReports));
      }
    } catch {
      // Ignore localStorage errors
    }

    return () => {
      isMountedRef.current = false;
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
    };
  }, [maxCrashReports]);

  // Save crash history to localStorage
  const saveCrashHistory = useCallback((history: CrashReport[]) => {
    try {
      localStorage.setItem("pillar_crash_history", JSON.stringify(history));
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Report a crash
  const reportCrash = useCallback((
    error: Error | string,
    options: {
      severity?: CrashSeverity;
      component?: string;
      action?: string;
    } = {}
  ) => {
    const {
      severity = "moderate",
      component,
      action,
    } = options;

    const crashReport: CrashReport = {
      id: `crash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      error,
      severity,
      component,
      action,
      stackTrace: error instanceof Error ? error.stack : undefined,
      userAgent: navigator.userAgent,
      appVersion: (import.meta as any).env?.VITE_APP_VERSION || "unknown",
    };

    setCrashHistory(prev => {
      const newHistory = [crashReport, ...prev].slice(0, maxCrashReports);
      saveCrashHistory(newHistory);
      return newHistory;
    });

    // Log to console for debugging
    console.error("[Crash Recovery] Crash reported:", crashReport);

    // Trigger auto-recovery if enabled and crash is severe
    if (enableAutoRecovery && (severity === "severe" || severity === "critical")) {
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
      }
      
      recoveryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          triggerRecovery();
        }
      }, autoRecoveryDelay);
    }
  }, [maxCrashReports, enableAutoRecovery, autoRecoveryDelay]);

  // Calculate recent crash count
  const recentCrashCount = crashHistory.filter(
    crash => Date.now() - crash.timestamp < timeWindow
  ).length;

  // Detect crash loop
  const isCrashLoopDetected = recentCrashCount >= crashThreshold;

  // Calculate health score
  const healthScore = useCallback((): number => {
    if (crashHistory.length === 0) return 100;

    const now = Date.now();
    let score = 100;

    // Deduct points for recent crashes
    crashHistory.forEach(crash => {
      const age = now - crash.timestamp;
      const ageInHours = age / 3600000;

      // Severity penalties
      const severityPenalty = {
        minor: 5,
        moderate: 10,
        severe: 20,
        critical: 40,
      }[crash.severity];

      // Age decay (older crashes have less impact)
      const ageDecay = Math.max(0.1, 1 - ageInHours / 24);
      
      score -= severityPenalty * ageDecay;
    });

    return Math.max(0, Math.min(100, score));
  }, [crashHistory]);

  const currentHealthScore = healthScore();
  const isHealthy = currentHealthScore >= 50;

  // Trigger recovery action
  const triggerRecovery = useCallback(async () => {
    if (isRecovering) return;
    
    setIsRecovering(true);
    console.log("[Crash Recovery] Starting recovery...");

    try {
      // 1. Clear all caches
      if (typeof window !== "undefined" && "caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }

      // 2. Clear localStorage (except crash history)
      const crashHistoryData = localStorage.getItem("pillar_crash_history");
      localStorage.clear();
      if (crashHistoryData) {
        localStorage.setItem("pillar_crash_history", crashHistoryData);
      }

      // 3. Reload the page
      setTimeout(() => {
        window.location.reload();
      }, 500);

    } catch (error) {
      console.error("[Crash Recovery] Recovery failed:", error);
      setIsRecovering(false);
    }
  }, [isRecovering]);

  // Clear crash history
  const clearCrashHistory = useCallback(() => {
    setCrashHistory([]);
    saveCrashHistory([]);
    localStorage.removeItem("pillar_crash_history");
  }, [saveCrashHistory]);

  return {
    reportCrash,
    crashHistory,
    recentCrashCount,
    isCrashLoopDetected,
    triggerRecovery,
    clearCrashHistory,
    isHealthy,
    healthScore: currentHealthScore,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wrap an async function with crash recovery
 * Automatically reports errors and triggers recovery if needed
 */
export function withCrashRecovery<T>(
  fn: () => Promise<T>,
  recovery: UseCrashRecoveryReturn,
  options: {
    component?: string;
    action?: string;
    severity?: CrashSeverity;
  } = {}
): Promise<T | null> {
  return fn()
    .then(result => result)
    .catch(error => {
      recovery.reportCrash(error as Error, options);
      return null;
    });
}

/**
 * Create an error boundary handler for React components
 */
export function createErrorHandler(
  recovery: UseCrashRecoveryReturn,
  componentName: string
) {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    recovery.reportCrash(error, {
      severity: "severe",
      component: componentName,
      action: "render",
    });

    // Log additional error info if available
    if (errorInfo) {
      console.error("[Error Boundary] Component stack:", errorInfo.componentStack);
    }
  };
}

/**
 * Check if the app should enter safe mode
 */
export function shouldEnterSafeMode(recovery: UseCrashRecoveryReturn): boolean {
  return recovery.isCrashLoopDetected || recovery.healthScore < 30;
}

/**
 * Get safe mode configuration
 */
export function getSafeModeConfig() {
  return {
    // Disable animations
    disableAnimations: true,
    // Reduce polling frequency
    reducePolling: true,
    // Disable non-essential features
    disableNotifications: false,
    disableMediaControls: false,
    // Simplify UI
    simplifiedUI: true,
  };
}
