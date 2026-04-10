use super::PlatformCapabilities;

pub fn capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        platform: "linux".to_string(),
        media_session: true,
        media_controls: true,
        notifications: false,
        audio_devices: false,
        per_app_mixer: false,
        battery: true,
        brightness: false,
    }
}
