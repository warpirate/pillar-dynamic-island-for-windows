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
  hover: {
    width: 160,
    height: 40,
    borderRadius: 20,
  },
  expanded: {
    width: 360,
    height: 220,
    borderRadius: 28,
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
