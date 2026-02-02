import { motion, useTransform, useMotionValue, type MotionValue } from "motion/react";
import { useEffect } from "react";
import type { ContentState } from "../../../types/pill";

// =============================================================================
// State Indicator Dots
// Shows background states when a higher-priority state is active
// =============================================================================

interface StateIndicatorsProps {
  states: ContentState[];
  position?: "left" | "right";
}

const STATE_COLORS: Record<string, string> = {
  timer_running: "#22c55e", // Green
  timer_alert: "#ef4444",   // Red
  media: "#3b82f6",         // Blue
  notification: "#f59e0b",  // Amber
};

export function StateIndicators({ states, position = "right" }: StateIndicatorsProps) {
  if (states.length === 0) return null;

  return (
    <div 
      className={`absolute top-1/2 -translate-y-1/2 flex gap-1 ${
        position === "left" ? "left-2" : "right-2"
      }`}
    >
      {states.slice(0, 3).map((state, index) => (
        <motion.div
          key={state.id}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: STATE_COLORS[state.type] || "#666" }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            opacity: 0.8,
            // Pulse for alert states
            ...(state.type === "timer_alert" && {
              boxShadow: [
                "0 0 0 0 rgba(239, 68, 68, 0.4)",
                "0 0 0 4px rgba(239, 68, 68, 0)",
              ],
            }),
          }}
          transition={{
            delay: index * 0.05,
            ...(state.type === "timer_alert" && {
              boxShadow: { duration: 1, repeat: Infinity },
            }),
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Media Playing Indicator (animated bars)
// =============================================================================

interface MediaIndicatorProps {
  isPlaying: boolean;
}

export function MediaIndicator({ isPlaying }: MediaIndicatorProps) {
  return (
    <div className="flex items-end gap-0.5 h-3">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-0.5 bg-blue-400 rounded-full"
          animate={{
            height: isPlaying 
              ? ["4px", "12px", "6px", "10px", "4px"]
              : "4px",
          }}
          transition={{
            duration: 0.8,
            repeat: isPlaying ? Infinity : 0,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Timer Mini Progress (arc around the pill edge)
// Animates in sync with pill width/height springs on hover
// =============================================================================

interface TimerMiniProgressProps {
  progress: number; // 0-1
  width: MotionValue<number>;
  height: MotionValue<number>;
}

export function TimerMiniProgress({ progress, width, height }: TimerMiniProgressProps) {
  const strokeWidth = 2;
  const padding = 1;

  // Derive rect dimensions and perimeter from pill's animated width/height
  const rectWidth = useTransform(width, (w) => Math.max(0, w - 2 * padding));
  const rectHeight = useTransform(height, (h) => Math.max(0, h - 2 * padding));
  const rx = useTransform(height, (h) => Math.max(0, h / 2 - padding));
  const perimeter = useTransform([width, height], ([w, h]: (number | undefined)[]) => {
    const widthNum = typeof w === "number" ? w : 0;
    const heightNum = typeof h === "number" ? h : 0;
    const r = Math.max(0, heightNum / 2 - padding);
    const straight = 2 * Math.max(0, widthNum - 2 * r);
    const curved = 2 * Math.PI * r;
    return straight + curved;
  });

  // Progress as motion value so dashOffset updates when progress or perimeter changes
  const progressVal = useMotionValue(progress);
  useEffect(() => {
    progressVal.set(progress);
  }, [progress, progressVal]);
  const dashOffset = useTransform(
    [perimeter, progressVal],
    ([p, prog]: (number | undefined)[]) => {
      const perim = typeof p === "number" ? p : 0;
      const progNum = typeof prog === "number" ? prog : 0;
      return perim * (1 - progNum);
    }
  );

  return (
    <motion.svg
      className="absolute inset-0 pointer-events-none"
      style={{
        width,
        height,
        overflow: "visible",
      }}
    >
      <motion.rect
        x={padding}
        y={padding}
        width={rectWidth}
        height={rectHeight}
        rx={rx}
        fill="none"
        stroke="rgba(255, 255, 255, 0.05)"
        strokeWidth={strokeWidth}
      />
      <motion.rect
        x={padding}
        y={padding}
        width={rectWidth}
        height={rectHeight}
        rx={rx}
        fill="none"
        stroke="#22c55e"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={perimeter}
        strokeDashoffset={dashOffset}
        style={{
          filter: "drop-shadow(0 0 2px rgba(34, 197, 94, 0.3))",
        }}
      />
    </motion.svg>
  );
}
