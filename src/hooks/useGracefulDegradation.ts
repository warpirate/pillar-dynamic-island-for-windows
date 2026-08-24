import { useState, useCallback, useEffect, useRef } from "react";

// =============================================================================
// Types
// =============================================================================

export type FeatureStatus = "available" | "unavailable" | "degraded" | "checking";

export interface FeatureState {
  status: FeatureStatus;
  lastChecked: number;
  retryCount: number;
  error?: string;
}

export interface GracefulDegradationConfig {
  maxRetries?: number;
  retryDelay?: number;
}

export interface UseGracefulDegradationReturn {
  // Feature status tracking
  getFeatureStatus: (featureName: string) => FeatureState;
  setFeatureStatus: (featureName: string, status: FeatureStatus, error?: string) => void;
  
  // Retry logic
  retryFeature: (featureName: string) => Promise<void>;
  
  // Global app state
  isOnline: boolean;
  isDegraded: boolean;
  unavailableFeatures: string[];
  
  // Error handling
  handleError: (featureName: string, error: Error | string) => void;
  clearError: (featureName: string) => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useGracefulDegradation(
  config: GracefulDegradationConfig = {}
): UseGracefulDegradationReturn {
  const {
    maxRetries = 3,
    retryDelay = 2000,
  } = config;

  const [featureStates, setFeatureStates] = useState<Map<string, FeatureState>>(new Map());
  const [isOnline, setIsOnline] = useState(true);
  const retryTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Mirror of featureStates so callbacks can read the latest snapshot without
  // depending on the state (which would re-create handleError on every render).
  const featureStatesRef = useRef(featureStates);
  featureStatesRef.current = featureStates;

  // Check online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Get feature status
  const getFeatureStatus = useCallback((featureName: string): FeatureState => {
    return featureStates.get(featureName) || {
      status: "checking",
      lastChecked: Date.now(),
      retryCount: 0,
    };
  }, [featureStates]);

  // Set feature status
  const setFeatureStatus = useCallback((
    featureName: string,
    status: FeatureStatus,
    error?: string
  ) => {
    setFeatureStates(prev => {
      const newState = new Map(prev);
      const existing = newState.get(featureName);
      
      newState.set(featureName, {
        status,
        lastChecked: Date.now(),
        retryCount: existing?.retryCount || 0,
        error,
      });
      
      return newState;
    });
  }, []);

  // Handle errors with automatic retry logic
  const handleError = useCallback((
    featureName: string,
    error: Error | string
  ) => {
    const errorMessage = typeof error === "string" ? error : error.message;
    // Read directly from the ref so we always see the latest retry count rather
    // than the snapshot captured when this callback was last created.
    const currentState = featureStatesRef.current.get(featureName) ?? {
      status: "checking" as FeatureStatus,
      lastChecked: Date.now(),
      retryCount: 0,
    };

    // If we haven't exceeded max retries, mark as degraded and schedule retry
    if (currentState.retryCount < maxRetries) {
      setFeatureStatus(featureName, "degraded", errorMessage);

      // Clear any existing retry timeout
      const existingTimeout = retryTimeoutsRef.current.get(featureName);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Schedule retry with exponential backoff
      const backoffDelay = retryDelay * Math.pow(2, currentState.retryCount);
      const timeoutId = setTimeout(() => {
        retryFeature(featureName);
      }, backoffDelay);

      retryTimeoutsRef.current.set(featureName, timeoutId);
    } else {
      // Max retries exceeded, mark as unavailable
      setFeatureStatus(featureName, "unavailable", errorMessage);
    }
  }, [maxRetries, retryDelay, setFeatureStatus]);

  // Clear error and reset status
  const clearError = useCallback((featureName: string) => {
    const existingTimeout = retryTimeoutsRef.current.get(featureName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      retryTimeoutsRef.current.delete(featureName);
    }

    // A confirmed success replenishes the retry budget; preserving the old
    // count meant a handful of lifetime errors would permanently latch a
    // currently-working feature as unavailable.
    setFeatureStates(prev => {
      const newState = new Map(prev);
      newState.set(featureName, {
        status: "available",
        lastChecked: Date.now(),
        retryCount: 0,
      });
      return newState;
    });
  }, []);

  // Retry a feature
  const retryFeature = useCallback(async (featureName: string) => {
    // Clear any existing retry timeout
    const existingTimeout = retryTimeoutsRef.current.get(featureName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      retryTimeoutsRef.current.delete(featureName);
    }
    
    // Update retry count
    setFeatureStates(prev => {
      const newState = new Map(prev);
      const existing = newState.get(featureName);
      
      newState.set(featureName, {
        status: "checking",
        lastChecked: Date.now(),
        retryCount: (existing?.retryCount || 0) + 1,
      });
      
      return newState;
    });
    
    // The actual retry logic should be implemented by the feature hook
    // This just resets the state to "checking" so the feature can try again
  }, []);

  // Calculate derived states
  const unavailableFeatures = Array.from(featureStates.entries())
    .filter(([_, state]) => state.status === "unavailable")
    .map(([name]) => name);

  const isDegraded = Array.from(featureStates.values())
    .some(state => state.status === "degraded");

  // Cleanup retry timeouts on unmount
  useEffect(() => {
    return () => {
      retryTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutsRef.current.clear();
    };
  }, []);

  return {
    getFeatureStatus,
    setFeatureStatus,
    retryFeature,
    isOnline,
    isDegraded,
    unavailableFeatures,
    handleError,
    clearError,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wrap an async function with graceful degradation
 * Automatically handles errors and retries
 */
export function withGracefulDegradation<T>(
  featureName: string,
  fn: () => Promise<T>,
  degradation: UseGracefulDegradationReturn,
  onSuccess?: (result: T) => void
): Promise<T | null> {
  return fn()
    .then(result => {
      degradation.setFeatureStatus(featureName, "available");
      onSuccess?.(result);
      return result;
    })
    .catch(error => {
      degradation.handleError(featureName, error as Error);
      return null;
    });
}

/**
 * Check if a feature should be shown based on its status
 */
export function shouldShowFeature(status: FeatureState): boolean {
  return status.status === "available" || status.status === "degraded";
}

/**
 * Get a fallback value if feature is unavailable
 */
export function getFallbackValue<T>(
  status: FeatureState,
  fallback: T,
  degradedFallback?: T
): T {
  if (status.status === "available") {
    return fallback; // Feature is working, use normal value
  }
  if (status.status === "degraded" && degradedFallback !== undefined) {
    return degradedFallback; // Feature is degraded, use degraded fallback
  }
  return fallback; // Feature is unavailable, use normal fallback
}
