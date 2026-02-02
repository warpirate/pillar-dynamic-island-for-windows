import { useState, useEffect, useCallback, useRef } from "react";

// =============================================================================
// Types
// =============================================================================

export interface SystemNotification {
  id: number;
  appName: string;
  title: string;
  body: string;
  timestamp: number;  // Unix timestamp in milliseconds
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

export function useNotifications(pollInterval = 5000): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [hasAccess, setHasAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [latestNotification, setLatestNotification] = useState<SystemNotification | null>(null);
  const [notificationPhase, setNotificationPhase] = useState<NotificationPhase>("idle");
  const [isNewNotification, setIsNewNotification] = useState(false);
  
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSeenIdRef = useRef<number>(0);
  const latestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newNotificationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check notification access
  const checkAccess = useCallback(async () => {
    const result = await tauriInvoke<boolean>("check_notification_access");
    if (result !== null) {
      setHasAccess(result);
    }
    return result ?? false;
  }, []);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!hasAccess) {
      // Try to check access first
      const access = await checkAccess();
      if (!access) {
        setIsLoading(false);
        return;
      }
    }

    const result = await tauriInvoke<Array<{
      id: number;
      app_name: string;
      title: string;
      body: string;
      timestamp: number;
    }>>("get_notifications");
    
    if (result) {
      const mapped = result.map(n => ({
        id: n.id,
        appName: n.app_name,
        title: n.title,
        body: n.body,
        timestamp: n.timestamp,
      }));
      
      // Check for new notifications
      if (mapped.length > 0) {
        const newest = mapped[0];
        if (newest.id !== lastSeenIdRef.current && lastSeenIdRef.current !== 0) {
          // New notification arrived - start animation sequence
          setLatestNotification(newest);
          setIsNewNotification(true);
          
          // Clear any existing timeouts
          if (latestTimeoutRef.current) clearTimeout(latestTimeoutRef.current);
          if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
          if (newNotificationTimeoutRef.current) clearTimeout(newNotificationTimeoutRef.current);
          
          // Phase 1: Incoming - toast appears below pill (2 seconds)
          setNotificationPhase("incoming");
          
          // Phase 2: Absorbing - toast shrinks and moves into pill (300ms)
          phaseTimeoutRef.current = setTimeout(() => {
            setNotificationPhase("absorbing");
            
            // Phase 3: Showing - badge visible in pill
            phaseTimeoutRef.current = setTimeout(() => {
              setNotificationPhase("showing");
              setLatestNotification(null);  // Clear toast, badge stays
            }, 300);
          }, 2000);
          
          // Clear "new notification" pulse after animation completes
          newNotificationTimeoutRef.current = setTimeout(() => {
            setIsNewNotification(false);
          }, 2500);
        }
        lastSeenIdRef.current = newest.id;
      }
      
      // Update phase based on notification count
      if (mapped.length === 0 && notificationPhase === "showing") {
        setNotificationPhase("idle");
      }
      
      setNotifications(mapped);
    }
    setIsLoading(false);
  }, [hasAccess, checkAccess, notificationPhase]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchNotifications();
  }, [fetchNotifications]);

  // Dismiss notification
  const dismissNotification = useCallback(async (id: number) => {
    await tauriInvoke("dismiss_notification", { id });
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
  }, [latestNotification]);

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

  // Start polling when mounted
  useEffect(() => {
    // Initial fetch
    fetchNotifications();

    // Poll for new notifications
    pollIntervalRef.current = setInterval(fetchNotifications, pollInterval);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (latestTimeoutRef.current) clearTimeout(latestTimeoutRef.current);
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current);
      if (newNotificationTimeoutRef.current) clearTimeout(newNotificationTimeoutRef.current);
    };
  }, [fetchNotifications, pollInterval]);

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
