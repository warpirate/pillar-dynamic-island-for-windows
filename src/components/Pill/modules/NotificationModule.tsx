import { motion, AnimatePresence } from "motion/react";
import type { SystemNotification } from "../../../hooks/useNotifications";
import { notificationAnimations, microInteractions, PILL_DURATION_FAST } from "../animations";

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

// Get app accent color (hex for glows/borders)
const getAppAccentColor = (name: string) => {
  const colors = [
    { hex: "#3b82f6", rgb: "59, 130, 246" },   // blue
    { hex: "#22c55e", rgb: "34, 197, 94" },     // green
    { hex: "#a855f7", rgb: "168, 85, 247" },    // purple
    { hex: "#ec4899", rgb: "236, 72, 153" },    // pink
    { hex: "#f97316", rgb: "249, 115, 22" },    // orange
    { hex: "#06b6d4", rgb: "6, 182, 212" },     // cyan
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
// Notification Toast — Refined glass card with accent glow
// =============================================================================

interface NotificationToastProps {
  notification: SystemNotification | null;
  onDismiss: () => void;
  onActivate?: (id: number) => void;
  phase?: NotificationPhase;
}

export function NotificationToast({ notification, onDismiss, onActivate, phase = "incoming" }: NotificationToastProps) {
  const shouldShow = notification && (phase === "incoming" || phase === "absorbing");

  return (
    <AnimatePresence mode="popLayout">
      {shouldShow && (
        <motion.div
          layoutId="notification-badge"
          className="z-50 overflow-visible"
          initial={{ y: 30, opacity: 0, scale: 0.85 }}
          animate={
            phase === "absorbing"
              ? { y: -50, opacity: 0, scale: 0.3 }
              : { y: 0, opacity: 1, scale: 1 }
          }
          exit={{ y: -40, opacity: 0, scale: 0.4 }}
          transition={
            phase === "absorbing"
              ? notificationAnimations.absorptionSpring
              : {
                  type: "spring" as const,
                  stiffness: 380,
                  damping: 28,
                  mass: 0.8,
                }
          }
        >
          <ToastCard
            notification={notification}
            phase={phase}
            onDismiss={onDismiss}
            onActivate={onActivate}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Inner card split out to keep motion wrapper clean */
function ToastCard({
  notification,
  phase,
  onDismiss,
  onActivate,
}: {
  notification: SystemNotification;
  phase: NotificationPhase;
  onDismiss: () => void;
  onActivate?: (id: number) => void;
}) {
  const accent = getAppAccentColor(notification.appName);

  return (
    <div
      className="relative w-[340px] rounded-2xl cursor-pointer overflow-hidden select-none"
      style={{
        background:
          "linear-gradient(135deg, rgba(22,22,26,0.96) 0%, rgba(32,32,38,0.94) 50%, rgba(18,18,22,0.97) 100%)",
        boxShadow: [
          `0 0 0 1px rgba(255,255,255,0.07)`,
          `0 8px 32px rgba(0,0,0,0.4)`,
          `0 2px 8px rgba(0,0,0,0.3)`,
          `0 0 20px rgba(${accent.rgb}, 0.08)`,
        ].join(", "),
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate?.(notification.id);
        onDismiss();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.stopPropagation();
          onActivate?.(notification.id);
          onDismiss();
        }
      }}
    >
      {/* Subtle top highlight */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent 10%, rgba(${accent.rgb}, 0.3) 50%, transparent 90%)`,
        }}
      />

      {/* Glass sheen */}
      <div
        className="absolute inset-0 pointer-events-none rounded-2xl"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 40%)",
        }}
      />

      {/* Content */}
      <div className="relative flex items-start gap-3 px-3.5 py-3">
        {/* App icon with accent glow */}
        <motion.div
          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${getAppColorGradient(notification.appName)} flex items-center justify-center flex-shrink-0`}
          style={{
            border: `1px solid rgba(${accent.rgb}, 0.25)`,
            boxShadow: `0 0 12px rgba(${accent.rgb}, 0.15)`,
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 25, delay: 0.05 }}
        >
          <span className="text-white text-[13px] font-bold uppercase tracking-wide">
            {notification.appName.charAt(0)}
          </span>
        </motion.div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <motion.span
              className="text-[12px] font-semibold tracking-wide"
              style={{ color: accent.hex, textShadow: `0 0 8px rgba(${accent.rgb}, 0.3)` }}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: 0.08 }}
            >
              {notification.appName}
            </motion.span>
            <motion.span
              className="text-white/40 text-[10px] font-medium uppercase tracking-wider"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              just now
            </motion.span>
          </div>

          <motion.h4
            className="text-white text-[13px] font-semibold truncate mt-0.5 leading-snug"
            title={notification.title || undefined}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            {notification.title || "Notification"}
          </motion.h4>

          {notification.body && (
            <motion.p
              className="text-white/65 text-[12px] line-clamp-2 mt-0.5 leading-relaxed"
              title={notification.body}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.15 }}
            >
              {notification.body}
            </motion.p>
          )}
        </div>

        {/* Dismiss X button */}
        <motion.button
          className="w-5 h-5 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors flex-shrink-0 mt-0.5"
          aria-label="Dismiss notification"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              onDismiss();
            }
          }}
        >
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </motion.button>
      </div>

      {/* Auto-dismiss progress bar */}
      {phase === "incoming" && (
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] rounded-full"
          style={{
            background: `linear-gradient(90deg, rgba(${accent.rgb}, 0.6), rgba(${accent.rgb}, 0.2))`,
          }}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 3.5, ease: "linear" }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Notification Card (For list view)
// =============================================================================

interface NotificationCardProps {
  notification: SystemNotification;
  onDismiss: (id: number) => void;
  onActivate?: (id: number) => void;
}

export function NotificationCard({ notification, onDismiss, onActivate }: NotificationCardProps) {
  // Format timestamp
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleActivate = () => {
    onActivate?.(notification.id);
  };

  return (
    <motion.div
      className="bg-white/5 rounded-md p-2 hover:bg-white/[0.08] transition-colors group cursor-pointer"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: PILL_DURATION_FAST }}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      role="button"
      tabIndex={0}
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
          <div className="flex items-center justify-between gap-pill-xs">
            <span
              className="text-pill-muted text-pill-sm truncate"
              title={notification.appName}
            >
              {notification.appName}
            </span>
            <span className="text-white/70 text-pill-xs flex-shrink-0">{formatTime(notification.timestamp)}</span>
          </div>
          <h4
            className="text-white text-pill-md font-medium truncate mt-pill-xs"
            title={notification.title || undefined}
          >
            {notification.title || "Notification"}
          </h4>
          {notification.body && (
            <p
              className="text-pill-muted text-pill-sm line-clamp-2 mt-pill-xs"
              title={notification.body}
            >
              {notification.body}
            </p>
          )}
        </div>

        {/* Dismiss button */}
        <motion.button
          className="w-4 h-4 rounded flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          aria-label={`Dismiss notification from ${notification.appName}`}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(notification.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onDismiss(notification.id);
            }
          }}
          {...microInteractions.icon}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
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
  onActivate?: (id: number) => void;
}

export function NotificationsList({ notifications, hasAccess, onDismiss, onActivate }: NotificationsListProps) {
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
    <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-0.5">
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
            onActivate={onActivate}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
