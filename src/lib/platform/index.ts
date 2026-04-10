import { tauriInvoke } from "../tauri";
import { UNKNOWN_CAPABILITIES, type PlatformCapabilities } from "./types";

let cachedCapabilities: PlatformCapabilities | null = null;

function inferCapabilitiesFromUserAgent(): PlatformCapabilities {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("windows")) {
    return {
      platform: "windows",
      mediaSession: true,
      mediaControls: true,
      notifications: true,
      audioDevices: true,
      perAppMixer: true,
      battery: true,
      brightness: true,
    };
  }
  if (ua.includes("mac os")) {
    return {
      platform: "macos",
      mediaSession: true,
      mediaControls: true,
      notifications: false,
      audioDevices: false,
      perAppMixer: false,
      battery: true,
      brightness: false,
    };
  }
  if (ua.includes("linux")) {
    return {
      platform: "linux",
      mediaSession: true,
      mediaControls: true,
      notifications: false,
      audioDevices: false,
      perAppMixer: false,
      battery: true,
      brightness: false,
    };
  }
  return UNKNOWN_CAPABILITIES;
}

export const platformApi = {
  async getCapabilities(): Promise<PlatformCapabilities> {
    if (cachedCapabilities) return cachedCapabilities;
    try {
      const fromBackend = await tauriInvoke<PlatformCapabilities>("get_platform_capabilities");
      cachedCapabilities = fromBackend ?? inferCapabilitiesFromUserAgent();
      return cachedCapabilities;
    } catch {
      cachedCapabilities = inferCapabilitiesFromUserAgent();
      return cachedCapabilities;
    }
  },

  async getMediaSession() {
    return tauriInvoke<{
      title: string;
      artist: string;
      album?: string;
      is_playing: boolean;
      app_name?: string;
    } | null>("get_media_session");
  },
  async getMediaTimeline() {
    return tauriInvoke<{ position_ms: number; duration_ms: number; can_seek: boolean } | null>("get_media_timeline");
  },
  async getMediaPlaybackInfo() {
    return tauriInvoke<{ repeat_mode: string; is_shuffle: boolean } | null>("get_media_playback_info");
  },
  async mediaPlayPause() {
    return tauriInvoke("media_play_pause");
  },
  async mediaNext() {
    return tauriInvoke("media_next");
  },
  async mediaPrevious() {
    return tauriInvoke("media_previous");
  },
  async mediaToggleRepeat() {
    return tauriInvoke("media_toggle_repeat");
  },
  async mediaToggleShuffle() {
    return tauriInvoke("media_toggle_shuffle");
  },
  async seekMedia(positionMs: number) {
    return tauriInvoke("seek_media", { positionMs });
  },
  async pauseOtherSessions() {
    return tauriInvoke("pause_other_sessions");
  },

  async checkNotificationAccess() {
    return tauriInvoke<boolean>("check_notification_access");
  },
  async getNotifications() {
    return tauriInvoke<Array<{
      id: number;
      app_name: string;
      title: string;
      body: string;
      timestamp: number;
      aumid: string | null;
    }>>("get_notifications");
  },
  async dismissNotification(id: number) {
    return tauriInvoke("dismiss_notification", { id });
  },
  async activateNotification(id: number) {
    return tauriInvoke("activate_notification", { id });
  },
  async activateAppByAumid(aumid: string) {
    return tauriInvoke("activate_app_by_aumid", { aumid });
  },

  async listAudioDevices() {
    return tauriInvoke<Array<{ id: string; name: string; is_default: boolean }>>("list_audio_devices");
  },
  async listAudioSessions() {
    return tauriInvoke<Array<{
      session_id: string;
      app_name: string;
      process_id: number;
      volume: number;
      is_muted: boolean;
      is_active: boolean;
    }>>("list_audio_sessions");
  },
  async setSessionVolume(processId: number, level: number) {
    return tauriInvoke("set_session_volume", { processId, level });
  },
  async setSessionMute(processId: number, muted: boolean) {
    return tauriInvoke("set_session_mute", { processId, muted });
  },

  async getSystemBrightness() {
    return tauriInvoke<{ level: number; min: number; max: number; is_supported: boolean }>("get_system_brightness");
  },
  async setSystemBrightness(level: number) {
    return tauriInvoke("set_system_brightness", { level });
  },
  async getBatteryInfo() {
    return tauriInvoke<{
      percent: number;
      is_charging: boolean;
      is_battery_saver: boolean;
      has_battery: boolean;
    }>("get_battery_info");
  },

  async getSystemVolume() {
    return tauriInvoke<{ level: number; is_muted: boolean }>("get_system_volume");
  },
  async setSystemVolume(level: number) {
    return tauriInvoke("set_system_volume", { level });
  },
  async toggleMute() {
    return tauriInvoke<boolean>("toggle_mute");
  },
};
