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

// Pill dimension configurations
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
};

// Notification animation configurations
export const notificationAnimations = {
  // Toast appearing below pill
  toast: {
    initial: { y: 50, opacity: 0, scale: 0.8 },
    animate: { y: 0, opacity: 1, scale: 1 },
    exit: { y: -30, opacity: 0, scale: 0.5 },
  },
  // Badge appearing in pill
  badge: {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0, opacity: 0 },
  },
  // Pulse effect for new notifications
  pulse: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.3 },
  },
  // Spring config for notification animations
  spring: {
    type: "spring" as const,
    stiffness: 400,
    damping: 30,
    mass: 0.8,
  },
  // Gentler spring for absorption animation
  absorptionSpring: {
    type: "spring" as const,
    stiffness: 300,
    damping: 25,
    mass: 1,
  },
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
