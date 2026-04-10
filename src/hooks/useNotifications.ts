import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { tauriInvoke } from "../lib/tauri";
import { useAdaptivePolling } from "./useAdaptivePolling";
import { useGracefulDegradation } from "./useGracefulDegradation";

// =============================================================================
// Types
// =============================================================================

export interface SystemNotification {
  id: number;
  appName: string;
  title: string;
  body: string;
  timestamp: number;  // Unix timestamp in milliseconds
  aumid?: string;     // App User Model ID for direct activation
}

// Animation phase for notification flow
export type NotificationPhase = "idle" | "incoming" | "absorbing" | "showing";

interface UseNotificationsReturn {
  notifications: SystemNotification[];
  hasAccess: boolean;
  isLoading: boolean;
  latestNotification: SystemNotification | null;
  notificationPhase: NotificationPhase;
  isNewNotification: boolean;  // True when a new notification just arrived (for pulse animation)
  dismissNotification: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  clearLatest: () => void;
}

// =============================================================================
// Hook
// =============================================================================

/** Fallback poll interval (ms) when not using real-time events; only used if backend doesn't emit notification-changed. */
const FALLBACK_POLL_MS = 30_000;

export function useNotifications(pollInterval = FALLBACK_POLL_MS): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [latestNotification, setLatestNotification] = useState<SystemNotification | null>(null);
  const [notificationPhase, setNotificationPhase] = useState<NotificationPhase>("idle");
  const [isNewNotification, setIsNewNotification] = useState(false);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPendingRef = useRef(false);
  const lastSeenIdRef = useRef<number>(0);
  const latestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newNotificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationPhaseRef = useRef<NotificationPhase>(notificationPhase);
  notificationPhaseRef.current = notificationPhase;
  const isMountedRef = useRef(true);
  const { handleError, clearError } = useGracefulDegradation({
    maxRetries: 3,
    retryDelay: 1500,
  });

  // Adaptive polling for reduced CPU usage (for fallback polling)
  const { activityLevel, isDeepSleep, triggerActivity, getCurrentInterval, resetIdleTimer } = useAdaptivePolling({
    baseInterval: pollInterval,
    activeInterval: Math.max(5000, pollInterval / 2),
    idleThreshold: 30000,
    deepSleepInterval: pollInterval * 3,
    deepSleepThreshold: 300000,
  });

  // Check notification access
  const checkAccess = useCallback(async () => {
    try {
      const result = await tauriInvoke<boolean>("check_notification_access");
      if (result !== null) {
        setHasAccess(result);
      }
      clearError("notification_access");
      return result ?? false;
    } catch (e) {
      handleError("notification_access", e instanceof Error ? e : "Failed to check notification access");
      return false;
    }
  }, [clearError, handleError]);

  // Trigger notification toast animation sequence for a new notification
  const triggerNotificationAnimation = useCallback((notification: SystemNotification) => {
    setLatestNotification(notification);
    setIsNewNotification(true);

    // Clear any existing timeouts
    if (latestTimeoutRef.current) clearTimeout(latestTimeoutRef.current);
    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    if (newNotificationTimeoutRef.current) clearTimeout(newNotificationTimeoutRef.current);

    // Phase 1: Incoming - toast appears below pill (3.5 seconds for readability)
    setNotificationPhase("incoming");

    // Phase 2: Absorbing - toast shrinks and moves into pill badge (400ms)
    phaseTimeoutRef.current = setTimeout(() => {
      setNotificationPhase("absorbing");

      // Phase 3: Showing - badge visible in pill, toast fully gone
      phaseTimeoutRef.current = setTimeout(() => {
        setNotificationPhase("showing");
        setLatestNotification(null);  // Clear toast, badge stays
      }, 400);
    }, 3500);

    // Clear "new notification" pulse after full animation completes
    newNotificationTimeoutRef.current = setTimeout(() => {
      setIsNewNotification(false);
    }, 4200);

    lastSeenIdRef.current = notification.id;
  }, []);

  // Fetch notifications (with in-flight guard)
  const fetchNotifications = useCallback(async () => {
    if (!isMountedRef.current) return;
    if (isPendingRef.current) return; // Skip if previous request still in-flight

    if (!hasAccess) {
      const access = await checkAccess();
      if (!access) {
        setIsLoading(false);
        return;
      }
    }

    isPendingRef.current = true;
    try {
      const result = await tauriInvoke<Array<{
        id: number;
        app_name: string;
        title: string;
        body: string;
        timestamp: number;
        aumid: string | null;
      }>>("get_notifications");

      if (result) {
        const mapped = result.map(n => ({
          id: n.id,
          appName: n.app_name,
          title: n.title,
          body: n.body,
          timestamp: n.timestamp,
          aumid: n.aumid ?? undefined,
        }));

        // Check for new notifications
        if (mapped.length > 0) {
          const newest = mapped[0];
          if (newest.id !== lastSeenIdRef.current) {
            triggerNotificationAnimation(newest);
          }
          lastSeenIdRef.current = newest.id;
        }

        // Update phase based on notification count
        if (mapped.length === 0 && notificationPhaseRef.current === "showing") {
          setNotificationPhase("idle");
        }

        setNotifications(mapped);
      }
    } catch (e) {
      handleError("notifications_fetch", e instanceof Error ? e : "Failed to fetch notifications");
    } finally {
      isPendingRef.current = false;
      setIsLoading(false);
    }
  }, [hasAccess, checkAccess, handleError, triggerNotificationAnimation]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  // Dismiss notification
  const dismissNotification = useCallback(async (id: number) => {
    // Mark user as active
    triggerActivity();
    try {
      await tauriInvoke("dismiss_notification", { id });
      clearError("notifications_dismiss");
    } catch (e) {
      handleError("notifications_dismiss", e instanceof Error ? e : "Failed to dismiss notification");
    }
    setNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      // If all notifications cleared, return to idle
      if (updated.length === 0) {
        setNotificationPhase("idle");
      }
      return updated;
    });
    if (latestNotification?.id === id) {
      setLatestNotification(null);
    }
  }, [clearError, handleError, latestNotification, triggerActivity]);

  // Clear latest notification (user dismissed toast early)
  const clearLatest = useCallback(() => {
    setLatestNotification(null);
    if (latestTimeoutRef.current) clearTimeout(latestTimeoutRef.current);
    if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
    
    // Skip to showing phase (badge still visible)
    if (notificationPhase === "incoming" || notificationPhase === "absorbing") {
      setNotificationPhase("showing");
    }
  }, [notificationPhase]);

  // Initial access check
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const unlistenChangedRef = useRef<(() => void) | null>(null);
  const unlistenAddedRef = useRef<(() => void) | null>(null);

  // Start polling function
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    // Use adaptive polling interval
    const interval = getCurrentInterval();
    pollIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) fetchNotifications();
    }, interval);
  }, [getCurrentInterval, fetchNotifications]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Real-time: listen for Windows notification events from backend; fallback poll as backup
  useEffect(() => {
    let isMounted = true;

    if (isMounted) fetchNotifications();
    startPolling();

    if (isMounted) {
      // Listen for intercepted notifications (instant: backend already read content & dismissed from Windows)
      listen<{
        id: number;
        app_name: string;
        title: string;
        body: string;
        timestamp: number;
        aumid: string | null;
      }>("notification-added", (event) => {
        if (!isMounted) return;
        const n = event.payload;
        const mapped: SystemNotification = {
          id: n.id,
          appName: n.app_name,
          title: n.title,
          body: n.body,
          timestamp: n.timestamp,
          aumid: n.aumid ?? undefined,
        };

        // Add to notifications list (dedupe by ID, prepend)
        setNotifications(prev => {
          if (prev.some(p => p.id === mapped.id)) return prev;
          return [mapped, ...prev].slice(0, 10);
        });

        // Trigger toast animation if truly new
        if (mapped.id !== lastSeenIdRef.current) {
          triggerNotificationAnimation(mapped);
        }
      }).then((fn) => {
        if (isMounted) unlistenAddedRef.current = fn;
      }).catch(() => {});

      // Fallback: generic change event (for removals, or if interception failed)
      listen("notification-changed", () => {
        if (isMounted) fetchNotifications();
      }).then((fn) => {
        if (isMounted) unlistenChangedRef.current = fn;
      }).catch(() => {});
    }

    const onVisibilityChange = () => {
      if (!isMounted) return;

      if (document.hidden) {
        stopPolling();
      } else {
        resetIdleTimer();
        if (isMounted) fetchNotifications();
        startPolling();
      }
    };

    if (isMounted) {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      stopPolling();
      if (latestTimeoutRef.current) clearTimeout(latestTimeoutRef.current);
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
      if (newNotificationTimeoutRef.current) clearTimeout(newNotificationTimeoutRef.current);
      unlistenChangedRef.current?.();
      unlistenChangedRef.current = null;
      unlistenAddedRef.current?.();
      unlistenAddedRef.current = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchNotifications, triggerNotificationAnimation, startPolling, stopPolling, resetIdleTimer]);

  // Restart polling when activity level or deep sleep state changes
  useEffect(() => {
    if (!document.hidden) {
      startPolling();
    }
  }, [activityLevel, isDeepSleep, startPolling]);

  return {
    notifications,
    hasAccess,
    isLoading,
    latestNotification,
    notificationPhase,
    isNewNotification,
    dismissNotification,
    refresh,
    clearLatest,
  };
}
