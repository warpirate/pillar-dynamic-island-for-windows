// Reduced motion detection helper
const getPrefersReducedMotion = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Helper to get reduced motion transition
const getReducedMotionTransition = (baseTransition: any) => {
  if (getPrefersReducedMotion()) {
    return {
      duration: 0.1,
      ease: "easeOut",
    };
  }
  return baseTransition;
};

// Check reduced motion preference (can be called reactively in components)
export const prefersReducedMotion = getPrefersReducedMotion();

// Spring configurations for different animation types
export const springConfig = {
  // Default spring - balanced feel
  default: {
    type: "spring" as const,
    stiffness: 220,
    damping: 25,
    mass: 1,
  },

  // Snappy spring - quick response
  snappy: {
    type: "spring" as const,
    stiffness: 300,
    damping: 28,
    mass: 0.8,
  },

  // Gentle spring - smooth expansion
  gentle: {
    type: "spring" as const,
    stiffness: 180,
    damping: 22,
    mass: 1.2,
  },

  // Bouncy spring - playful overshoot
  bouncy: {
    type: "spring" as const,
    stiffness: 260,
    damping: 18,
    mass: 1,
  },
};

// Standardized motion tokens for consistent animations
export const PILL_SPRING_PRIMARY = getReducedMotionTransition(springConfig.snappy);
export const PILL_SPRING_SUBTLE = getReducedMotionTransition(springConfig.gentle);
export const PILL_SPRING_BOUNCY = getReducedMotionTransition(springConfig.bouncy);

// Duration tokens
export const PILL_DURATION_FAST = prefersReducedMotion ? 0.05 : 0.15;
export const PILL_DURATION_MEDIUM = prefersReducedMotion ? 0.1 : 0.25;
export const PILL_DURATION_SLOW = prefersReducedMotion ? 0.15 : 0.4;

// Micro-interaction configs
export const microInteractions = {
  button: {
    whileHover: prefersReducedMotion ? {} : { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: PILL_SPRING_PRIMARY,
  },
  icon: {
    whileHover: prefersReducedMotion ? {} : { scale: 1.1 },
    whileTap: { scale: 0.9 },
    transition: PILL_SPRING_PRIMARY,
  },
  card: {
    whileHover: prefersReducedMotion ? {} : { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: PILL_SPRING_SUBTLE,
  },
};

// Pill dimension configurations
// Note: These are logical dimensions (DPI-aware via Tauri's LogicalSize)
// Tauri automatically handles scale factor conversion, so these values work correctly
// across different DPI displays without manual scaling
export const pillDimensions = {
  boot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  idle: {
    width: 120,
    height: 36,
    borderRadius: 18,
  },
  // Wider idle state when notifications are present
  idleWithNotifications: {
    width: 170,
    height: 36,
    borderRadius: 18,
  },
  hover: {
    width: 160,
    height: 40,
    borderRadius: 20,
  },
  // Wider hover state when notifications are present
  hoverWithNotifications: {
    width: 200,
    height: 40,
    borderRadius: 20,
  },
  expanded: {
    width: 380,
    height: 280,
    borderRadius: 28,
  },
} as const;

// Dimension tokens for consistent reference
export const PILL_WIDTH_IDLE = pillDimensions.idle.width;
export const PILL_WIDTH_EXPANDED = pillDimensions.expanded.width;
export const PILL_HEIGHT_IDLE = pillDimensions.idle.height;
export const PILL_HEIGHT_EXPANDED = pillDimensions.expanded.height;

// Notification animation configurations
export const notificationAnimations = {
  // Toast appearing below pill
  toast: {
    initial: prefersReducedMotion 
      ? { opacity: 0 } 
      : { y: 50, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: prefersReducedMotion 
      ? { opacity: 0 } 
      : { y: -30, opacity: 0, scale: 0.5 },
  },
  // Badge appearing in pill
  badge: {
    initial: prefersReducedMotion 
      ? { opacity: 0 } 
      : { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: prefersReducedMotion 
      ? { opacity: 0 } 
      : { scale: 0, opacity: 0 },
  },
  // Pulse effect for new notifications (disabled for reduced motion)
  pulse: prefersReducedMotion 
    ? {} 
    : {
        scale: [1, 1.15, 1],
        transition: { duration: PILL_DURATION_MEDIUM },
      },
  // Spring config for notification animations
  spring: getReducedMotionTransition({
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  }),
  // Gentler spring for absorption animation
  absorptionSpring: getReducedMotionTransition({
    type: "spring" as const,
    stiffness: 300,
    damping: 25,
    mass: 1,
  }),
};

// Animation variants for the pill
export const pillVariants = {
  boot: {
    width: pillDimensions.boot.width,
    height: pillDimensions.boot.height,
    borderRadius: pillDimensions.boot.borderRadius,
    opacity: 0,
    scale: 0,
  },
  bootVisible: {
    width: pillDimensions.boot.width,
    height: pillDimensions.boot.height,
    borderRadius: pillDimensions.boot.borderRadius,
    opacity: 1,
    scale: 1,
  },
  idle: {
    width: pillDimensions.idle.width,
    height: pillDimensions.idle.height,
    borderRadius: pillDimensions.idle.borderRadius,
    opacity: 1,
    scale: 1,
  },
  hover: {
    width: pillDimensions.hover.width,
    height: pillDimensions.hover.height,
    borderRadius: pillDimensions.hover.borderRadius,
    opacity: 1,
    scale: 1,
  },
  expanded: {
    width: pillDimensions.expanded.width,
    height: pillDimensions.expanded.height,
    borderRadius: pillDimensions.expanded.borderRadius,
    opacity: 1,
    scale: 1,
  },
};

// Boot animation sequence duration in ms
export const bootAnimationDuration = {
  dotAppear: 200,
  dotToMorphDelay: 100,
  morphToPill: 600,
  total: 900,
};

// Single source of truth: target dimensions + blur/shadow for current interaction state.
// Use this in one place so hover/expanded/unhover logic stays simple and animations stay smooth.
export type PillVisualState = "idle" | "hover" | "expanded";

export function getPillTargetStyle(
  state: PillVisualState,
  hasNotificationBadge: boolean
): { width: number; height: number; borderRadius: number; blur: number; shadow: number } {
  if (state === "expanded") {
    const d = pillDimensions.expanded;
    return { ...d, blur: 16, shadow: 0.35 };
  }
  if (state === "hover") {
    const d = hasNotificationBadge ? pillDimensions.hoverWithNotifications : pillDimensions.hover;
    return { ...d, blur: 12, shadow: 0.25 };
  }
  const d = hasNotificationBadge ? pillDimensions.idleWithNotifications : pillDimensions.idle;
  return { ...d, blur: 8, shadow: 0.2 };
}

// Idle pill slot animations (media, timer, notification badge) — enter/exit when active or turned off
export const idleSlotAnimations = {
  left: {
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: -10 },
  },
  center: {
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 },
  },
  right: {
    initial: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 10 },
  },
  transition: getReducedMotionTransition({
    type: "spring" as const,
    stiffness: 520,
    damping: 36,
    duration: PILL_DURATION_FAST,
  }),
};
