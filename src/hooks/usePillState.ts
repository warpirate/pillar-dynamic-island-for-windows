import { useState, useCallback, useRef, useEffect, useMemo, useContext, createContext } from "react";
import type { 
  InteractionState, 
  ContentState, 
  ContentStateType,
  TimerRunningState,
  TimerAlertState,
  MediaState,
  NotificationState,
} from "../types/pill";
import { createContentState } from "../types/pill";

// =============================================================================
// Timing Constants
// =============================================================================

const HOVER_DELAY_MS = 100;
const EXIT_DELAY_MS = 120;
const NOTIFICATION_DURATION_MS = 5000;

// =============================================================================
// Types
// =============================================================================

export type { InteractionState, ContentState, ContentStateType };

interface PillStateContextValue {
  // Interaction state (hover, expanded, etc.)
  interactionState: InteractionState;
  isBooting: boolean;
  isIdle: boolean;
  isHovering: boolean;
  isExpanded: boolean;
  
  // Content states (multiple can be active)
  contentStates: ContentState[];
  activeContentState: ContentState | null; // Highest priority
  backgroundStates: ContentState[]; // Lower priority states shown as indicators
  
  // Interaction handlers
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleClick: () => void;
  handleClickOutside: () => void;
  completeBootAnimation: () => void;
  
  // Content state management
  addContentState: (state: ContentState) => void;
  removeContentState: (id: string) => void;
  updateContentState: (id: string, updates: Record<string, unknown>) => void;
  clearContentStates: (type?: ContentStateType) => void;
  
  // Convenience methods for specific states
  setTimerState: (timer: TimerRunningState["data"] | null) => void;
  setTimerAlert: (alert: TimerAlertState["data"] | null) => void;
  setMediaState: (media: MediaState["data"] | null) => void;
  showNotification: (notification: Omit<NotificationState["data"], "expiresAt">) => void;
}

// =============================================================================
// Context
// =============================================================================

const PillStateContext = createContext<PillStateContextValue | null>(null);

export function usePillStateContext(): PillStateContextValue {
  const context = useContext(PillStateContext);
  if (!context) {
    throw new Error("usePillStateContext must be used within PillStateProvider");
  }
  return context;
}

// =============================================================================
// Legacy Hook (for backward compatibility with Pill.tsx)
// =============================================================================

interface UsePillStateReturn {
  state: InteractionState;
  isBooting: boolean;
  isIdle: boolean;
  isHovering: boolean;
  isExpanded: boolean;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleClick: () => void;
  handleClickOutside: () => void;
  completeBootAnimation: () => void;
  
  // New content state API
  contentStates: ContentState[];
  activeContentState: ContentState | null;
  backgroundStates: ContentState[];
  addContentState: (state: ContentState) => void;
  removeContentState: (id: string) => void;
  updateContentState: (id: string, updates: Record<string, unknown>) => void;
  clearContentStates: (type?: ContentStateType) => void;
  setTimerState: (timer: TimerRunningState["data"] | null) => void;
  setTimerAlert: (alert: TimerAlertState["data"] | null) => void;
  setMediaState: (media: MediaState["data"] | null) => void;
  showNotification: (notification: Omit<NotificationState["data"], "expiresAt">) => void;
}

