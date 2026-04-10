export interface PlatformCapabilities {
  platform: "windows" | "macos" | "linux" | "unknown";
  mediaSession: boolean;
  mediaControls: boolean;
  notifications: boolean;
  audioDevices: boolean;
  perAppMixer: boolean;
  battery: boolean;
  brightness: boolean;
}

export const UNKNOWN_CAPABILITIES: PlatformCapabilities = {
  platform: "unknown",
  mediaSession: false,
  mediaControls: false,
  notifications: false,
  audioDevices: false,
  perAppMixer: false,
  battery: false,
  brightness: false,
};
