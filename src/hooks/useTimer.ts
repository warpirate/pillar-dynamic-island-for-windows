import { useState, useCallback, useRef, useEffect } from "react";
import type { TimerPreset } from "../types/pill";
import { TIMER_PRESETS } from "../types/pill";

// =============================================================================
// Types
// =============================================================================

export interface TimerState {
  isActive: boolean;
  isPaused: boolean;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isComplete: boolean;
}

interface UseTimerReturn {
  timer: TimerState;
  presets: TimerPreset[];
  startTimer: (preset: TimerPreset | { label: string; minutes: number }) => void;
  startCustomTimer: (label: string, minutes: number) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  dismissAlert: () => void;
  formatTime: (seconds: number) => string;
  progress: number; // 0-1, for progress ring
}

// =============================================================================
// Hook
// =============================================================================

export function useTimer(
  onTimerUpdate?: (timer: TimerState) => void,
  onTimerComplete?: (label: string) => void
): UseTimerReturn {
  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    isPaused: false,
    label: "",
    totalSeconds: 0,
    remainingSeconds: 0,
    isComplete: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimerUpdateRef = useRef(onTimerUpdate);
  const onTimerCompleteRef = useRef(onTimerComplete);
  
  // Keep refs updated
  onTimerUpdateRef.current = onTimerUpdate;
  onTimerCompleteRef.current = onTimerComplete;

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Notify parent of timer updates
  useEffect(() => {
    if (onTimerUpdateRef.current) {
      onTimerUpdateRef.current(timer);
    }
  }, [timer]);

  const clearTimerInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback((preset: TimerPreset | { label: string; minutes: number }) => {
    clearTimerInterval();
    
    const minutes = "workMinutes" in preset ? preset.workMinutes : preset.minutes;
    const totalSeconds = minutes * 60;
    const label = preset.label;

    setTimer({
      isActive: true,
      isPaused: false,
      label,
      totalSeconds,
      remainingSeconds: totalSeconds,
      isComplete: false,
    });

    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev.isPaused || !prev.isActive) return prev;
        
        const newRemaining = prev.remainingSeconds - 1;
        
        if (newRemaining <= 0) {
          clearTimerInterval();
          if (onTimerCompleteRef.current) {
            onTimerCompleteRef.current(prev.label);
          }
          return {
            ...prev,
            remainingSeconds: 0,
            isActive: false,
            isComplete: true,
          };
        }
        
        return {
          ...prev,
          remainingSeconds: newRemaining,
        };
      });
    }, 1000);
  }, [clearTimerInterval]);

  const startCustomTimer = useCallback((label: string, minutes: number) => {
    startTimer({ label, minutes });
  }, [startTimer]);

  const pauseTimer = useCallback(() => {
    setTimer(prev => ({ ...prev, isPaused: true }));
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer(prev => ({ ...prev, isPaused: false }));
  }, []);

  const stopTimer = useCallback(() => {
    clearTimerInterval();
    setTimer({
      isActive: false,
      isPaused: false,
      label: "",
      totalSeconds: 0,
      remainingSeconds: 0,
      isComplete: false,
    });
  }, [clearTimerInterval]);

  const dismissAlert = useCallback(() => {
    setTimer(prev => ({ ...prev, isComplete: false }));
  }, []);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }, []);

  const progress = timer.totalSeconds > 0 
    ? timer.remainingSeconds / timer.totalSeconds 
    : 0;

  return {
    timer,
    presets: TIMER_PRESETS,
    startTimer,
    startCustomTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    dismissAlert,
    formatTime,
    progress,
  };
}
