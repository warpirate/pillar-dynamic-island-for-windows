import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "motion/react";
import { usePillState } from "../../hooks/usePillState";
import { springConfig, pillDimensions, bootAnimationDuration } from "./animations";

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

export function Pill() {
  const {
    isBooting,
    isIdle,
    isHovering,
    isExpanded,
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
    handleClickOutside,
    completeBootAnimation,
  } = usePillState();

  const containerRef = useRef<HTMLDivElement>(null);
  const [bootPhase, setBootPhase] = useState<"dot" | "morph" | "complete">("dot");
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  });
  const [dateStr, setDateStr] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
  );
  const [seconds, setSeconds] = useState(() =>
    new Date().toLocaleTimeString(undefined, { second: "2-digit", hour12: false })
  );

  // Update time and seconds every second
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }));
      setDateStr(now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }));
      setSeconds(now.toLocaleTimeString(undefined, { second: "2-digit", hour12: false }));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Snappy spring so hover-in and unhover-out feel the same
  const pillSpring = springConfig.snappy;
  const width = useSpring(pillDimensions.boot.width, pillSpring);
  const height = useSpring(pillDimensions.boot.height, pillSpring);
  const borderRadius = useSpring(pillDimensions.boot.borderRadius, pillSpring);
  const blurAmount = useSpring(8, pillSpring);
  const shadowOpacity = useSpring(0.2, pillSpring);

  // Transform blur and shadow for style (static shadow when idle to avoid any blink)
  const backdropFilter = useTransform(blurAmount, (v) => `blur(${v}px)`);
  const boxShadow = useTransform(
    shadowOpacity,
    (v) =>
      `0 4px 24px rgba(0, 0, 0, ${v}), 0 8px 48px rgba(0, 0, 0, ${v * 0.5}), inset 0 1px 1px rgba(255, 255, 255, 0.1)`
  );

  // Boot animation sequence
  useEffect(() => {
    if (!isBooting) return;

    const sequence = async () => {
      // Phase 1: Dot appears
      await new Promise((r) => setTimeout(r, bootAnimationDuration.dotAppear));

      // Phase 2: Morph to pill (idle size)
      setBootPhase("morph");
      width.set(pillDimensions.idle.width);
      height.set(pillDimensions.idle.height);
      borderRadius.set(pillDimensions.idle.borderRadius);

      await new Promise((r) => setTimeout(r, bootAnimationDuration.morphToPill));

      // Phase 3: Zoom in like hover, then back out
      width.set(pillDimensions.hover.width);
      height.set(pillDimensions.hover.height);
      borderRadius.set(pillDimensions.hover.borderRadius);
      blurAmount.set(12);
      shadowOpacity.set(0.25);

      await new Promise((r) => setTimeout(r, 350));

      // Complete → settles back to idle size
      setBootPhase("complete");
      completeBootAnimation();
    };

    sequence();
  }, [isBooting, width, height, borderRadius, blurAmount, shadowOpacity, completeBootAnimation]);

  // Update dimensions based on state
  useEffect(() => {
    if (isBooting) return;

    if (isIdle) {
      width.set(pillDimensions.idle.width);
      height.set(pillDimensions.idle.height);
      borderRadius.set(pillDimensions.idle.borderRadius);
      blurAmount.set(8);
      shadowOpacity.set(0.2);
    } else if (isHovering) {
      width.set(pillDimensions.hover.width);
      height.set(pillDimensions.hover.height);
      borderRadius.set(pillDimensions.hover.borderRadius);
      blurAmount.set(12);
      shadowOpacity.set(0.25);
    } else if (isExpanded) {
      width.set(pillDimensions.expanded.width);
      height.set(pillDimensions.expanded.height);
      borderRadius.set(pillDimensions.expanded.borderRadius);
      blurAmount.set(16);
      shadowOpacity.set(0.35);
    }
  }, [isBooting, isIdle, isHovering, isExpanded, width, height, borderRadius, blurAmount, shadowOpacity]);

  // Enable/disable click-through based on state
  useEffect(() => {
    const setClickThrough = async (ignore: boolean) => {
      if (window.__TAURI__) {
        try {
          await window.__TAURI__.invoke("set_click_through", { ignore });
        } catch (e) {
          console.error("Failed to set click through:", e);
        }
      }
    };

    // Click-through only when idle
    setClickThrough(isIdle);
  }, [isIdle]);

  // Resize and re-center window when expanded (desktop: keeps pill visible and top-centered)
  useEffect(() => {
    const resizeAndCenter = async () => {
      if (window.__TAURI__) {
        try {
          const dims = isExpanded ? pillDimensions.expanded : pillDimensions.idle;
          const w = dims.width + 60;
          const h = dims.height + 100;
          await window.__TAURI__.invoke("resize_and_center", { width: w, height: h });
        } catch (e) {
          console.error("Failed to resize/position window:", e);
        }
      }
    };

    resizeAndCenter();
  }, [isExpanded]);

  // Handle click outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleGlobalClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClickOutside();
      }
    };

    // Add slight delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleGlobalClick);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [isExpanded, handleClickOutside]);

  return (
    <motion.div
      ref={containerRef}
      className="relative cursor-pointer"
      style={{
        width,
        height,
        borderRadius,
        backdropFilter,
        WebkitBackdropFilter: backdropFilter,
        boxShadow,
        overflow: "visible",
        background: isBooting && bootPhase === "dot"
          ? "radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(200,200,200,0.6) 100%)"
          : "linear-gradient(135deg, rgba(20, 20, 22, 0.85) 0%, rgba(30, 30, 35, 0.75) 50%, rgba(15, 15, 18, 0.9) 100%)",
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
      }}
      transition={springConfig.bouncy}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {/* Glass overlay for depth */}
      <motion.div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 50%)",
          borderRadius,
        }}
      />

      {/* Subtle border */}
      <motion.div
        className="absolute inset-0 rounded-[inherit] pointer-events-none"
        style={{
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius,
        }}
      />

      {/* Inner glow on top edge */}
      <motion.div
        className="absolute inset-x-0 top-0 h-[1px] rounded-t-[inherit] pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
          borderRadius,
        }}
      />

      {/* Time - show when pill is idle or hover, OnePlus-style: first digit red, rest white */}
      {!isBooting && !isExpanded && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: "17px",
            fontWeight: 600,
            letterSpacing: "0.06em",
          }}
        >
          {time.length > 0 ? (
            <>
              <span style={{ color: "#EB0028", textShadow: "0 0 10px rgba(235, 0, 40, 0.5)" }}>
                {time[0]}
              </span>
              <span style={{ color: "#ffffff", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                {time.slice(1)}
              </span>
            </>
          ) : (
            <span style={{ color: "#ffffff" }}>{time}</span>
          )}
        </div>
      )}

      {/* Content area - only show when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="absolute inset-0 flex flex-col p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header row */}
            <div className="flex items-center gap-3 mb-4">
              {/* Icon placeholder */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-white/20" />
              </div>
              
              {/* Title area */}
              <div className="flex flex-col">
                <span className="text-white/90 text-base font-semibold">PILLAR</span>
                <span className="text-white/50 text-sm">Dynamic Island</span>
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col justify-center gap-1 min-h-[80px]">
              <div className="flex items-baseline gap-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                <span className="text-3xl font-semibold text-white tracking-tight">{time}</span>
                {/* Seconds with roll-up animation */}
                <div className="relative h-5 overflow-hidden" style={{ minWidth: "1.5rem" }}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={seconds}
                      className="absolute inset-x-0 bottom-0 text-sm text-white/40"
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "-100%" }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                    >
                      :{seconds}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
              <span className="text-white/50 text-sm">{dateStr}</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <motion.button
                className="flex-1 py-3 px-4 rounded-2xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/15 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Settings
              </motion.button>
              <motion.button
                className="flex-1 py-3 px-4 rounded-2xl bg-white/10 text-white/80 text-sm font-medium hover:bg-white/15 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                About
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
