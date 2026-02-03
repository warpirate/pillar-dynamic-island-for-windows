import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform, AnimatePresence } from "motion/react";
import { usePillState } from "../../hooks/usePillState";
import { useTimer } from "../../hooks/useTimer";
import { useMediaSession } from "../../hooks/useMediaSession";
import { useVolume } from "../../hooks/useVolume";
import { useAutoStart } from "../../hooks/useAutoStart";
import { useBrightness } from "../../hooks/useBrightness";
import { useAudioDevices } from "../../hooks/useAudioDevices";
import { usePerAppMixer } from "../../hooks/usePerAppMixer";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationToast, NotificationsList, NotificationIndicator } from "./modules/NotificationModule";
import { springConfig, pillDimensions, bootAnimationDuration, idleSlotAnimations, getPillTargetStyle, type PillVisualState } from "./animations";
import { TimerExpanded } from "./modules/TimerModule";
import { MediaExpanded, MediaIndicator } from "./modules/MediaModule";
import { QuickSettings } from "./modules/VolumeModule";
import { StateIndicators, TimerMiniProgress } from "./indicators/StateIndicators";

// Tab type for expanded view
type ExpandedTab = "timer" | "media" | "notifications" | "settings";

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
  }
}

// Helper to get current time string
const getTimeString = () => {
  const now = new Date();
  return now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
};

