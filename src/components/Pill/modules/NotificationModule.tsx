import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { SystemNotification } from "../../../hooks/useNotifications";
import { notificationAnimations } from "../animations";

// =============================================================================
// Shared Utilities
// =============================================================================

// Get app color based on app name hash (gradient version for toast/cards)
const getAppColorGradient = (name: string) => {
  const colors = [
    "from-blue-500/40 to-blue-600/30",
    "from-green-500/40 to-green-600/30", 
    "from-purple-500/40 to-purple-600/30",
    "from-pink-500/40 to-pink-600/30",
    "from-orange-500/40 to-orange-600/30",
    "from-cyan-500/40 to-cyan-600/30",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Get app color (solid version for indicators)
const getAppColorSolid = (name: string) => {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500",
    "bg-pink-500", "bg-orange-500", "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// =============================================================================
// Notification Indicator (Shows in idle pill when notifications exist)
// =============================================================================

export type NotificationPhase = "idle" | "incoming" | "absorbing" | "showing";

interface NotificationIndicatorProps {
  count: number;
  appName: string;
  isNew?: boolean;
  layoutId?: string;
}

export function NotificationIndicator({ 
  count, 
  appName, 
  isNew = false,
  layoutId = "notification-badge"
}: NotificationIndicatorProps) {
  if (count === 0) return null;

  return (
    <motion.div 
      {...(layoutId != null ? { layoutId } : {})}
      className="flex items-center gap-1"
      initial={notificationAnimations.badge.initial}
      animate={{
        ...notificationAnimations.badge.animate,
        ...(isNew ? { scale: [1, 1.15, 1] } : {}),
      }}
      exit={notificationAnimations.badge.exit}
      transition={notificationAnimations.spring}
    >
      {/* App icon */}
      <div className={`w-5 h-5 rounded-full ${getAppColorSolid(appName)} flex items-center justify-center`}>
        <span className="text-white text-[10px] font-bold uppercase">
            {appName.charAt(0)}
          </span>
      </div>
      {/* Count badge */}
      <div className="bg-red-500 rounded-full px-1.5 min-w-[20px] h-[20px] flex items-center justify-center">
        <span className="text-[11px] text-white font-medium">
          {count > 9 ? "9+" : count}
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Notification Toast — pill-matched glass (Dynamic Island), no black box
// =============================================================================

interface NotificationToastProps {
  notification: SystemNotification | null;
  onDismiss: () => void;
  phase?: NotificationPhase;
}

export function NotificationToast({ notification, onDismiss, phase = "incoming" }: NotificationToastProps) {
  const shouldShow = notification && (phase === "incoming" || phase === "absorbing");

  useEffect(() => {
    if (!notification || !shouldShow) return;
    
    // Safety timeout: force dismissal after 3 seconds maximum (in case phase transitions get stuck)
    const safetyTimeout = setTimeout(() => {
      onDismiss();
    }, 3000);
    
    // Only set shorter timeout during "incoming" phase - "absorbing" phase is already transitioning out
    // Set timeout to 1800ms to allow manual dismissal before automatic phase transition at 2000ms
    let phaseTimeout: ReturnType<typeof setTimeout> | null = null;
    if (phase === "incoming") {
      phaseTimeout = setTimeout(() => {
        onDismiss();
      }, 1800);
    }
    
    return () => {
      clearTimeout(safetyTimeout);
      if (phaseTimeout) clearTimeout(phaseTimeout);
    };
  }, [notification, shouldShow, phase, onDismiss]);

  return (
    <AnimatePresence mode="popLayout">
      {shouldShow && (
        <motion.div
          layoutId="notification-badge"
          className="z-50 rounded-[20px] overflow-visible"
          initial={notificationAnimations.toast.initial}
          animate={
            phase === "absorbing"
              ? { y: -60, opacity: 0, scale: 0.3 }
              : notificationAnimations.toast.animate
          }
          exit={notificationAnimations.toast.exit}
          transition={
            phase === "absorbing"
              ? notificationAnimations.absorptionSpring
              : notificationAnimations.spring
          }
        >
          {/* Outer shell: same gradient + blur + shadow as pill — all via class + style so it always shows */}
          <div
            className="relative min-w-[320px] max-w-[420px] rounded-[20px] border border-white/[0.08] cursor-pointer overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.25),0_8px_48px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-[12px]"
            style={{
              background:
                "linear-gradient(135deg, rgba(20,20,22,0.95) 0%, rgba(30,30,35,0.92) 50%, rgba(15,15,18,0.96) 100%)",
            }}
            onClick={onDismiss}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onDismiss()}
          >
            {/* Glass overlay (pill-style) */}
            <div
              className="absolute inset-0 rounded-[20px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 50%)",
              }}
            />
            {/* Top edge glow (pill-style) */}
            <div
              className="absolute inset-x-0 top-0 h-px rounded-t-[20px] pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.14) 50%, transparent 100%)",
              }}
            />

            <div className="relative flex items-start gap-3 px-3.5 py-3">
              <div
                className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAppColorGradient(notification.appName)} flex items-center justify-center flex-shrink-0 border border-white/10`}
              >
                <span className="text-white text-[13px] font-bold uppercase tracking-wide">
                  {notification.appName.charAt(0)}
                </span>
              </div>

              <div className="flex-1 min-w-0 py-0.5">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className="text-[12px] font-semibold tracking-wide"
                    style={{
                      color: "rgba(235, 0, 40, 0.95)",
                      textShadow: "0 0 8px rgba(235, 0, 40, 0.3)",
                    }}
                  >
                    {notification.appName}
                  </span>
                  <span className="text-white/50 text-[10px] font-medium uppercase tracking-wider">
                    just now
                  </span>
                </div>
                <h4 className="text-white text-[13px] font-semibold truncate mt-1 drop-shadow-sm">
                  {notification.title || "Notification"}
                </h4>
                {notification.body && (
                  <p className="text-white/80 text-[12px] line-clamp-2 mt-0.5 leading-snug">
                    {notification.body}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// Notification Card (For list view)
// =============================================================================

interface NotificationCardProps {
  notification: SystemNotification;
  onDismiss: (id: number) => void;
}

export function NotificationCard({ notification, onDismiss }: NotificationCardProps) {
  // Format timestamp
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <motion.div
      className="bg-white/5 rounded-md p-2 hover:bg-white/8 transition-colors group"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
    >
      <div className="flex items-start gap-2">
        {/* App icon */}
        <div className={`w-6 h-6 rounded-md flex-shrink-0 ${getAppColorSolid(notification.appName)} flex items-center justify-center`}>
          <span className="text-white text-[10px] font-bold uppercase">
            {notification.appName.charAt(0)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-white/85 text-[11px] truncate">{notification.appName}</span>
            <span className="text-white/70 text-[10px] flex-shrink-0">{formatTime(notification.timestamp)}</span>
          </div>
          <h4 className="text-white text-[13px] font-medium truncate mt-0.5">
            {notification.title || "Notification"}
          </h4>
          {notification.body && (
            <p className="text-white/80 text-[11px] line-clamp-2 mt-0.5">
              {notification.body}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <motion.button
          className="w-4 h-4 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          whileTap={{ scale: 0.9 }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Notifications List
// =============================================================================

interface NotificationsListProps {
  notifications: SystemNotification[];
  hasAccess: boolean;
  onDismiss: (id: number) => void;
}

export function NotificationsList({ notifications, hasAccess, onDismiss }: NotificationsListProps) {
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white/60 mb-1">
          <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <span className="text-white text-[13px]">Notification access required</span>
        <span className="text-white/75 text-[11px] mt-0.5">Enable in Windows Settings</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white/60 mb-1">
          <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <span className="text-white text-[13px]">No notifications</span>
        <span className="text-white/75 text-[11px] mt-0.5">All caught up!</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-0.5">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
