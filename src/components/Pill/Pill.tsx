import { useCallback, useEffect, useRef, useState } from "react";
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
import { useBattery } from "../../hooks/useBattery";
import { usePrismAI } from "../../hooks/usePrismAI";
import { useAppearance, hexToRgba } from "../../hooks/useAppearance";
import { useSettings } from "../../hooks/useSettings";
import { useAdaptivePolling } from "../../hooks/useAdaptivePolling";
import { useScreenReader, useAnnounceListChange } from "../../hooks/useScreenReader";
import { useDesktopGestures } from "../../hooks/useDesktopGestures";
import { NotificationToast, NotificationsList, NotificationIndicator } from "./modules/NotificationModule";
import { BatteryIndicator } from "./modules/BatteryModule";
import { springConfig, pillDimensions, bootAnimationDuration, idleSlotAnimations, getPillTargetStyle, type PillVisualState, PILL_DURATION_FAST, microInteractions } from "./animations";
import { TimerExpanded } from "./modules/TimerModule";
import { MediaExpanded, MediaIndicator } from "./modules/MediaModule";
import { QuickSettings } from "./modules/VolumeModule";
import { PrismModule } from "./modules/PrismModule";
import { StateIndicators, TimerMiniProgress } from "./indicators/StateIndicators";
import { createFocusTrap } from "../../utils/focusTrap";
import { tauriInvoke } from "../../lib/tauri";
import type { PrismAction } from "../../types/prism";
import { createPillThemeTokens, resolveReducedMotion } from "./themeTokens";

