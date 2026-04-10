import { useCallback, useMemo, useRef, useState } from "react";

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
}

interface UseDesktopGesturesConfig {
  enabled: boolean;
  reducedMotion: boolean;
  longPressMs?: number;
  swipeThresholdPx?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

export function useDesktopGestures({
  enabled,
  reducedMotion,
  longPressMs = 520,
  swipeThresholdPx = 48,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
}: UseDesktopGesturesConfig) {
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      if (!reducedMotion) {
        onLongPress?.();
      }
      clearLongPress();
    }, longPressMs);
  }, [clearLongPress, enabled, longPressMs, onLongPress, reducedMotion]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabled || startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) {
      clearLongPress();
    }
  }, [clearLongPress, enabled]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!enabled || startXRef.current === null || startYRef.current === null) {
      clearLongPress();
      return;
    }
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    clearLongPress();
    if (Math.abs(dx) >= swipeThresholdPx && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) onSwipeLeft?.();
      if (dx > 0) onSwipeRight?.();
    }
    startXRef.current = null;
    startYRef.current = null;
  }, [clearLongPress, enabled, onSwipeLeft, onSwipeRight, swipeThresholdPx]);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
  }, [enabled]);

  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handlers = useMemo(() => ({
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
  }), [onContextMenu, onPointerDown, onPointerMove, onPointerUp]);

  return {
    handlers,
    contextMenu,
    closeContextMenu,
  };
}
