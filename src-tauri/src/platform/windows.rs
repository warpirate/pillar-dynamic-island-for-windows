use super::PlatformCapabilities;

pub fn capabilities() -> PlatformCapabilities {
    PlatformCapabilities {
        platform: "windows".to_string(),
        media_session: true,
        media_controls: true,
        notifications: true,
        audio_devices: true,
        per_app_mixer: true,
        battery: true,
        brightness: true,
    }
}
