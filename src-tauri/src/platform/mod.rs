use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformCapabilities {
    pub platform: String,
    pub media_session: bool,
    pub media_controls: bool,
    pub notifications: bool,
    pub audio_devices: bool,
    pub per_app_mixer: bool,
    pub battery: bool,
    pub brightness: bool,
}

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "windows")]
pub fn current_capabilities() -> PlatformCapabilities {
    windows::capabilities()
}

#[cfg(target_os = "macos")]
pub fn current_capabilities() -> PlatformCapabilities {
    macos::capabilities()
}

#[cfg(target_os = "linux")]
pub fn current_capabilities() -> PlatformCapabilities {
    linux::capabilities()
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
pub fn current_capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        platform: "unknown".to_string(),
        media_session: false,
        media_controls: false,
        notifications: false,
        audio_devices: false,
        per_app_mixer: false,
        battery: false,
        brightness: false,
    }
}