// Tab type for expanded view
type ExpandedTab = "timer" | "media" | "notifications" | "settings" | "prism";
const EXPANDED_TAB_CONFIG: Array<{ id: ExpandedTab; label: string; icon: string; ariaLabel: string; hasBadge?: boolean }> = [
  { id: "timer", label: "Timer", icon: "⏱", ariaLabel: "Timer module" },
  { id: "media", label: "Media", icon: "🎵", ariaLabel: "Media controls" },
  { id: "notifications", label: "Notifs", icon: "🔔", ariaLabel: "Notifications", hasBadge: true },
  { id: "settings", label: "Settings", icon: "⚙", ariaLabel: "Settings" },
  { id: "prism", label: "Prism", icon: "AI", ariaLabel: "Prism AI assistant" },
];

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
    isIdle,
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
  
  // Adaptive polling for reduced CPU usage
  const { triggerActivity } = useAdaptivePolling({
    baseInterval: 5000,
    activeInterval: 1000,
    idleThreshold: 30000,
    deepSleepInterval: 15000,
    deepSleepThreshold: 300000,
  });

  // Screen reader support
  const { announce } = useScreenReader({
    defaultPriority: "polite",
    announcementDelay: 100,
    deduplicate: true,
    deduplicationWindow: 5000,
  });
  const announceListChange = useAnnounceListChange(announce);

  // Timer hook
  const {
    timer,
    stats: timerStats,
    categories: timerCategories,
    selectedCategory: selectedTimerCategory,
    setSelectedCategory: setSelectedTimerCategory,
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
    recentSources,
    timeline,
    playbackInfo,
    playPause,
    next: mediaNext,
    previous: mediaPrevious,
    toggleRepeat,
    toggleShuffle,
    seekTo,
    pauseOtherSessions,
  } = useMediaSession(1500); // Poll every 1.5s (reduced from 600ms to avoid saturating backend)

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
  } = useAudioDevices(15000); // Poll every 15s (devices rarely change; reduced from 5s)

  // Per-app mixer hook
  const {
    sessions: audioSessions,
    setSessionVolume,
    setSessionMute,
  } = usePerAppMixer(8000); // Poll every 8s (heavy COM operation; reduced from 3s)

  // Notifications hook
  const {
    notifications,
    history: notificationHistory,
    hasAccess: hasNotificationAccess,
    latestNotification,
    notificationPhase,
    isNewNotification,
    dismissNotification,
    clearLatest: clearLatestNotification,
    clearHistory: clearNotificationHistory,
  } = useNotifications(); // Real-time via Windows NotificationChanged event; fallback poll every 30s

  // Battery hook
  const {
    battery,
    isLow: isBatteryLow,
    isCritical: isBatteryCritical,
  } = useBattery(60000); // Poll every 60s (battery changes slowly)

  // Appearance settings (mode, opacity, accent color)
  const appearance = useAppearance();
  const isNotch = appearance.active.mode === "notch";

  // Centralized settings (motion, behavior, timer persistence)
  const { settings: appSettings, update: updateSettings } = useSettings();

  // Album art accent color polling
  const [albumAccentColor, setAlbumAccentColor] = useState<string | null>(null);
  useEffect(() => {
    if (!appearance.active.useAlbumAccent || !media) {
      setAlbumAccentColor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await tauriInvoke<{ r: number; g: number; b: number }>("extract_accent_color");
        if (!cancelled && result) {
          const hex = `#${result.r.toString(16).padStart(2, "0")}${result.g.toString(16).padStart(2, "0")}${result.b.toString(16).padStart(2, "0")}`;
          setAlbumAccentColor(hex);
        }
      } catch {
        // extract_accent_color not available or failed — ignore
      }
    })();
    return () => { cancelled = true; };
  }, [appearance.active.useAlbumAccent, media?.title, media?.artist]);

  // Effective accent color: album art override or user setting
  const effectiveAccentColor = (appearance.active.useAlbumAccent && albumAccentColor) ? albumAccentColor : appearance.active.accentColor;

  // Auto-pause other sessions when a new session starts playing
  const prevMediaTitleRef = useRef<string | null>(null);
  useEffect(() => {
    if (!appSettings.behavior.pause_other_sessions || !media?.isPlaying) return;
    const currentTitle = media.title;
    if (prevMediaTitleRef.current !== null && prevMediaTitleRef.current !== currentTitle) {
      tauriInvoke("pause_other_sessions").catch(() => {});
    }
    prevMediaTitleRef.current = currentTitle;
  }, [media?.title, media?.isPlaying, appSettings.behavior.pause_other_sessions]);

  const {
    messages: prismMessages,
    actions: prismActions,
    actionMode: prismActionMode,
    usage: prismUsage,
    isLoading: prismLoading,
    error: prismError,
    setActionMode: setPrismActionMode,
    setActions: setPrismActions,
    clearChat: clearPrismChat,
    sendMessage: sendPrismMessage,
  } = usePrismAI({
    timer,
    media,
    volume,
    brightness,
    notifications,
    audioSessions,
    autoStartEnabled,
    battery,
  });

  // Whether to show notification badge in the pill
  const hasNotificationBadge = appSettings.layout.idle_indicators.notifications && notifications.length > 0 &&
    (notificationPhase === "showing" || notificationPhase === "idle");
  const themeTokens = createPillThemeTokens({ ...appearance.active, accentColor: effectiveAccentColor });
  const reducedMotion = resolveReducedMotion(appSettings.motion.reduced_motion_override);
  const visibleTabs = EXPANDED_TAB_CONFIG.filter((tab) => appSettings.layout.visible_tabs[tab.id]);
  const safeTabs = visibleTabs.length > 0 ? visibleTabs : EXPANDED_TAB_CONFIG;

  const containerRef = useRef<HTMLDivElement>(null);
  const expandedContentRef = useRef<HTMLDivElement>(null);
  const pillToggleRef = useRef<HTMLDivElement>(null);
  const [bootPhase, setBootPhase] = useState<"dot" | "morph" | "complete">("dot");
  const [activeTab, setActiveTab] = useState<ExpandedTab>("timer");
  const [notificationsView, setNotificationsView] = useState<"live" | "history">("live");
  const [time, setTime] = useState(getTimeString);
  const [dateStr, setDateStr] = useState(getDateString);
  const [seconds, setSeconds] = useState(getSecondsString);
  const panelTransitionDuration = reducedMotion ? 0.08 : PILL_DURATION_FAST;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--pillar-surface-primary", themeTokens.surfacePrimary);
    root.style.setProperty("--pillar-surface-secondary", themeTokens.surfaceSecondary);
    root.style.setProperty("--pillar-border", themeTokens.borderColor);
    root.style.setProperty("--pillar-text", themeTokens.textPrimary);
    root.style.setProperty("--pillar-text-muted", themeTokens.textMuted);
    root.style.setProperty("--pillar-accent", themeTokens.accent);
    root.style.setProperty("--pillar-shadow", themeTokens.shadow);
  }, [themeTokens]);

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
  const showMediaInIdle = hasMediaPlaying && !isExpanded && appSettings.layout.idle_indicators.media;

  // Whether to show battery indicator in the idle pill
  const showBatteryInIdle = battery.hasBattery && appSettings.layout.idle_indicators.battery;

  useEffect(() => {
    if (!safeTabs.some((t) => t.id === activeTab)) {
      setActiveTab(safeTabs[0].id);
    }
  }, [activeTab, safeTabs]);

  const goToTab = useCallback((direction: -1 | 1) => {
    const ids = safeTabs.map((tab) => tab.id);
    const currentIndex = ids.indexOf(activeTab);
    const startIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = direction === 1
      ? (startIndex + 1) % ids.length
      : (startIndex - 1 + ids.length) % ids.length;
    setActiveTab(ids[nextIndex]);
  }, [activeTab, safeTabs]);

  const { handlers: gestureHandlers, contextMenu, closeContextMenu } = useDesktopGestures({
    enabled: true,
    reducedMotion,
    onSwipeLeft: () => {
      if (isExpanded) goToTab(1);
    },
    onSwipeRight: () => {
      if (isExpanded) goToTab(-1);
    },
    onLongPress: () => {
      if (!isExpanded && (isHovering || isIdle)) {
        handleClick();
      }
    },
  });

  // Snappy spring so hover-in and unhover-out feel the same
  const pillSpring = springConfig.snappy;
  const width = useSpring(pillDimensions.boot.width, pillSpring);
  const height = useSpring(pillDimensions.boot.height, pillSpring);
  const borderRadiusTop = useSpring(pillDimensions.boot.borderRadius, pillSpring);
  const borderRadiusBottom = useSpring(pillDimensions.boot.borderRadius, pillSpring);
  const blurAmount = useSpring(8, pillSpring);
  const shadowOpacity = useSpring(0.2, pillSpring);

  // Combined borderRadius: top-left top-right bottom-right bottom-left
  const borderRadius = useTransform(
    [borderRadiusTop, borderRadiusBottom],
    ([t, b]: number[]) => `${t}px ${t}px ${b}px ${b}px`
  );

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
      borderRadiusBottom.set(pillDimensions.idle.borderRadius);
      borderRadiusTop.set(isNotch ? 0 : pillDimensions.idle.borderRadius);

      await new Promise((r) => setTimeout(r, bootAnimationDuration.morphToPill));

      // Phase 3: Zoom in like hover, then back out
      width.set(pillDimensions.hover.width);
      height.set(pillDimensions.hover.height);
      borderRadiusBottom.set(pillDimensions.hover.borderRadius);
      borderRadiusTop.set(isNotch ? 0 : pillDimensions.hover.borderRadius);
      blurAmount.set(12);
      shadowOpacity.set(0.25);

      await new Promise((r) => setTimeout(r, 350));

      // Complete → settles back to idle size
      setBootPhase("complete");
      completeBootAnimation();
    };

    sequence();
  }, [isBooting, width, height, borderRadiusTop, borderRadiusBottom, isNotch, blurAmount, shadowOpacity, completeBootAnimation]);

  // Single place for hover/expanded/unhover: one visual state → one target style
  const visualState: PillVisualState = isExpanded ? "expanded" : isHovering ? "hover" : "idle";

  // Update dimensions from current visual state (keeps animations smooth, logic simple)
  useEffect(() => {
    if (isBooting) return;
    const target = getPillTargetStyle(visualState, {
      hasMedia: showMediaInIdle,
      hasBattery: showBatteryInIdle,
      hasNotifications: hasNotificationBadge,
    });
    width.set(target.width);
    height.set(target.height);
    borderRadiusBottom.set(target.borderRadius);
    borderRadiusTop.set(isNotch ? 0 : target.borderRadius);
    blurAmount.set(target.blur);
    shadowOpacity.set(target.shadow);
  }, [isBooting, visualState, isNotch, showMediaInIdle, showBatteryInIdle, hasNotificationBadge, width, height, borderRadiusTop, borderRadiusBottom, blurAmount, shadowOpacity]);

  // Keep window always receiving clicks so the pill is clickable.
  // (Enabling click-through when idle would block mouseenter, so we'd never get hover/click.)
  useEffect(() => {
    const setClickThrough = async (ignore: boolean) => {
      const ok = await tauriInvoke("set_click_through", { ignore });
      if (ok === null) {
        console.error("Failed to set click through");
      }
    };
    setClickThrough(false);
  }, []);

  // Resize and re-center window when expanded or when notification toast is showing (so toast isn't clipped)
  const showNotificationToast = !isExpanded && (notificationPhase === "incoming" || notificationPhase === "absorbing") && !!latestNotification;
  // Compute actual idle pill width based on active indicators (matches getPillTargetStyle logic)
  const idlePillWidth = isExpanded
    ? pillDimensions.expanded.width
    : getPillTargetStyle("idle", {
        hasMedia: showMediaInIdle,
        hasBattery: showBatteryInIdle,
        hasNotifications: hasNotificationBadge,
      }).width;
  useEffect(() => {
    const resizeAndCenter = async () => {
      const pillWidth = isExpanded ? pillDimensions.expanded.width : idlePillWidth;
      const pillHeight = isExpanded ? pillDimensions.expanded.height : pillDimensions.idle.height;
      // Toast is 300-380px wide, so the window must be wide enough to contain it
      const w = showNotificationToast
        ? Math.max(pillWidth + 60, 420)
        : pillWidth + 60;
      // Toast needs: 10px gap + ~120px toast height + 20px breathing room = ~150px below pill
      // When collapsed with no toast, use exact pill dimensions to avoid blocking clicks below
      const extraHeight = isExpanded ? 100 : (showNotificationToast ? 160 : 0);
      const h = pillHeight + extraHeight;
      const ok = await tauriInvoke("resize_and_center", { width: w, height: h });
      if (ok === null) {
        console.error("Failed to resize/position window");
      }
    };

    resizeAndCenter();
  }, [isExpanded, showNotificationToast, idlePillWidth]);

  // Focus trap for expanded state
  useEffect(() => {
    if (!isExpanded || !expandedContentRef.current) return;

    const cleanup = createFocusTrap({
      container: expandedContentRef.current,
      restoreFocus: pillToggleRef.current,
      initialFocus: true,
    });

    return cleanup;
  }, [isExpanded]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: close expanded view
      if (e.key === "Escape" && isExpanded) {
        handleClickOutside();
        return;
      }

      // Ctrl+Shift+Space: toggle expand/collapse
      if (e.key === " " && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        if (isExpanded) {
          handleClickOutside();
        } else if (isHovering || isIdle) {
          handleClick();
        }
        triggerActivity(); // Mark user as active
        return;
      }

      // Arrow keys: navigate tabs (only when expanded)
      if (isExpanded && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const tabs = safeTabs.map((tab) => tab.id);
        const currentIndex = tabs.indexOf(activeTab);
        let nextIndex: number;
        
        if (e.key === "ArrowLeft") {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        } else {
          nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        }
        
        setActiveTab(tabs[nextIndex]);
        triggerActivity(); // Mark user as active
        return;
      }

      // Home/End: navigate to first/last tab (only when expanded)
      if (isExpanded && (e.key === "Home" || e.key === "End")) {
        e.preventDefault();
        const tabs = safeTabs.map((tab) => tab.id);
        
        if (e.key === "Home") {
          setActiveTab(tabs[0]);
        } else {
          setActiveTab(tabs[tabs.length - 1]);
        }
        triggerActivity(); // Mark user as active
        return;
      }

      // Tab/Shift+Tab: manage focus within expanded view
      if (isExpanded && (e.key === "Tab")) {
        e.preventDefault();
        const tabs = safeTabs.map((tab) => tab.id);
        const currentIndex = tabs.indexOf(activeTab);
        
        if (e.shiftKey) {
          // Shift+Tab: move to previous tab
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          setActiveTab(tabs[prevIndex]);
        } else {
          // Tab: move to next tab
          const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
          setActiveTab(tabs[nextIndex]);
        }
        triggerActivity(); // Mark user as active
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isExpanded, isHovering, isIdle, activeTab, handleClick, handleClickOutside, safeTabs]);

  // Screen reader announcements for key state changes
  const prevTimerStateRef = useRef(timer);
  const prevMediaStateRef = useRef(media);
  const prevNotificationsRef = useRef(notifications);
  const prevActiveTabRef = useRef(activeTab);
  const prevVolumeRef = useRef(volume);

  // Announce timer state changes
  useEffect(() => {
    const prev = prevTimerStateRef.current;
    if (prev.isActive !== timer.isActive) {
      if (timer.isActive) {
        announce(`Timer started: ${timer.label}`);
      } else if (timer.isComplete) {
        announce(`Timer completed: ${timer.label}`, "assertive");
      } else if (prev.isActive && !timer.isActive && !timer.isPaused) {
        announce("Timer stopped");
      }
    }
    if (prev.isPaused !== timer.isPaused && timer.isPaused) {
      announce("Timer paused");
    }
    if (prev.isPaused !== timer.isPaused && !timer.isPaused && timer.isActive) {
      announce("Timer resumed");
    }
    prevTimerStateRef.current = timer;
  }, [timer, announce]);

  // Announce media state changes
  useEffect(() => {
    const prev = prevMediaStateRef.current;
    if (prev?.title !== media?.title && media?.title) {
      announce(`Now playing: ${media.title} by ${media.artist || "Unknown Artist"}`);
    }
    if (prev?.isPlaying !== media?.isPlaying) {
      if (media?.isPlaying) {
        announce("Media playing");
      } else {
        announce("Media paused");
      }
    }
    prevMediaStateRef.current = media;
  }, [media, announce]);

  // Announce notification changes
  useEffect(() => {
    const prev = prevNotificationsRef.current;
    announceListChange(notifications, prev, "notification", "notifications", "notifications");
    prevNotificationsRef.current = notifications;
  }, [notifications, announceListChange]);

  // Announce tab changes
  useEffect(() => {
    const prev = prevActiveTabRef.current;
    if (prev !== activeTab) {
      const tabNames: Record<ExpandedTab, string> = {
        timer: "Timer",
        media: "Media",
        notifications: "Notifications",
        settings: "Settings",
        prism: "Prism AI",
      };
      announce(`Switched to ${tabNames[activeTab]} tab`);
    }
    prevActiveTabRef.current = activeTab;
  }, [activeTab, announce]);

  // Announce volume changes
  useEffect(() => {
    const prev = prevVolumeRef.current;
    if (prev?.level !== volume?.level && volume?.level !== undefined) {
      announce(`Volume: ${Math.round(volume.level * 100)}%`);
    }
    if (prev?.isMuted !== volume?.isMuted) {
      announce(volume?.isMuted ? "Muted" : "Unmuted");
    }
    prevVolumeRef.current = volume;
  }, [volume, announce]);

  const runPrismAction = useCallback(
    async (action: PrismAction): Promise<string> => {
      const args = action.args ?? {};

      switch (action.type) {
        case "start_timer": {
          const minutesValue = Number(args.minutes);
          if (!Number.isFinite(minutesValue) || minutesValue <= 0) {
            throw new Error("Invalid minutes for start_timer.");
          }
          const minutes = Math.max(1, Math.min(720, Math.round(minutesValue)));
          const label =
            typeof args.label === "string" && args.label.trim()
              ? args.label.trim().slice(0, 40)
              : `Prism ${minutes}m`;
          startTimer({ label, minutes });
          return `Timer started: ${label} (${minutes}m).`;
        }
        case "pause_timer":
          pauseTimer();
          return "Timer paused.";
        case "resume_timer":
          resumeTimer();
          return "Timer resumed.";
        case "stop_timer":
          stopTimer();
          return "Timer stopped.";
        case "set_volume": {
          const levelValue = Number(args.level);
          if (!Number.isFinite(levelValue)) {
            throw new Error("Invalid level for set_volume.");
          }
          const level = Math.max(0, Math.min(100, Math.round(levelValue)));
          await setVolume(level);
          return `Volume set to ${level}%.`;
        }
        case "toggle_mute":
          await toggleMute();
          return "Mute toggled.";
        case "set_brightness": {
          const levelValue = Number(args.level);
          if (!Number.isFinite(levelValue)) {
            throw new Error("Invalid level for set_brightness.");
          }
          const level = Math.max(0, Math.min(100, Math.round(levelValue)));
          await setBrightness(level);
          return `Brightness set to ${level}%.`;
        }
        case "media_play_pause":
          await playPause();
          return "Media play/pause sent.";
        case "media_next":
          await mediaNext();
          return "Media next sent.";
        case "media_previous":
          await mediaPrevious();
          return "Media previous sent.";
        default:
          throw new Error(`Unsupported action type: ${action.type}`);
      }
    },
    [
      mediaNext,
      mediaPrevious,
      pauseTimer,
      playPause,
      resumeTimer,
      setBrightness,
      setVolume,
      startTimer,
      stopTimer,
      toggleMute,
    ]
  );

  // When Actions mode is on and Prism returns actions, run them directly (no extra buttons)
  useEffect(() => {
    if (!prismActionMode || prismActions.length === 0) return;
    const toRun = [...prismActions];
    setPrismActions([]);
    toRun.forEach((action) => {
      runPrismAction(action).catch(() => {});
    });
  }, [prismActionMode, prismActions, setPrismActions, runPrismAction]);

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
      role={isExpanded ? "dialog" : "button"}
      aria-label={isExpanded ? "PILLAR Dynamic Island - Expanded" : "PILLAR Dynamic Island"}
      aria-modal={isExpanded ? "true" : undefined}
      aria-expanded={isExpanded ? "true" : "false"}
      tabIndex={isExpanded ? -1 : 0}
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
          : `linear-gradient(135deg, var(--pillar-surface-primary) 0%, var(--pillar-surface-secondary) 60%, rgba(15, 15, 18, 0.95) 100%)`,
        border: `1px solid ${themeTokens.borderColor}`,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
      }}
      transition={reducedMotion ? { duration: 0.1, ease: "easeOut" } : springConfig.bouncy}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={gestureHandlers.onPointerDown}
      onPointerMove={gestureHandlers.onPointerMove}
      onPointerUp={gestureHandlers.onPointerUp}
      onContextMenu={gestureHandlers.onContextMenu}
      onClick={() => {
        handleClick();
        triggerActivity(); // Mark user as active
      }}
      onKeyDown={(e) => {
        if (!isExpanded && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          handleClick();
          triggerActivity(); // Mark user as active
        }
      }}
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

      {/* Notification toast (appears BELOW pill, then animates into badge) — click opens the app */}
      {!isExpanded && (notificationPhase === "incoming" || notificationPhase === "absorbing") && latestNotification && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[100]"
          style={{ top: "calc(100% + 10px)" }}
          onClickCapture={(e) => {
            e.stopPropagation();
            const { id, aumid } = latestNotification;
            if (aumid) {
              tauriInvoke("activate_app_by_aumid", { aumid }).catch(() => {});
            } else {
              tauriInvoke("activate_notification", { id }).catch(() => {});
            }
            clearLatestNotification();
          }}
        >
          <NotificationToast
            notification={latestNotification}
            onDismiss={clearLatestNotification}
            onActivate={async (id) => {
              try {
                const notif = notifications.find(n => n.id === id);
                if (notif?.aumid) {
                  await tauriInvoke("activate_app_by_aumid", { aumid: notif.aumid });
                } else {
                  await tauriInvoke("activate_notification", { id });
                }
              } catch (_) { /* ignore */ }
            }}
            phase={notificationPhase}
          />
        </div>
      )}

      {/* Idle/Hover Content */}
      {!isBooting && !isExpanded && (
        <div
          ref={pillToggleRef}
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
                      <span style={{ color: effectiveAccentColor, textShadow: `0 0 10px ${hexToRgba(effectiveAccentColor, 0.5)}` }}>
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

          {/* Right side: Battery + Notification badge — fixed animated width so center clock stays centered */}
          <motion.div
            className="flex items-center justify-end flex-shrink-0 overflow-hidden gap-1"
            animate={{
              width:
                showBatteryInIdle && hasNotificationBadge ? (isHovering ? 74 : 48) :
                showBatteryInIdle ? (isHovering ? 48 : 22) :
                hasNotificationBadge ? 28 :
                0,
            }}
            transition={idleSlotAnimations.transition}
          >
            <AnimatePresence mode="wait">
              {showBatteryInIdle && (
                <BatteryIndicator
                  key="battery"
                  battery={battery}
                  isLow={isBatteryLow}
                  isCritical={isBatteryCritical}
                  showPercent={isHovering}
                />
              )}
            </AnimatePresence>
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
          </motion.div>
        </div>
      )}

      {/* Content area - only show when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            ref={expandedContentRef}
            className="absolute inset-0 flex flex-col p-2.5"
            role="region"
            aria-label="PILLAR expanded content"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: panelTransitionDuration }}
          >
            {/* Header row with time - time as single unit */}
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-pill-md">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(to bottom right, ${hexToRgba(effectiveAccentColor, 0.4)}, ${hexToRgba(effectiveAccentColor, 0.2)})` }}
                >
                  <span className="text-white text-pill-xs font-bold">P</span>
                </div>
                <span className="text-white text-pill-md font-semibold tracking-wide">PILLAR</span>
              </div>

              <span
                className="text-pill-md font-medium text-white tabular-nums"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {time}:{seconds}
              </span>
            </div>

            {/* Tab Navigation */}
            <div 
              className="flex gap-pill-xs mb-1.5 p-pill-xs bg-pill-muted-lightest rounded-pill-md"
              role="tablist"
              aria-label="PILLAR modules"
            >
              {safeTabs.map(tab => (
                <motion.button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  aria-label={tab.id === "notifications" && notifications.length > 0 ? `Notifications (${notifications.length} unread)` : tab.ariaLabel}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={`relative flex-1 py-1 px-0.5 rounded-md text-[12px] font-medium transition-colors ${
                    activeTab === tab.id 
                      ? "bg-white/15 text-white" 
                      : "text-white/80 hover:text-white"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveTab(tab.id);
                    }
                  }}
                  {...microInteractions.button}
                >
                  <span className="mr-0.5" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                  {tab.hasBadge && notifications.length > 0 && (
                    <span 
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-medium flex items-center justify-center"
                      aria-label={`${notifications.length} notifications`}
                    >
                      {notifications.length > 9 ? "9+" : notifications.length}
                    </span>
                  )}
                </motion.button>
              ))}
            </div>

            {/* Main content area - Tabbed modules */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
              <AnimatePresence mode="wait">
                {activeTab === "timer" && (
                  <motion.div
                    key="timer"
                    id="panel-timer"
                    role="tabpanel"
                    aria-labelledby="tab-timer"
                    className="overflow-y-auto flex-1 min-h-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: panelTransitionDuration }}
                  >
                    <TimerExpanded
                      timer={timer}
                      stats={timerStats}
                      categories={timerCategories}
                      selectedCategory={selectedTimerCategory}
                      onSelectCategory={setSelectedTimerCategory}
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
                    id="panel-media"
                    role="tabpanel"
                    aria-labelledby="tab-media"
                    className="overflow-y-auto flex-1 min-h-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: panelTransitionDuration }}
                  >
                    <MediaExpanded
                      media={media}
                      recentSources={recentSources}
                      timeline={timeline}
                      playbackInfo={playbackInfo}
                      accentColor={effectiveAccentColor}
                      onPlayPause={playPause}
                      onNext={mediaNext}
                      onPrevious={mediaPrevious}
                      onToggleRepeat={toggleRepeat}
                      onToggleShuffle={toggleShuffle}
                      onPauseOthers={pauseOtherSessions}
                      onSeek={seekTo}
                    />
                  </motion.div>
                )}

                {activeTab === "notifications" && (
                  <motion.div
                    key="notifications"
                    id="panel-notifications"
                    role="tabpanel"
                    aria-labelledby="tab-notifications"
                    className="overflow-y-auto flex-1 min-h-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: panelTransitionDuration }}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h2 className="text-white/90 text-[13px] font-medium uppercase tracking-wider">
                          {notificationsView === "live" ? "Recent Notifications" : "Notification History"}
                        </h2>
                        <div className="flex items-center gap-1.5">
                          <div className="rounded bg-white/10 p-[2px] flex items-center">
                            <button
                              type="button"
                              className={`px-1.5 py-0.5 text-[10px] rounded ${notificationsView === "live" ? "bg-white/20 text-white" : "text-white/70"}`}
                              aria-label="Show live notifications"
                              aria-pressed={notificationsView === "live"}
                              onClick={() => setNotificationsView("live")}
                            >
                              Live
                            </button>
                            <button
                              type="button"
                              className={`px-1.5 py-0.5 text-[10px] rounded ${notificationsView === "history" ? "bg-white/20 text-white" : "text-white/70"}`}
                              aria-label="Show notification history"
                              aria-pressed={notificationsView === "history"}
                              onClick={() => setNotificationsView("history")}
                            >
                              History
                            </button>
                          </div>
                          {(notificationsView === "live" ? notifications.length : notificationHistory.length) > 0 && (
                          <motion.button
                            type="button"
                            className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-white/70 hover:text-white/90 hover:bg-white/15 transition-colors"
                            onClick={() => {
                              if (notificationsView === "live") {
                                notifications.slice(0, 30).forEach((n) => dismissNotification(n.id));
                              } else {
                                clearNotificationHistory();
                              }
                            }}
                            {...microInteractions.button}
                          >
                            {notificationsView === "live" ? "Clear all" : "Clear history"}
                          </motion.button>
                        )}
                        </div>
                      </div>
                      <NotificationsList
                        notifications={notificationsView === "live" ? notifications : notificationHistory}
                        hasAccess={hasNotificationAccess}
                        onDismiss={dismissNotification}
                        onActivate={async (id) => {
                          try {
                            const notif = notifications.find(n => n.id === id);
                            if (notif?.aumid) {
                              await tauriInvoke("activate_app_by_aumid", { aumid: notif.aumid });
                            } else {
                              await tauriInvoke("activate_notification", { id });
                            }
                            dismissNotification(id);
                            handleClickOutside();
                          } catch (_) { /* ignore */ }
                        }}
                      />
                    </div>
                  </motion.div>
                )}

                {activeTab === "settings" && (
                  <motion.div
                    key="settings"
                    id="panel-settings"
                    role="tabpanel"
                    aria-labelledby="tab-settings"
                    className="overflow-y-auto flex-1 min-h-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: panelTransitionDuration }}
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
                      layoutSettings={appSettings.layout}
                      onLayoutChange={(layoutPatch) => updateSettings({ layout: layoutPatch })}
                      appearance={appearance}
                      motionSettings={{
                        animationSpeed: appSettings.motion.animation_speed,
                        onAnimationSpeedChange: (speed) => updateSettings({ motion: { animation_speed: speed } }),
                      }}
                    />
                  </motion.div>
                )}

                {activeTab === "prism" && (
                  <motion.div
                    key="prism"
                    id="panel-prism"
                    role="tabpanel"
                    aria-labelledby="tab-prism"
                    className="w-full h-full min-h-0 flex flex-col overflow-y-auto"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: panelTransitionDuration }}
                  >
                    <PrismModule
                      messages={prismMessages}
                      actionMode={prismActionMode}
                      usage={prismUsage}
                      isLoading={prismLoading}
                      error={prismError}
                      onSendMessage={sendPrismMessage}
                      onToggleActionMode={setPrismActionMode}
                      onClearChat={clearPrismChat}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer with date */}
            <div className="flex items-center justify-center pt-pill-md mt-pill-xs border-t border-pill-border flex-shrink-0">
              <span className="text-pill-muted text-pill-base">{dateStr}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {contextMenu.isOpen && (
        <div
          className="fixed inset-0 z-[120]"
          onClick={closeContextMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeContextMenu();
          }}
        >
          <div
            className="absolute min-w-[150px] rounded-md border border-white/15 bg-black/85 backdrop-blur-md p-1.5"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              type="button"
              className="w-full text-left text-[11px] text-white/85 px-2 py-1 rounded hover:bg-white/10"
              onClick={() => {
                if (isExpanded) {
                  handleClickOutside();
                } else {
                  handleClick();
                }
                closeContextMenu();
              }}
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
            {isExpanded && (
              <>
                <button
                  type="button"
                  className="w-full text-left text-[11px] text-white/85 px-2 py-1 rounded hover:bg-white/10"
                  onClick={() => {
                    goToTab(-1);
                    closeContextMenu();
                  }}
                >
                  Previous tab
                </button>
                <button
                  type="button"
                  className="w-full text-left text-[11px] text-white/85 px-2 py-1 rounded hover:bg-white/10"
                  onClick={() => {
                    goToTab(1);
                    closeContextMenu();
                  }}
                >
                  Next tab
                </button>
              </>
            )}
          </div>
        </div>
      )}

    </motion.div>
  );
}
