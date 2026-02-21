import type { BrightnessInfo } from "../hooks/useBrightness";
import type { MediaInfo } from "../hooks/useMediaSession";
import type { SystemNotification } from "../hooks/useNotifications";
import type { AudioSession } from "../hooks/usePerAppMixer";
import type { TimerState } from "../hooks/useTimer";
import type { VolumeInfo } from "../hooks/useVolume";
import {
  MAX_AUDIO_SESSIONS_IN_CONTEXT,
  MAX_CONTEXT_CHARS,
  MAX_NOTIFICATIONS_IN_CONTEXT,
  type PrismContextBlock,
} from "../types/prism";

export interface PrismContextSource {
  timer: TimerState;
  media: MediaInfo | null;
  volume: VolumeInfo;
  brightness: BrightnessInfo;
  notifications: SystemNotification[];
  audioSessions: AudioSession[];
  autoStartEnabled: boolean;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 3))}...`;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function detectIntent(userMessage: string): {
  wantsOverview: boolean;
  wantsTimer: boolean;
  wantsMedia: boolean;
  wantsNotifications: boolean;
  wantsSettings: boolean;
} {
  const lower = userMessage.toLowerCase();
  const wantsOverview =
    /(overview|summary|status|state|what.*going on|what can you see|health)/.test(lower);
  const wantsTimer = /(timer|pomodoro|focus|countdown|break|minutes?)/.test(lower);
  const wantsMedia = /(media|music|song|track|spotify|youtube|playback|play|pause|next|previous)/.test(lower);
  const wantsNotifications = /(notification|notifs|alert|message|inbox|whatsapp|mail)/.test(lower);
  const wantsSettings = /(volume|mute|brightness|audio|mixer|autostart|settings)/.test(lower);

  return {
    wantsOverview,
    wantsTimer,
    wantsMedia,
    wantsNotifications,
    wantsSettings,
  };
}

function pushBlock(
  blocks: PrismContextBlock[],
  block: PrismContextBlock,
  usedChars: { count: number }
): void {
  if (usedChars.count >= MAX_CONTEXT_CHARS) return;
  const remaining = MAX_CONTEXT_CHARS - usedChars.count;
  const content = truncate(block.content, remaining);
  if (!content.trim()) return;
  blocks.push({ kind: block.kind, content });
  usedChars.count += content.length;
}

function buildTimerBlock(timer: TimerState): PrismContextBlock {
  return {
    kind: "timer",
    content: stableJson({
      isActive: timer.isActive,
      isPaused: timer.isPaused,
      isComplete: timer.isComplete,
      label: timer.label || null,
      totalSeconds: timer.totalSeconds,
      remainingSeconds: timer.remainingSeconds,
    }),
  };
}

function buildMediaBlock(media: MediaInfo | null): PrismContextBlock {
  return {
    kind: "media",
    content: stableJson(
      media
        ? {
            isPlaying: media.isPlaying,
            title: media.title || null,
            artist: media.artist || null,
            album: media.album || null,
            appName: media.appName || null,
          }
        : { isPlaying: false, available: false }
    ),
  };
}

function buildNotificationsBlock(notifications: SystemNotification[]): PrismContextBlock {
  const top = notifications.slice(0, MAX_NOTIFICATIONS_IN_CONTEXT);
  const redacted = top.map((item) => ({
    appName: truncate(item.appName || "App", 24),
    title: truncate(item.title || "Notification", 60),
  }));

  return {
    kind: "notifications_redacted",
    content: stableJson({
      count: notifications.length,
      recent: redacted,
    }),
  };
}

function buildSettingsBlock(
  volume: VolumeInfo,
  brightness: BrightnessInfo,
  audioSessions: AudioSession[],
  autoStartEnabled: boolean
): PrismContextBlock {
  const reducedSessions = audioSessions
    .slice()
    .sort((a, b) => Number(b.isActive) - Number(a.isActive))
    .slice(0, MAX_AUDIO_SESSIONS_IN_CONTEXT)
    .map((session) => ({
      appName: truncate(session.appName, 24),
      processId: session.processId,
      volume: Number(session.volume.toFixed(2)),
      isMuted: session.isMuted,
      isActive: session.isActive,
    }));

  return {
    kind: "settings",
    content: stableJson({
      volume: {
        level: volume.level,
        isMuted: volume.isMuted,
      },
      brightness: {
        level: brightness.level,
        isSupported: brightness.isSupported,
      },
      autoStartEnabled,
      audioSessions: reducedSessions,
    }),
  };
}

export function buildPrismContext(
  userMessage: string,
  source: PrismContextSource
): PrismContextBlock[] {
  const intent = detectIntent(userMessage);
  const includeAll = intent.wantsOverview;
  const usedChars = { count: 0 };
  const blocks: PrismContextBlock[] = [];

  if (includeAll || intent.wantsTimer) {
    pushBlock(blocks, buildTimerBlock(source.timer), usedChars);
  }

  if (includeAll || intent.wantsMedia) {
    pushBlock(blocks, buildMediaBlock(source.media), usedChars);
  }

  if (includeAll || intent.wantsNotifications) {
    pushBlock(blocks, buildNotificationsBlock(source.notifications), usedChars);
  }

  if (includeAll || intent.wantsSettings) {
    pushBlock(
      blocks,
      buildSettingsBlock(
        source.volume,
        source.brightness,
        source.audioSessions,
        source.autoStartEnabled
      ),
      usedChars
    );
  }

  if (blocks.length === 0) {
    pushBlock(
      blocks,
      {
        kind: "minimal_status",
        content: stableJson({
          timerActive: source.timer.isActive,
          mediaPlaying: source.media?.isPlaying ?? false,
          notificationCount: source.notifications.length,
          volume: source.volume.level,
          muted: source.volume.isMuted,
        }),
      },
      usedChars
    );
  }

  return blocks;
}