const getDateString = () => {
  return new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

const getSecondsString = () => {
  return new Date().getSeconds().toString().padStart(2, "0");
};

export function Pill() {
  const {
    isBooting,
    isHovering,
    isExpanded,
    handleMouseEnter,
    handleMouseLeave,
    handleClick,
    handleClickOutside,
    completeBootAnimation,
    // Content state API
    backgroundStates,
    setTimerState,
    setTimerAlert,
  } = usePillState();

  // Timer hook
  const {
    timer,
    presets,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    dismissAlert,
    formatTime,
    progress: timerProgress,
  } = useTimer(
    // On timer update - sync to content state
    (timerState) => {
      if (timerState.isActive) {
        setTimerState({
          label: timerState.label,
          totalSeconds: timerState.totalSeconds,
          remainingSeconds: timerState.remainingSeconds,
          isPaused: timerState.isPaused,
        });
      } else if (!timerState.isComplete) {
        setTimerState(null);
      }
    },
    // On timer complete - show alert
    (label) => {
      setTimerState(null);
      setTimerAlert({ label, completedAt: Date.now() });
    }
  );

  // Dismiss timer alert
  const handleDismissAlert = () => {
    dismissAlert();
    setTimerAlert(null);
  };

  // Media session hook
  const {
    media,
    playPause,
    next: mediaNext,
    previous: mediaPrevious,
  } = useMediaSession(600); // Poll every 600ms for snappy media detection

  // Volume hook
  const {
    volume,
    setVolume,
    toggleMute,
  } = useVolume(5000); // Poll every 5 seconds

  // Auto-start hook
  const {
    isEnabled: autoStartEnabled,
    setEnabled: setAutoStartEnabled,
  } = useAutoStart();

  // Brightness hook
  const {
    brightness,
    setBrightness,
  } = useBrightness(10000); // Poll every 10 seconds

  // Audio devices hook
  const {
    devices: audioDevices,
    defaultDevice: defaultAudioDevice,
  } = useAudioDevices(5000); // Poll every 5 seconds

  // Per-app mixer hook
  const {
    sessions: audioSessions,
    setSessionVolume,
    setSessionMute,
  } = usePerAppMixer(3000); // Poll every 3 seconds

  // Notifications hook
  const {
    notifications,
    hasAccess: hasNotificationAccess,
    latestNotification,
    notificationPhase,
    isNewNotification,
    dismissNotification,
    clearLatest: clearLatestNotification,
  } = useNotifications(); // Real-time via Windows NotificationChanged event; fallback poll every 30s
  
  // Whether to show notification badge in the pill
  const hasNotificationBadge = notifications.length > 0 && 
    (notificationPhase === "showing" || notificationPhase === "idle");

  const containerRef = useRef<HTMLDivElement>(null);
  const [bootPhase, setBootPhase] = useState<"dot" | "morph" | "complete">("dot");
  const [activeTab, setActiveTab] = useState<ExpandedTab>("timer");
  const [time, setTime] = useState(getTimeString);
  const [dateStr, setDateStr] = useState(getDateString);
  const [seconds, setSeconds] = useState(getSecondsString);

  // Clock ticks whenever pill is shown (after boot) so time is always correct
  // Pause only when document is hidden (window minimized) to save CPU
  const shouldTickClock = !isBooting;

  useEffect(() => {
    if (!shouldTickClock) return;

    const tick = () => {
      setTime(getTimeString());
      setDateStr(getDateString());
      setSeconds(getSecondsString());
    };

    // Initial sync
    tick();

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shouldTickClock]);

  // When app becomes visible again, sync time immediately
  useEffect(() => {
    if (!shouldTickClock) return;
    const onVisibilityChange = () => {
      if (!document.hidden) {
        setTime(getTimeString());
        setDateStr(getDateString());
        setSeconds(getSecondsString());
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [shouldTickClock]);

  // Determine what to show based on active content state
  const hasTimerActive = timer.isActive || timer.isComplete;
  const hasTimerAlert = timer.isComplete;
  const hasMediaPlaying = media?.isPlaying ?? false;
  const showTimerInIdle = hasTimerActive && !isExpanded;
  const showMediaInIdle = hasMediaPlaying && !hasTimerActive && !isExpanded;

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

  // Single place for hover/expanded/unhover: one visual state → one target style
  const visualState: PillVisualState = isExpanded ? "expanded" : isHovering ? "hover" : "idle";

  // Update dimensions from current visual state (keeps animations smooth, logic simple)
  useEffect(() => {
    if (isBooting) return;
    const target = getPillTargetStyle(visualState, hasNotificationBadge);
    width.set(target.width);
    height.set(target.height);
    borderRadius.set(target.borderRadius);
    blurAmount.set(target.blur);
    shadowOpacity.set(target.shadow);
  }, [isBooting, visualState, hasNotificationBadge, width, height, borderRadius, blurAmount, shadowOpacity]);

  // Keep window always receiving clicks so the pill is clickable.
  // (Enabling click-through when idle would block mouseenter, so we'd never get hover/click.)
  useEffect(() => {
    const setClickThrough = async (ignore: boolean) => {
      if (window.__TAURI__) {
        try {
          await window.__TAURI__.core.invoke("set_click_through", { ignore });
        } catch (e) {
          console.error("Failed to set click through:", e);
        }
      }
    };
    setClickThrough(false);
  }, []);

  // Resize and re-center window when expanded or when notification toast is showing (so toast isn't clipped)
  const showNotificationToast = !isExpanded && (notificationPhase === "incoming" || notificationPhase === "absorbing") && !!latestNotification;
  useEffect(() => {
    const resizeAndCenter = async () => {
      if (window.__TAURI__) {
        try {
          const dims = isExpanded ? pillDimensions.expanded : pillDimensions.idle;
          const w = dims.width + 60;
          // When toast is visible, add enough height for pill + gap + toast (~100px for toast)
          const extraHeight = showNotificationToast ? 120 : 100;
          const h = dims.height + extraHeight;
          await window.__TAURI__.core.invoke("resize_and_center", { width: w, height: h });
        } catch (e) {
          console.error("Failed to resize/position window:", e);
        }
      }
    };

    resizeAndCenter();
  }, [isExpanded, showNotificationToast]);

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

      {/* Timer progress ring around pill (when timer active in idle/hover) */}
      {showTimerInIdle && (
        <TimerMiniProgress 
          progress={timerProgress} 
          width={width}
          height={height}
        />
      )}

      {/* Background state indicators */}
      {backgroundStates.length > 0 && !isExpanded && (
        <StateIndicators states={backgroundStates} position="right" />
      )}

      {/* Notification toast (appears BELOW pill, then animates into badge) */}
      {!isExpanded && (notificationPhase === "incoming" || notificationPhase === "absorbing") && latestNotification && (
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2">
          <NotificationToast
            notification={latestNotification}
            onDismiss={clearLatestNotification}
            phase={notificationPhase}
          />
        </div>
      )}

      {/* Idle/Hover Content */}
      {!isBooting && !isExpanded && (
        <div
          className="absolute inset-0 flex items-center pointer-events-none select-none px-4"
          style={{
            fontVariantNumeric: "tabular-nums",
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {/* Left side: Media indicator — animate width so center slides left when media stops */}
          <motion.div
            className="flex items-center flex-shrink-0 min-w-0 overflow-hidden"
            animate={{ width: showMediaInIdle ? 32 : 0 }}
            transition={idleSlotAnimations.transition}
          >
            <AnimatePresence mode="wait">
              {showMediaInIdle && (
                <motion.div
                  key="media"
                  className="flex items-center flex-shrink-0"
                  initial={idleSlotAnimations.left.initial}
                  animate={idleSlotAnimations.left.animate}
                  exit={idleSlotAnimations.left.exit}
                  transition={idleSlotAnimations.transition}
                >
                  <MediaIndicator isPlaying={true} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Center: Time and timer — layout so position animates when left/right slots appear or disappear */}
          <motion.div
            layout
            className="flex items-center justify-center gap-2 flex-1 min-w-0 overflow-hidden"
            transition={idleSlotAnimations.transition}
          >
            <AnimatePresence mode="wait">
              {hasTimerActive && !hasTimerAlert && (
                <motion.span
                  key="timer"
                  className="text-green-400"
                  style={{ textShadow: "0 0 8px rgba(34, 197, 94, 0.4)" }}
                  initial={idleSlotAnimations.center.initial}
                  animate={idleSlotAnimations.center.animate}
                  exit={idleSlotAnimations.center.exit}
                  transition={idleSlotAnimations.transition}
                >
                  {formatTime(timer.remainingSeconds)}
                </motion.span>
              )}
              {hasTimerAlert && (
                <motion.span
                  key="alert"
                  className="text-red-400"
                  style={{ textShadow: "0 0 8px rgba(239, 68, 68, 0.5)" }}
                  initial={idleSlotAnimations.center.initial}
                  animate={{
                    ...idleSlotAnimations.center.animate,
                    opacity: [1, 0.5, 1],
                  }}
                  exit={idleSlotAnimations.center.exit}
                  transition={{
                    ...idleSlotAnimations.transition,
                    opacity: { duration: 1, repeat: Infinity },
                  }}
                >
                  Done!
                </motion.span>
              )}
              {!hasTimerActive && !hasTimerAlert && (
                <motion.span
                  key="time"
                  className="inline-flex items-baseline"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                  initial={idleSlotAnimations.center.initial}
                  animate={idleSlotAnimations.center.animate}
                  exit={idleSlotAnimations.center.exit}
                  transition={idleSlotAnimations.transition}
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
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Right side: Notification badge — direct AnimatePresence child, no layoutId, overflow-visible so exit is visible */}
          <div className="flex items-center justify-end flex-shrink-0 min-w-0 overflow-visible">
            <AnimatePresence mode="wait">
              {hasNotificationBadge && notifications.length > 0 && (
                <NotificationIndicator
                  key="notification-badge"
                  count={notifications.length}
                  appName={notifications[0]?.appName || "App"}
                  isNew={isNewNotification}
                  layoutId={undefined}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Content area - only show when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="absolute inset-0 flex flex-col p-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Header row with time - time as single unit */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500/40 to-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">P</span>
                </div>
                <span className="text-white text-[13px] font-semibold tracking-wide">PILLAR</span>
              </div>

              <span
                className="text-[13px] font-medium text-white tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {time}:{seconds}
              </span>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-0.5 mb-2 p-0.5 bg-white/5 rounded-lg">
              {[
                { id: "timer" as const, label: "Timer", icon: "⏱" },
                { id: "media" as const, label: "Media", icon: "🎵" },
                { id: "notifications" as const, label: "Notifs", icon: "🔔", badge: notifications.length > 0 ? notifications.length : undefined },
                { id: "settings" as const, label: "Settings", icon: "⚙" },
              ].map(tab => (
                <motion.button
                  key={tab.id}
                  className={`relative flex-1 py-1 px-0.5 rounded-md text-[12px] font-medium transition-colors ${
                    activeTab === tab.id 
                      ? "bg-white/15 text-white" 
                      : "text-white/80 hover:text-white"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="mr-0.5">{tab.icon}</span>
                  {tab.label}
                  {'badge' in tab && tab.badge && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-medium flex items-center justify-center">
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Main content area - Tabbed modules */}
            <div className="flex-1 flex flex-col justify-center min-h-0 overflow-hidden py-0.5 overflow-y-auto">
              <AnimatePresence mode="wait">
                {activeTab === "timer" && (
                  <motion.div
                    key="timer"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <TimerExpanded
                      timer={timer}
                      presets={presets}
                      formatTime={formatTime}
                      progress={timerProgress}
                      onStart={startTimer}
                      onPause={pauseTimer}
                      onResume={resumeTimer}
                      onStop={stopTimer}
                      onDismiss={handleDismissAlert}
                    />
                  </motion.div>
                )}

                {activeTab === "media" && (
                  <motion.div
                    key="media"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MediaExpanded
                      media={media}
                      onPlayPause={playPause}
                      onNext={mediaNext}
                      onPrevious={mediaPrevious}
                    />
                  </motion.div>
                )}

                {activeTab === "notifications" && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-white/90 text-[13px] font-medium uppercase tracking-wider">
                        Recent Notifications
                      </span>
                      <NotificationsList
                        notifications={notifications}
                        hasAccess={hasNotificationAccess}
                        onDismiss={dismissNotification}
                      />
                    </div>
                  </motion.div>
                )}

                {activeTab === "settings" && (
                  <motion.div
                    key="settings"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.15 }}
                  >
                    <QuickSettings
                      volume={volume}
                      onVolumeChange={setVolume}
                      onMuteToggle={toggleMute}
                      brightness={brightness}
                      onBrightnessChange={setBrightness}
                      audioDevices={audioDevices}
                      defaultAudioDevice={defaultAudioDevice}
                      audioSessions={audioSessions}
                      onSessionVolumeChange={setSessionVolume}
                      onSessionMuteToggle={setSessionMute}
                      autoStartEnabled={autoStartEnabled}
                      onAutoStartToggle={() => setAutoStartEnabled(!autoStartEnabled)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer with date */}
            <div className="flex items-center justify-center pt-2 mt-0.5 border-t border-white/5 flex-shrink-0">
              <span className="text-white/85 text-[12px]">{dateStr}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
