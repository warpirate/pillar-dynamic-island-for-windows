import { useState, useCallback, useRef, useEffect } from "react";

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

export function usePillState(): UsePillStateReturn {
  const [state, setState] = useState<PillState>("boot");
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (exitTimeoutRef.current) clearTimeout(exitTimeoutRef.current);
    };
  }, []);

  const completeBootAnimation = useCallback(() => {
    setState("idle");
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (state === "boot") return;

    // Clear any pending exit timeout
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }

    // Delay hover activation to prevent accidental triggers (100-150ms)
    hoverTimeoutRef.current = setTimeout(() => {
      if (state === "idle" || state === "hover") {
        setState("hover");
      }
    }, 120);
  }, [state]);

  const handleMouseLeave = useCallback(() => {
    // Clear pending hover timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Short delay before collapse (same feel as hover-in delay)
    exitTimeoutRef.current = setTimeout(() => {
      if (state === "hover") {
        setState("idle");
      } else if (state === "expanded") {
        setState("idle");
      }
    }, 150);
  }, [state]);

  const handleClick = useCallback(() => {
    if (state === "hover") {
      setState("expanded");
    }
  }, [state]);

  const handleClickOutside = useCallback(() => {
    if (state === "expanded") {
      setState("idle");
    }
  }, [state]);

  return {
    state,
    isBooting: state === "boot",
    isIdle: state === "idle",
    isHovering: state === "hover",
    isExpanded: state === "expanded",
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
    handleClickOutside,
    completeBootAnimation,
  };
}
