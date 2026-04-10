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

export interface TimerStats {
  sessionsCompleted: number;
  totalFocusSeconds: number;
  lastCompletedAt: number | null;
  byCategory: Record<string, { sessions: number; focusSeconds: number }>;
}

export interface TimerCategory {
  id: string;
  label: string;
}

const TIMER_CATEGORIES: TimerCategory[] = [
  { id: "focus", label: "Focus" },
  { id: "study", label: "Study" },
  { id: "work", label: "Work" },
  { id: "personal", label: "Personal" },
];

interface UseTimerReturn {
  timer: TimerState;
  presets: TimerPreset[];
  startTimer: (preset: TimerPreset | { label: string; minutes: number }) => void;
  startCustomTimer: (label: string, minutes: number) => void;
  categories: TimerCategory[];
  selectedCategory: string;
  setSelectedCategory: (categoryId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  dismissAlert: () => void;
  stats: TimerStats;
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
  const TIMER_STATS_KEY = "pillar_timer_stats_v1";
  const TIMER_CATEGORY_KEY = "pillar_timer_category_v1";
  const [timer, setTimer] = useState<TimerState>({
    isActive: false,
    isPaused: false,
    label: "",
    totalSeconds: 0,
    remainingSeconds: 0,
    isComplete: false,
  });
  const [stats, setStats] = useState<TimerStats>(() => {
    try {
      const raw = localStorage.getItem(TIMER_STATS_KEY);
      if (raw) {
        return JSON.parse(raw) as TimerStats;
      }
    } catch {
      // ignore parse/storage error
    }
    return {
      sessionsCompleted: 0,
      totalFocusSeconds: 0,
      lastCompletedAt: null,
      byCategory: {},
    };
  });
  const [selectedCategory, setSelectedCategoryState] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(TIMER_CATEGORY_KEY);
      if (raw && TIMER_CATEGORIES.some((c) => c.id === raw)) {
        return raw;
      }
    } catch {
      // ignore storage errors
    }
    return TIMER_CATEGORIES[0].id;
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

  useEffect(() => {
    try {
      localStorage.setItem(TIMER_STATS_KEY, JSON.stringify(stats));
    } catch {
      // ignore storage errors
    }
  }, [stats]);

  useEffect(() => {
    try {
      localStorage.setItem(TIMER_CATEGORY_KEY, selectedCategory);
    } catch {
      // ignore storage errors
    }
  }, [selectedCategory]);

  const setSelectedCategory = useCallback((categoryId: string) => {
    if (!TIMER_CATEGORIES.some((c) => c.id === categoryId)) return;
    setSelectedCategoryState(categoryId);
  }, []);

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
          setStats((prevStats) => ({
            sessionsCompleted: prevStats.sessionsCompleted + 1,
            totalFocusSeconds: prevStats.totalFocusSeconds + prev.totalSeconds,
            lastCompletedAt: Date.now(),
            byCategory: {
              ...prevStats.byCategory,
              [selectedCategory]: {
                sessions: (prevStats.byCategory[selectedCategory]?.sessions ?? 0) + 1,
                focusSeconds: (prevStats.byCategory[selectedCategory]?.focusSeconds ?? 0) + prev.totalSeconds,
              },
            },
          }));
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
  }, [clearTimerInterval, selectedCategory]);

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
    categories: TIMER_CATEGORIES,
    selectedCategory,
    setSelectedCategory,
    pauseTimer,
    resumeTimer,
    stopTimer,
    dismissAlert,
    stats,
    formatTime,
    progress,
  };
}
