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
      layoutId={layoutId}
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
        <span className="text-white text-[9px] font-bold uppercase">
          {appName.charAt(0)}
        </span>
      </div>
      {/* Count badge */}
      <div className="bg-red-500 rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
        <span className="text-[10px] text-white font-medium">
          {count > 9 ? "9+" : count}
        </span>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Notification Toast (Shows BELOW pill when new notification arrives)
// =============================================================================

interface NotificationToastProps {
  notification: SystemNotification | null;
  onDismiss: () => void;
  phase?: NotificationPhase;
}

export function NotificationToast({ notification, onDismiss, phase = "incoming" }: NotificationToastProps) {
  // Don't show toast if we're past the incoming phase
  const shouldShow = notification && (phase === "incoming" || phase === "absorbing");

  return (
    <AnimatePresence mode="popLayout">
      {shouldShow && (
        <motion.div
          layoutId="notification-badge"
          className="z-50"
          initial={notificationAnimations.toast.initial}
          animate={phase === "absorbing" 
            ? { y: -60, opacity: 0, scale: 0.3 }  // Animate up into pill
            : notificationAnimations.toast.animate
          }
          exit={notificationAnimations.toast.exit}
          transition={phase === "absorbing" 
            ? notificationAnimations.absorptionSpring 
            : notificationAnimations.spring
          }
        >
          <motion.div
            className="bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 p-3 shadow-lg min-w-[280px]"
            onClick={onDismiss}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-start gap-3">
              {/* App icon */}
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getAppColorGradient(notification.appName)} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-xs font-bold uppercase">
                  {notification.appName.charAt(0)}
                </span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-[10px] font-medium">{notification.appName}</span>
                  <span className="text-white/30 text-[10px]">now</span>
                </div>
                <h4 className="text-white text-sm font-medium truncate mt-0.5">
                  {notification.title || "Notification"}
                </h4>
                {notification.body && (
                  <p className="text-white/60 text-xs line-clamp-2 mt-1">
                    {notification.body}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
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
          <span className="text-white text-[9px] font-bold uppercase">
            {notification.appName.charAt(0)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-white/40 text-[9px] truncate">{notification.appName}</span>
            <span className="text-white/30 text-[8px] flex-shrink-0">{formatTime(notification.timestamp)}</span>
          </div>
          <h4 className="text-white/80 text-[10px] font-medium truncate mt-0.5">
            {notification.title || "Notification"}
          </h4>
          {notification.body && (
            <p className="text-white/40 text-[9px] line-clamp-2 mt-0.5">
              {notification.body}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <motion.button
          className="w-4 h-4 rounded flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white/20 mb-1">
          <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <span className="text-white/40 text-[10px]">Notification access required</span>
        <span className="text-white/20 text-[9px] mt-0.5">Enable in Windows Settings</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-4 text-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white/20 mb-1">
          <path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        <span className="text-white/40 text-[10px]">No notifications</span>
        <span className="text-white/20 text-[9px] mt-0.5">All caught up!</span>
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
