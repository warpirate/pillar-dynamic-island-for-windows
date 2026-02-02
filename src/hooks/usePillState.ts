import { useState, useCallback, useRef, useEffect, useMemo } from "react";

export type PillState = "boot" | "idle" | "hover" | "expanded";

interface UsePillStateReturn {
  state: PillState;
  isBooting: boolean;
  isIdle: boolean;
  isHovering: boolean;
  isExpanded: boolean;
  handleMouseEnter: () => void;
  handleMouseLeave: () => void;
  handleClick: () => void;
  handleClickOutside: () => void;
  completeBootAnimation: () => void;
}

// Timing constants - centralized for easy tuning
const HOVER_DELAY_MS = 100;  // Delay before hover activates (prevents accidental triggers)
const EXIT_DELAY_MS = 120;   // Delay before returning to idle

export function usePillState(): UsePillStateReturn {
  const [state, setState] = useState<PillState>("boot");
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Use ref to track state in callbacks without causing re-renders
  const stateRef = useRef<PillState>(state);
  stateRef.current = state;

  // Clear all timeouts helper
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

  // Clear timeouts on unmount
  useEffect(() => {
    return clearAllTimeouts;
  }, [clearAllTimeouts]);

  const completeBootAnimation = useCallback(() => {
    setState("idle");
  }, []);

  const handleMouseEnter = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState === "boot") return;

    // Clear any pending exit timeout
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    // If already expanded, don't try to hover
    if (currentState === "expanded") return;

    // Delay hover activation to prevent accidental triggers
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      const s = stateRef.current;
      if (s === "idle") {
        setState("hover");
      }
    }, HOVER_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Clear pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    const currentState = stateRef.current;
    
    // Collapse on mouse exit (both hover and expanded states)
    if (currentState === "hover" || currentState === "expanded") {
      // Longer delay for expanded state to give user time to return
      const delay = currentState === "expanded" ? EXIT_DELAY_MS * 3 : EXIT_DELAY_MS;
      
      exitTimeoutRef.current = setTimeout(() => {
        const s = stateRef.current;
        if (s === "hover" || s === "expanded") {
          setState("idle");
        }
      }, delay);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (stateRef.current === "hover") {
      setState("expanded");
    }
  }, []);

  const handleClickOutside = useCallback(() => {
    if (stateRef.current === "expanded") {
      setState("idle");
    }
  }, []);

  // Memoize derived state to prevent unnecessary object allocations
  const derivedState = useMemo(() => ({
    isBooting: state === "boot",
    isIdle: state === "idle",
    isHovering: state === "hover",
    isExpanded: state === "expanded",
  }), [state]);

  return {
    state,
    ...derivedState,
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
    handleClickOutside,
    completeBootAnimation,
  };
}