export function usePillState(): UsePillStateReturn {
  // Interaction state
  const [interactionState, setInteractionState] = useState<InteractionState>("boot");
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionStateRef = useRef<InteractionState>(interactionState);
  interactionStateRef.current = interactionState;

  // Content states (multiple can be active simultaneously)
  const [contentStates, setContentStates] = useState<ContentState[]>([]);

  // ==========================================================================
  // Content State Management
  // ==========================================================================

  const addContentState = useCallback((state: ContentState) => {
    setContentStates(prev => {
      // Remove any existing state of the same type (except notifications which can stack)
      const filtered = state.type === "notification" 
        ? prev 
        : prev.filter(s => s.type !== state.type);
      return [...filtered, state].sort((a, b) => b.priority - a.priority);
    });
  }, []);

  const removeContentState = useCallback((id: string) => {
    setContentStates(prev => prev.filter(s => s.id !== id));
  }, []);

  const updateContentState = useCallback((
    id: string, 
    updates: Record<string, unknown>
  ) => {
    setContentStates(prev => prev.map(s => {
      if (s.id !== id) return s;
      if ("data" in s && s.data) {
        return { ...s, data: { ...(s.data as Record<string, unknown>), ...updates } } as ContentState;
      }
      return s;
    }));
  }, []);

  const clearContentStates = useCallback((type?: ContentStateType) => {
    if (type) {
      setContentStates(prev => prev.filter(s => s.type !== type));
    } else {
      setContentStates([]);
    }
  }, []);

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  const setTimerState = useCallback((timer: TimerRunningState["data"] | null) => {
    if (timer === null) {
      setContentStates(prev => prev.filter(s => s.type !== "timer_running"));
    } else {
      const state = createContentState<TimerRunningState>("timer_running", timer);
      addContentState(state);
    }
  }, [addContentState]);

  const setTimerAlert = useCallback((alert: TimerAlertState["data"] | null) => {
    if (alert === null) {
      setContentStates(prev => prev.filter(s => s.type !== "timer_alert"));
    } else {
      const state = createContentState<TimerAlertState>("timer_alert", alert);
      addContentState(state);
    }
  }, [addContentState]);

  const setMediaState = useCallback((media: MediaState["data"] | null) => {
    if (media === null) {
      setContentStates(prev => prev.filter(s => s.type !== "media"));
    } else {
      const state = createContentState<MediaState>("media", media);
      addContentState(state);
    }
  }, [addContentState]);

  const showNotification = useCallback((
    notification: Omit<NotificationState["data"], "expiresAt">
  ) => {
    const state = createContentState<NotificationState>("notification", {
      ...notification,
      expiresAt: Date.now() + NOTIFICATION_DURATION_MS,
    });
    addContentState(state);

    // Auto-remove notification after expiry
    setTimeout(() => {
      removeContentState(state.id);
    }, NOTIFICATION_DURATION_MS);
  }, [addContentState, removeContentState]);

  // ==========================================================================
  // Derived Content State
  // ==========================================================================

  const { activeContentState, backgroundStates } = useMemo(() => {
    if (contentStates.length === 0) {
      return { activeContentState: null, backgroundStates: [] };
    }
    // States are already sorted by priority (highest first)
    const [active, ...background] = contentStates;
    return { activeContentState: active, backgroundStates: background };
  }, [contentStates]);

  // ==========================================================================
  // Interaction State Management (legacy behavior)
  // ==========================================================================

  const clearAllTimeouts = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearAllTimeouts;
  }, [clearAllTimeouts]);

  const completeBootAnimation = useCallback(() => {
    setInteractionState("idle");
  }, []);

  const handleMouseEnter = useCallback(() => {
    const currentState = interactionStateRef.current;
    if (currentState === "boot") return;

    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    if (currentState === "expanded") return;

    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      const s = interactionStateRef.current;
      if (s === "idle") {
        setInteractionState("hover");
      }
    }, HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    const currentState = interactionStateRef.current;
    
    if (currentState === "hover" || currentState === "expanded") {
      const delay = currentState === "expanded" ? EXIT_DELAY_MS * 3 : EXIT_DELAY_MS;
      
      exitTimeoutRef.current = setTimeout(() => {
        const s = interactionStateRef.current;
        if (s === "hover" || s === "expanded") {
          setInteractionState("idle");
        }
      }, delay);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (interactionStateRef.current === "hover") {
      setInteractionState("expanded");
    }
  }, []);

  const handleClickOutside = useCallback(() => {
    if (interactionStateRef.current === "expanded") {
      setInteractionState("idle");
    }
  }, []);

  // ==========================================================================
  // Derived Interaction State
  // ==========================================================================

  const derivedInteractionState = useMemo(() => ({
    isBooting: interactionState === "boot",
    isIdle: interactionState === "idle",
    isHovering: interactionState === "hover",
    isExpanded: interactionState === "expanded",
  }), [interactionState]);

  return {
    state: interactionState,
    ...derivedInteractionState,
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
    handleClickOutside,
    completeBootAnimation,
    
    // Content state API
    contentStates,
    activeContentState,
    backgroundStates,
    addContentState,
    removeContentState,
    updateContentState,
    clearContentStates,
    setTimerState,
    setTimerAlert,
    setMediaState,
    showNotification,
  };
}
