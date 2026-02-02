// =============================================================================
// PILLAR State Types
// =============================================================================

// Priority levels (higher number = higher priority)
export const STATE_PRIORITY = {
  IDLE: 0,
  TIMER_RUNNING: 10,
  NOTIFICATION: 20,
  MEDIA_ACTIVE: 30,
  TIMER_ALERT: 40,
  // CALL_ACTIVE: 50, // Future
} as const;

// Interaction states (orthogonal to content states)
export type InteractionState = "boot" | "idle" | "hover" | "expanded";

// Content state types
export type ContentStateType = 
  | "idle"
  | "timer_running"
  | "timer_alert"
  | "media"
  | "notification";

// Base content state
interface BaseContentState {
  id: string;
  type: ContentStateType;
  priority: number;
  timestamp: number;
}

// Idle state (default)
export interface IdleState extends BaseContentState {
  type: "idle";
}

// Timer states
export interface TimerRunningState extends BaseContentState {
  type: "timer_running";
  data: {
    label: string;
    totalSeconds: number;
    remainingSeconds: number;
    isPaused: boolean;
  };
}

export interface TimerAlertState extends BaseContentState {
  type: "timer_alert";
  data: {
    label: string;
    completedAt: number;
  };
}

// Media state
export interface MediaState extends BaseContentState {
  type: "media";
  data: {
    title: string;
    artist: string;
    album?: string;
    albumArt?: string; // Base64 or URL
    isPlaying: boolean;
    position?: number; // Current position in seconds
    duration?: number; // Total duration in seconds
    appName?: string; // e.g., "Spotify", "Chrome"
  };
}

// Notification state
export interface NotificationState extends BaseContentState {
  type: "notification";
  data: {
    appName: string;
    appIcon?: string;
    title: string;
    body: string;
    expiresAt: number;
  };
}

// Union of all content states
export type ContentState = 
  | IdleState
  | TimerRunningState
  | TimerAlertState
  | MediaState
  | NotificationState;

// Helper to create states with proper defaults
export function createContentState<T extends ContentState>(
  type: T["type"],
  data?: T extends { data: infer D } ? D : never
): T {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const timestamp = Date.now();
  
  const priorities: Record<ContentStateType, number> = {
    idle: STATE_PRIORITY.IDLE,
    timer_running: STATE_PRIORITY.TIMER_RUNNING,
    timer_alert: STATE_PRIORITY.TIMER_ALERT,
    media: STATE_PRIORITY.MEDIA_ACTIVE,
    notification: STATE_PRIORITY.NOTIFICATION,
  };

  return {
    id,
    type,
    priority: priorities[type],
    timestamp,
    ...(data !== undefined && { data }),
  } as T;
}

// Timer presets
export interface TimerPreset {
  id: string;
  label: string;
  workMinutes: number;
  breakMinutes: number;
}

export const TIMER_PRESETS: TimerPreset[] = [
  { id: "pomodoro", label: "Pomodoro", workMinutes: 25, breakMinutes: 5 },
  { id: "long", label: "Deep Work", workMinutes: 50, breakMinutes: 10 },
  { id: "short", label: "Quick Focus", workMinutes: 15, breakMinutes: 3 },
];

// Volume state
export interface VolumeState {
  level: number; // 0-100
  isMuted: boolean;
}
