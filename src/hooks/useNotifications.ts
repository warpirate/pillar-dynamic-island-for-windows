import { useState, useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { platformApi } from "../lib/platform";
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
  history: SystemNotification[];
  hasAccess: boolean;
  isLoading: boolean;
  latestNotification: SystemNotification | null;
  notificationPhase: NotificationPhase;
  isNewNotification: boolean;  // True when a new notification just arrived (for pulse animation)
  dismissNotification: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
  clearLatest: () => void;
  clearHistory: () => void;
}

// =============================================================================
// Hook
// =============================================================================

/** Fallback poll interval (ms) when not using real-time events; only used if backend doesn't emit notification-changed. */
const FALLBACK_POLL_MS = 30_000;
const NOTIFICATION_HISTORY_KEY = "pillar_notification_history_v1";
const MAX_NOTIFICATION_HISTORY = 200;

export function useNotifications(pollInterval = FALLBACK_POLL_MS): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [history, setHistory] = useState<SystemNotification[]>([]);
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

  const upsertHistory = useCallback((incoming: SystemNotification[]) => {
    if (incoming.length === 0) return;
    setHistory((prev) => {
      const map = new Map<number, SystemNotification>();
      incoming.forEach((n) => map.set(n.id, n));
      prev.forEach((n) => {
        if (!map.has(n.id)) map.set(n.id, n);
      });
      const merged = Array.from(map.values())
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_NOTIFICATION_HISTORY);
      return merged;
    });
  }, []);

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
      const caps = await platformApi.getCapabilities();
      if (!caps.notifications) {
        setHasAccess(false);
        return false;
      }
      const result = await platformApi.checkNotificationAccess();
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
      const result = await platformApi.getNotifications();

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
        upsertHistory(mapped);
      }
    } catch (e) {
      handleError("notifications_fetch", e instanceof Error ? e : "Failed to fetch notifications");
    } finally {
      isPendingRef.current = false;
      setIsLoading(false);
    }
  }, [hasAccess, checkAccess, handleError, triggerNotificationAnimation, upsertHistory]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  // Dismiss notification
  const dismissNotification = useCallback(async (id: number) => {
    // Mark user as active
    triggerActivity();
    try {
      const caps = await platformApi.getCapabilities();
      if (!caps.notifications) return;
      await platformApi.dismissNotification(id);
      clearError("notifications_dismiss");
    } catch (e) {
      handleError("notifications_dismiss", e instanceof Error ? e : "Failed to dismiss notification");
      // Backend refused or failed: leave the item in place so this list stays
      // in sync with Windows Action Center instead of the entry silently
      // resurrecting on the next poll.
      return;
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_HISTORY_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // Validate per-item shape so a corrupt entry doesn't crash list rendering.
      const valid: SystemNotification[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const n = item as Record<string, unknown>;
        if (
          typeof n.id !== "number" ||
          typeof n.appName !== "string" ||
          typeof n.title !== "string" ||
          typeof n.body !== "string" ||
          typeof n.timestamp !== "number"
        ) continue;
        valid.push({
          id: n.id,
          appName: n.appName,
          title: n.title,
          body: n.body,
          timestamp: n.timestamp,
          aumid: typeof n.aumid === "string" ? n.aumid : undefined,
        });
      }
      setHistory(valid.slice(0, MAX_NOTIFICATION_HISTORY));
    } catch {
      // ignore malformed history cache
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_NOTIFICATION_HISTORY)));
    } catch {
      // ignore storage errors
    }
  }, [history]);

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
    // Re-arm on every effect setup so a previous cleanup doesn't keep the hook dead.
    isMountedRef.current = true;

    fetchNotifications();
    startPolling();

    // Listen for intercepted notifications (instant: backend already read content & dismissed from Windows).
    // If the listen() promise resolves AFTER cleanup ran, call the returned unlisten immediately
    // so we don't leak a dangling subscription.
    listen<{
      id: number;
      app_name: string;
      title: string;
      body: string;
      timestamp: number;
      aumid: string | null;
    }>("notification-added", (event) => {
      if (!isMountedRef.current) return;
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
      upsertHistory([mapped]);

      // Trigger toast animation if truly new
      if (mapped.id !== lastSeenIdRef.current) {
        triggerNotificationAnimation(mapped);
      }
    }).then((fn) => {
      if (!isMountedRef.current) {
        fn();
        return;
      }
      unlistenAddedRef.current = fn;
    }).catch(() => {});

    // Fallback: generic change event (for removals, or if interception failed)
    listen("notification-changed", () => {
      if (!isMountedRef.current) return;
      fetchNotifications();
    }).then((fn) => {
      if (!isMountedRef.current) {
        fn();
        return;
      }
      unlistenChangedRef.current = fn;
    }).catch(() => {});

    const onVisibilityChange = () => {
      if (!isMountedRef.current) return;

      if (document.hidden) {
        stopPolling();
      } else {
        resetIdleTimer();
        fetchNotifications();
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
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
  }, [fetchNotifications, triggerNotificationAnimation, startPolling, stopPolling, resetIdleTimer, upsertHistory]);

  // Restart polling when activity level or deep sleep state changes
  useEffect(() => {
    if (!document.hidden) {
      startPolling();
    }
  }, [activityLevel, isDeepSleep, startPolling]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(NOTIFICATION_HISTORY_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  return {
    notifications,
    history,
    hasAccess,
    isLoading,
    latestNotification,
    notificationPhase,
    isNewNotification,
    dismissNotification,
    refresh,
    clearLatest,
    clearHistory,
  };
}
