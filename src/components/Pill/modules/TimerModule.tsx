import { motion } from "motion/react";
import type { TimerState } from "../../../hooks/useTimer";
import type { TimerPreset } from "../../../types/pill";
import { microInteractions } from "../animations";

// =============================================================================
// Timer Progress Ring (for idle/hover pill)
// =============================================================================

interface TimerProgressRingProps {
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  isAlert?: boolean;
}

export function TimerProgressRing({ 
  progress, 
  size = 36, 
  strokeWidth = 2,
  isAlert = false,
}: TimerProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <svg
      width={size}
      height={size}
      className="absolute -inset-0.5 pointer-events-none"
      style={{ transform: "rotate(-90deg)" }}
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isAlert ? "#ef4444" : "#22c55e"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ 
          strokeDashoffset,
          stroke: isAlert ? "#ef4444" : "#22c55e",
        }}
        transition={{ duration: 0.3 }}
        style={{
          filter: isAlert ? "drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))" : undefined,
        }}
      />
    </svg>
  );
}

// =============================================================================
// Timer Compact View (for idle/hover state)
// =============================================================================

interface TimerCompactProps {
  timer: TimerState;
  formatTime: (seconds: number) => string;
  progress: number;
}

export function TimerCompact({ timer, formatTime, progress }: TimerCompactProps) {
  if (!timer.isActive && !timer.isComplete) return null;

  return (
    <div className="relative flex items-center gap-2">
      <TimerProgressRing 
        progress={progress} 
        size={40} 
        strokeWidth={2}
        isAlert={timer.isComplete}
      />
      <span 
        className="text-[13px] font-medium tabular-nums"
        style={{ 
          color: timer.isComplete ? "#ef4444" : "#ffffff",
          textShadow: timer.isComplete ? "0 0 8px rgba(239, 68, 68, 0.5)" : undefined,
        }}
      >
        {timer.isComplete ? "Done!" : formatTime(timer.remainingSeconds)}
      </span>
    </div>
  );
}

// =============================================================================
// Timer Alert View (when timer completes - high priority)
// =============================================================================

interface TimerAlertProps {
  label: string;
  onDismiss: () => void;
}

export function TimerAlert({ label, onDismiss }: TimerAlertProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-1.5 py-1"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Pulsing ring */}
      <motion.div
        className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(239, 68, 68, 0.4)",
            "0 0 0 6px rgba(239, 68, 68, 0)",
          ],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeOut",
        }}
      >
        <span className="text-base">⏰</span>
      </motion.div>
      
      <span className="text-white font-semibold text-[13px]">{label}</span>
      <span className="text-white/90 text-[12px]">Time's up!</span>
      
      <motion.button
        className="mt-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-[12px] font-medium"
        aria-label="Dismiss timer alert"
        {...microInteractions.button}
        onClick={onDismiss}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDismiss();
          }
        }}
      >
        Dismiss
      </motion.button>
    </motion.div>
  );
}

// =============================================================================
// Timer Expanded View (full controls)
// =============================================================================

interface TimerExpandedProps {
  timer: TimerState;
  presets: TimerPreset[];
  formatTime: (seconds: number) => string;
  progress: number;
  onStart: (preset: TimerPreset) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDismiss: () => void;
}

export function TimerExpanded({
  timer,
  presets,
  formatTime,
  progress,
  onStart,
  onPause,
  onResume,
  onStop,
  onDismiss,
}: TimerExpandedProps) {
  // Timer is complete - show alert
  if (timer.isComplete) {
    return <TimerAlert label={timer.label} onDismiss={onDismiss} />;
  }

  // Timer is running
  if (timer.isActive) {
    const ringSize = 72;
    const r = 32;
    const circ = r * 2 * Math.PI;
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        {/* Progress ring */}
        <div className="relative w-[72px] h-[72px] flex items-center justify-center">
          <svg
            width={ringSize}
            height={ringSize}
            className="absolute inset-0"
            style={{ transform: "rotate(-90deg)" }}
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth={3}
            />
            <motion.circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke={timer.isPaused ? "#f59e0b" : "#22c55e"}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={circ}
              animate={{ strokeDashoffset: circ * (1 - progress) }}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <div className="flex flex-col items-center">
            <span className="text-lg font-bold text-white tabular-nums">
              {formatTime(timer.remainingSeconds)}
            </span>
            <span className="text-[12px] text-white/85">{timer.label}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2" role="group" aria-label="Timer controls">
          {timer.isPaused ? (
            <motion.button
              className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-[12px] font-medium"
              aria-label="Resume timer"
              {...microInteractions.button}
              onClick={onResume}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onResume();
                }
              }}
            >
              Resume
            </motion.button>
          ) : (
            <motion.button
              className="px-3 py-1.5 rounded-pill-md bg-pill-warning-light text-pill-warning text-pill-base font-medium"
              aria-label="Pause timer"
              {...microInteractions.button}
              onClick={onPause}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onPause();
                }
              }}
            >
              Pause
            </motion.button>
          )}
          <motion.button
            className="px-3 py-1.5 rounded-pill-md bg-pill-muted-lightest text-pill-muted text-pill-base font-medium"
            aria-label="Stop timer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStop}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStop();
              }
            }}
          >
            Stop
          </motion.button>
        </div>
      </div>
    );
  }

  // No timer - show presets
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-white/90 text-[12px] text-center uppercase tracking-wider">
        Start Timer
      </span>
      <div className="flex flex-wrap gap-1.5 justify-center" role="group" aria-label="Timer presets">
        {presets.map(preset => (
          <motion.button
            key={preset.id}
            className="px-3 py-1.5 rounded-pill-md bg-pill-muted-lightest text-pill-muted text-pill-base font-medium"
            aria-label={`Start ${preset.label} timer for ${preset.workMinutes} minutes`}
            {...microInteractions.button}
            onClick={() => onStart(preset)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onStart(preset);
              }
            }}
          >
            {preset.label}
            <span className="ml-0.5 text-white/75" aria-hidden="true">{preset.workMinutes}m</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
