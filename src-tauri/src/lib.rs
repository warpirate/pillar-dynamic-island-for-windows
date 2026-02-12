use tauri::Manager;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::TrayIconBuilder;
use serde::{Deserialize, Serialize};
use std::thread;
use std::time::Duration;

// Windows-only imports (Android builds must not compile Win32 code)
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    AllowSetForegroundWindow, GetForegroundWindow, GetWindowRect, GetWindowLongPtrW, GWL_STYLE, WS_POPUP, WS_CAPTION,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{ASFW_ANY, SW_SHOWNORMAL};
#[cfg(target_os = "windows")]
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSessionManager,
    GlobalSystemMediaTransportControlsSession,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus,
    GlobalSystemMediaTransportControlsSessionMediaProperties,
};
#[cfg(target_os = "windows")]
use windows::Foundation::AsyncStatus;
#[cfg(target_os = "windows")]
use windows::Win32::Media::Audio::{
    eRender, eConsole, eMultimedia,
    Endpoints::IAudioEndpointVolume,
    IMMDeviceEnumerator, IMMDevice, IMMDeviceCollection, MMDeviceEnumerator,
    IAudioSessionManager2, IAudioSessionEnumerator, IAudioSessionControl, IAudioSessionControl2,
    ISimpleAudioVolume, AudioSessionState,
    DEVICE_STATE_ACTIVE,
};
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ};
#[cfg(target_os = "windows")]
use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
#[cfg(target_os = "windows")]
use windows::Win32::UI::Shell::ShellExecuteW;
#[cfg(target_os = "windows")]
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
#[cfg(target_os = "windows")]
use windows::Win32::Devices::Display::{
    GetNumberOfPhysicalMonitorsFromHMONITOR, GetPhysicalMonitorsFromHMONITOR,
    GetMonitorBrightness, SetMonitorBrightness, DestroyPhysicalMonitor,
    PHYSICAL_MONITOR,
};
#[cfg(target_os = "windows")]
use windows::Win32::Graphics::Gdi::{MonitorFromWindow, MONITOR_DEFAULTTOPRIMARY};
#[cfg(target_os = "windows")]
use windows::core::{HSTRING, Interface};
#[cfg(target_os = "windows")]
use windows::Foundation::TypedEventHandler;
#[cfg(target_os = "windows")]
use windows::UI::Notifications::Management::{UserNotificationListener, UserNotificationListenerAccessStatus};
#[cfg(target_os = "windows")]
use windows::UI::Notifications::{UserNotification, UserNotificationChangedEventArgs};

#[cfg(target_os = "windows")]
use brightness::blocking::Brightness;


// =============================================================================
// Media Session Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album: Option<String>,
    pub is_playing: bool,
    pub app_name: Option<String>,
}

// =============================================================================
// Volume Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VolumeInfo {
    pub level: u32,      // 0-100
    pub is_muted: bool,
}

// =============================================================================
// Audio Device Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

// =============================================================================
// Audio Session Types (Per-App Volume)
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSession {
    pub session_id: String,      // Unique session identifier
    pub app_name: String,        // Display name of the app
    pub process_id: u32,         // Windows process ID
    pub volume: f32,             // 0.0 - 1.0
    pub is_muted: bool,
    pub is_active: bool,         // Whether session is currently playing audio
}

// =============================================================================
// Notification Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemNotification {
    pub id: u32,
    pub app_name: String,
    pub title: String,
    pub body: String,
    pub timestamp: u64,          // Unix timestamp in milliseconds
}

// =============================================================================
// Async Helpers - Poll Windows IAsyncOperation until complete
// =============================================================================

#[cfg(target_os = "windows")]
fn poll_session_manager() -> Result<GlobalSystemMediaTransportControlsSessionManager, String> {
    let op = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| format!("Failed to request session manager: {}", e))?;
    
    // Poll until complete or timeout
    for _ in 0..100 {
        let status = op.Status().map_err(|e| format!("Failed to get status: {}", e))?;
        if status == AsyncStatus::Completed {
            return op.GetResults().map_err(|e| format!("Failed to get results: {}", e));
        }
        if status == AsyncStatus::Error {
            return Err("Async operation failed".to_string());
        }
        thread::sleep(Duration::from_millis(10));
    }
    Err("Timeout waiting for session manager".to_string())
}

#[cfg(target_os = "windows")]
fn poll_media_properties(session: &GlobalSystemMediaTransportControlsSession) 
    -> Result<GlobalSystemMediaTransportControlsSessionMediaProperties, String> 
{
    let op = session.TryGetMediaPropertiesAsync()
        .map_err(|e| format!("Failed to request media properties: {}", e))?;
    
    for _ in 0..100 {
        let status = op.Status().map_err(|e| format!("Failed to get status: {}", e))?;
        if status == AsyncStatus::Completed {
            return op.GetResults().map_err(|e| format!("Failed to get results: {}", e));
        }
        if status == AsyncStatus::Error {
            return Err("Async operation failed".to_string());
        }
        thread::sleep(Duration::from_millis(10));
    }
    Err("Timeout waiting for media properties".to_string())
}

#[cfg(target_os = "windows")]
fn poll_bool_op(op: windows::Foundation::IAsyncOperation<bool>) -> Result<bool, String> {
    for _ in 0..100 {
        let status = op.Status().map_err(|e| format!("Failed to get status: {}", e))?;
        if status == AsyncStatus::Completed {
            return op.GetResults().map_err(|e| format!("Failed to get results: {}", e));
        }
        if status == AsyncStatus::Error {
            return Err("Async operation failed".to_string());
        }
        thread::sleep(Duration::from_millis(10));
    }
    Err("Timeout waiting for operation".to_string())
}

/// Set click-through mode for the window
/// When enabled, mouse events pass through the window to apps behind it
#[cfg(desktop)]
#[tauri::command]
fn set_click_through(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| format!("Failed to set click-through: {}", e))
}

#[cfg(not(desktop))]
#[tauri::command]
fn set_click_through(_window: tauri::Window, _ignore: bool) -> Result<(), String> {
    Err("Click-through not supported on mobile".to_string())
}

/// Resize window to specified dimensions
#[cfg(desktop)]
#[tauri::command]
fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    if width <= 0.0 || height <= 0.0 {
        return Err("Invalid dimensions".to_string());
    }
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| format!("Failed to resize: {}", e))
}

#[cfg(not(desktop))]
#[tauri::command]
fn resize_window(_window: tauri::Window, _width: f64, _height: f64) -> Result<(), String> {
    Err("Window resize not supported on mobile".to_string())
}

/// Position window at top-center of primary monitor
#[cfg(desktop)]
#[tauri::command]
fn position_window(window: tauri::Window) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?
        .ok_or_else(|| "No primary monitor found".to_string())?;
    
    let monitor_size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let window_size = window
        .outer_size()
        .map_err(|e| format!("Failed to get window size: {}", e))?;
    
    let w = window_size.width as f64 / scale_factor;
    let x = (monitor_size.width as f64 / scale_factor) / 2.0 - w / 2.0;
    
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y: 0.0 }))
        .map_err(|e| format!("Failed to position: {}", e))
}

#[cfg(not(desktop))]
#[tauri::command]
fn position_window(_window: tauri::Window) -> Result<(), String> {
    Err("Window positioning not supported on mobile".to_string())
}

/// Check if the foreground window is "content" fullscreen (video/game), not just window fullscreen.
/// We want: YouTube/Netflix video fullscreen, games → true.
/// We don't want: browser F11 fullscreen, any app maximized/fullscreen → false.
/// Uses window style: WS_POPUP or borderless (no caption) = content fullscreen; normal caption = window fullscreen.
#[cfg(target_os = "windows")]
#[tauri::command]
fn is_foreground_fullscreen(window: tauri::Window) -> Result<bool, String> {
    // Get monitor info, return false if unavailable (safe default)
    let monitor = match window.primary_monitor() {
        Ok(Some(m)) => m,
        _ => return Ok(false),
    };

    let mon_size = monitor.size();
    let mon_w = mon_size.width as i32;
    let mon_h = mon_size.height as i32;

    // Get foreground window handle
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Ok(false);
    }

    // Get window rectangle
    let mut rect = windows::Win32::Foundation::RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
        return Ok(false);
    }

    let w = rect.right - rect.left;
    let h = rect.bottom - rect.top;

    // Must cover 90%+ of monitor to be considered fullscreen at all
    let threshold_w = (mon_w * 90) / 100;
    let threshold_h = (mon_h * 90) / 100;
    if w < threshold_w || h < threshold_h {
        return Ok(false);
    }

    // Distinguish content fullscreen (video/game) from window fullscreen (browser F11, app maximized).
    // Content fullscreen: WS_POPUP (games, many video players) or borderless (no WS_CAPTION).
    // Window fullscreen: normal window with caption (browser F11, VS Code fullscreen, etc.).
    let style = unsafe { GetWindowLongPtrW(hwnd, GWL_STYLE) };
    if style == 0 {
        return Ok(false);
    }
    let style = style as u32;

    let is_popup = (style & WS_POPUP.0) != 0;
    let has_caption = (style & WS_CAPTION.0) != 0;

    // Content fullscreen: popup style (common for games/video) or borderless (no title bar)
    let content_fullscreen = is_popup || !has_caption;
    Ok(content_fullscreen)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn is_foreground_fullscreen(_window: tauri::Window) -> Result<bool, String> {
    Ok(false)
}

/// Resize window and re-center in a single atomic operation
/// Prevents visual glitches from separate resize + position calls
#[cfg(desktop)]
#[tauri::command]
fn resize_and_center(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    if width <= 0.0 || height <= 0.0 {
        return Err("Invalid dimensions".to_string());
    }
    
    // Resize first
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| format!("Failed to resize: {}", e))?;
    
    // Then center
    if let Ok(Some(monitor)) = window.primary_monitor() {
        let monitor_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let x = (monitor_size.width as f64 / scale_factor) / 2.0 - width / 2.0;
        
        window
            .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y: 0.0 }))
            .map_err(|e| format!("Failed to center: {}", e))?;
    }
    
    Ok(())
}

#[cfg(not(desktop))]
#[tauri::command]
fn resize_and_center(_window: tauri::Window, _width: f64, _height: f64) -> Result<(), String> {
    Err("Resize/center not supported on mobile".to_string())
}

/// Get current monitor scale factor for DPI-aware calculations
#[tauri::command]
fn get_scale_factor(window: tauri::Window) -> Result<f64, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?
        .ok_or_else(|| "No primary monitor".to_string())?;
    
    Ok(monitor.scale_factor())
}

// =============================================================================
// Media Session Commands
// =============================================================================

/// Helper to get the current media session
#[cfg(target_os = "windows")]
fn get_current_session() -> Result<GlobalSystemMediaTransportControlsSession, String> {
    let manager = poll_session_manager()?;
    manager.GetCurrentSession()
        .map_err(|e| format!("No active media session: {}", e))
}

/// Get current media session info (now playing)
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_media_session() -> Result<Option<MediaInfo>, String> {
    // Get session manager
    let manager = poll_session_manager()?;

    // Get the current session
    let session = match manager.GetCurrentSession() {
        Ok(s) => s,
        Err(_) => {
            return Ok(None); // No active media session
        },
    };
    
    // Get playback info
    let playback_info = session.GetPlaybackInfo()
        .map_err(|e| format!("Failed to get playback info: {}", e))?;
    
    let playback_status = playback_info.PlaybackStatus()
        .map_err(|e| format!("Failed to get playback status: {}", e))?;
    
    let is_playing = playback_status == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
    
    // Get media properties
    let properties = poll_media_properties(&session)?;
    
    let title = properties.Title()
        .map(|s: HSTRING| s.to_string())
        .unwrap_or_default();
    
    let artist = properties.Artist()
        .map(|s: HSTRING| s.to_string())
        .unwrap_or_default();
    
    let album = properties.AlbumTitle()
        .map(|s: HSTRING| s.to_string())
        .ok()
        .filter(|s| !s.is_empty());
    
    // Get app name
    let app_name = session.SourceAppUserModelId()
        .map(|s: HSTRING| {
            let s = s.to_string();
            // Extract app name from the model ID
            s.split('\\').last()
                .map(|n| n.trim_end_matches(".exe").to_string())
                .unwrap_or(s)
        })
        .ok();
    
    Ok(Some(MediaInfo {
        title,
        artist,
        album,
        is_playing,
        app_name,
    }))
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_media_session() -> Result<Option<MediaInfo>, String> {
    Ok(None)
}

/// Play/pause media
#[cfg(target_os = "windows")]
#[tauri::command]
fn media_play_pause() -> Result<(), String> {
    let session = get_current_session()?;
    
    let op = session.TryTogglePlayPauseAsync()
        .map_err(|e| format!("Failed to toggle play/pause: {}", e))?;
    
    let _success = poll_bool_op(op)?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn media_play_pause() -> Result<(), String> {
    Err("Media controls not supported on this platform".to_string())
}

/// Skip to next track
#[cfg(target_os = "windows")]
#[tauri::command]
fn media_next() -> Result<(), String> {
    let session = get_current_session()?;
    
    let op = session.TrySkipNextAsync()
        .map_err(|e| format!("Failed to skip next: {}", e))?;
    
    let _success = poll_bool_op(op)?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn media_next() -> Result<(), String> {
    Err("Media controls not supported on this platform".to_string())
}

/// Skip to previous track
#[cfg(target_os = "windows")]
#[tauri::command]
fn media_previous() -> Result<(), String> {
    let session = get_current_session()?;
    
    let op = session.TrySkipPreviousAsync()
        .map_err(|e| format!("Failed to skip previous: {}", e))?;
    
    let _success = poll_bool_op(op)?;
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn media_previous() -> Result<(), String> {
    Err("Media controls not supported on this platform".to_string())
}

// =============================================================================
// Volume Control Commands
// =============================================================================

/// Get system volume
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_system_volume() -> Result<VolumeInfo, String> {
    unsafe {
        // Initialize COM
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        // Get device enumerator
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        // Get default audio endpoint
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get audio endpoint: {}", e))?;
        
        // Get volume interface
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to get volume interface: {}", e))?;
        
        // Get volume level (0.0 - 1.0)
        let level = volume.GetMasterVolumeLevelScalar()
            .map_err(|e| format!("Failed to get volume level: {}", e))?;
        
        // Get mute state
        let is_muted = volume.GetMute()
            .map_err(|e| format!("Failed to get mute state: {}", e))?
            .as_bool();
        
        Ok(VolumeInfo {
            level: (level * 100.0).round() as u32,
            is_muted,
        })
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_system_volume() -> Result<VolumeInfo, String> {
    Ok(VolumeInfo { level: 0, is_muted: false })
}

/// Set system volume (0-100)
#[cfg(target_os = "windows")]
#[tauri::command]
fn set_system_volume(level: u32) -> Result<(), String> {
    if level > 100 {
        return Err("Volume level must be 0-100".to_string());
    }
    
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get audio endpoint: {}", e))?;
        
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to get volume interface: {}", e))?;
        
        volume.SetMasterVolumeLevelScalar(level as f32 / 100.0, std::ptr::null())
            .map_err(|e| format!("Failed to set volume: {}", e))?;
        
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn set_system_volume(_level: u32) -> Result<(), String> {
    Err("Volume control not supported on this platform".to_string())
}

/// Toggle mute
#[cfg(target_os = "windows")]
#[tauri::command]
fn toggle_mute() -> Result<bool, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get audio endpoint: {}", e))?;
        
        let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to get volume interface: {}", e))?;
        
        let is_muted = volume.GetMute()
            .map_err(|e| format!("Failed to get mute state: {}", e))?
            .as_bool();
        
        volume.SetMute(!is_muted, std::ptr::null())
            .map_err(|e| format!("Failed to toggle mute: {}", e))?;
        
        Ok(!is_muted)
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn toggle_mute() -> Result<bool, String> {
    Err("Volume control not supported on this platform".to_string())
}

// =============================================================================
// Audio Device Commands
// =============================================================================

/// Helper to get device friendly name from IMMDevice using Windows Property Store
#[cfg(target_os = "windows")]
fn get_device_name(device: &IMMDevice) -> Result<String, String> {
    unsafe {
        // Open the property store for read access
        let store: IPropertyStore = device.OpenPropertyStore(STGM_READ)
            .map_err(|e| format!("Failed to open property store: {}", e))?;
        
        // Get the friendly name property
        let value = store.GetValue(&PKEY_Device_FriendlyName)
            .map_err(|e| format!("Failed to get device name property: {}", e))?;
        
        // Extract string from PROPVARIANT using Windows API (allocates; we must free)
        if let Ok(pwstr) = PropVariantToStringAlloc(&value) {
            if !pwstr.0.is_null() {
                let len = (0..).take_while(|&i| *pwstr.0.add(i) != 0).count();
                let slice = std::slice::from_raw_parts(pwstr.0, len);
                let name = String::from_utf16_lossy(slice);
                CoTaskMemFree(Some(pwstr.0 as *const _));
                if !name.is_empty() {
                    return Ok(name);
                }
            }
        }
        
        // Fallback: try to get a name from the device ID
        let id = get_device_id(device)?;
        let short_id = if id.len() > 8 { &id[id.len()-8..] } else { &id };
        Ok(format!("Audio Device {}", short_id))
    }
}

/// Helper to get device ID from IMMDevice
#[cfg(target_os = "windows")]
fn get_device_id(device: &IMMDevice) -> Result<String, String> {
    unsafe {
        let id = device.GetId()
            .map_err(|e| format!("Failed to get device ID: {}", e))?;
        
        // Convert PWSTR to String
        let len = (0..).take_while(|&i| *id.0.add(i) != 0).count();
        let slice = std::slice::from_raw_parts(id.0, len);
        let id_str = String::from_utf16_lossy(slice);
        
        // Free the string
        windows::Win32::System::Com::CoTaskMemFree(Some(id.0 as *const _));
        
        Ok(id_str)
    }
}

/// List all audio output devices
#[cfg(target_os = "windows")]
#[tauri::command]
fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        // Get default device ID for comparison
        let default_device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("Failed to get default device: {}", e))?;
        let default_id = get_device_id(&default_device)?;
        
        // Enumerate all active render devices
        let collection: IMMDeviceCollection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)
            .map_err(|e| format!("Failed to enumerate devices: {}", e))?;
        
        let count = collection.GetCount()
            .map_err(|e| format!("Failed to get device count: {}", e))?;
        
        let mut devices = Vec::new();
        
        for i in 0..count {
            let device = collection.Item(i)
                .map_err(|e| format!("Failed to get device {}: {}", i, e))?;
            
            let id = get_device_id(&device)?;
            let name = get_device_name(&device).unwrap_or_else(|_| format!("Audio Device {}", i + 1));
            let is_default = id == default_id;
            
            devices.push(AudioDevice {
                id,
                name,
                is_default,
            });
        }
        
        Ok(devices)
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn list_audio_devices() -> Result<Vec<AudioDevice>, String> {
    Ok(Vec::new())
}

/// Get the default audio device
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_default_audio_device() -> Result<AudioDevice, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
            .map_err(|e| format!("Failed to get default device: {}", e))?;
        
        let id = get_device_id(&device)?;
        let name = get_device_name(&device)?;
        
        Ok(AudioDevice {
            id,
            name,
            is_default: true,
        })
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_default_audio_device() -> Result<AudioDevice, String> {
    Err("Audio devices not supported on this platform".to_string())
}

// =============================================================================
// Per-App Volume Commands
// =============================================================================

/// List all audio sessions (apps playing audio)
#[cfg(target_os = "windows")]
#[tauri::command]
fn list_audio_sessions() -> Result<Vec<AudioSession>, String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;
        
        // Get audio session manager
        let session_manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to get session manager: {}", e))?;
        
        // Get session enumerator
        let session_enum: IAudioSessionEnumerator = session_manager.GetSessionEnumerator()
            .map_err(|e| format!("Failed to get session enumerator: {}", e))?;
        
        let count = session_enum.GetCount()
            .map_err(|e| format!("Failed to get session count: {}", e))?;
        
        let mut sessions = Vec::new();
        
        for i in 0..count {
            let session: IAudioSessionControl = match session_enum.GetSession(i) {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            // Get session control2 for more info
            let session2: IAudioSessionControl2 = match session.cast() {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            // Get process ID
            let process_id = match session2.GetProcessId() {
                Ok(pid) => pid,
                Err(_) => continue,
            };
            
            // Skip system sounds (process ID 0)
            if process_id == 0 {
                continue;
            }
            
            // Get session state
            let state = session.GetState().unwrap_or(AudioSessionState(0));
            let is_active = state == AudioSessionState(1); // AudioSessionStateActive = 1
            
            // Get display name (or process name as fallback)
            let display_name = session.GetDisplayName()
                .map(|s| {
                    let len = (0..).take_while(|&i| *s.0.add(i) != 0).count();
                    let slice = std::slice::from_raw_parts(s.0, len);
                    let name = String::from_utf16_lossy(slice);
                    windows::Win32::System::Com::CoTaskMemFree(Some(s.0 as *const _));
                    name
                })
                .unwrap_or_default();
            
            // Get app name from session identifier if display name is empty
            let app_name = if display_name.is_empty() || display_name.starts_with("@{") {
                // Try to get from session identifier
                session2.GetSessionIdentifier()
                    .map(|s| {
                        let len = (0..).take_while(|&i| *s.0.add(i) != 0).count();
                        let slice = std::slice::from_raw_parts(s.0, len);
                        let id = String::from_utf16_lossy(slice);
                        windows::Win32::System::Com::CoTaskMemFree(Some(s.0 as *const _));
                        // Extract app name from session ID (usually contains exe path)
                        id.split('\\')
                            .last()
                            .map(|n| n.split('|').next().unwrap_or(n))
                            .map(|n| n.trim_end_matches(".exe").to_string())
                            .unwrap_or_else(|| format!("App {}", process_id))
                    })
                    .unwrap_or_else(|_| format!("App {}", process_id))
            } else {
                display_name
            };
            
            // Get volume interface
            let volume: ISimpleAudioVolume = match session.cast() {
                Ok(v) => v,
                Err(_) => continue,
            };
            
            let level = volume.GetMasterVolume().unwrap_or(1.0);
            let is_muted = volume.GetMute().map(|m| m.as_bool()).unwrap_or(false);
            
            sessions.push(AudioSession {
                session_id: format!("{}", process_id),
                app_name,
                process_id,
                volume: level,
                is_muted,
                is_active,
            });
        }
        
        // Sort by active status (active first), then by name
        sessions.sort_by(|a, b| {
            match (a.is_active, b.is_active) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.app_name.to_lowercase().cmp(&b.app_name.to_lowercase()),
            }
        });
        
        Ok(sessions)
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn list_audio_sessions() -> Result<Vec<AudioSession>, String> {
    Ok(Vec::new())
}

/// Set volume for a specific audio session
#[cfg(target_os = "windows")]
#[tauri::command]
fn set_session_volume(process_id: u32, level: f32) -> Result<(), String> {
    if level < 0.0 || level > 1.0 {
        return Err("Volume level must be 0.0 to 1.0".to_string());
    }
    
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;
        
        let session_manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to get session manager: {}", e))?;
        
        let session_enum: IAudioSessionEnumerator = session_manager.GetSessionEnumerator()
            .map_err(|e| format!("Failed to get session enumerator: {}", e))?;
        
        let count = session_enum.GetCount()
            .map_err(|e| format!("Failed to get session count: {}", e))?;
        
        for i in 0..count {
            let session: IAudioSessionControl = match session_enum.GetSession(i) {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            let session2: IAudioSessionControl2 = match session.cast() {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            let pid = match session2.GetProcessId() {
                Ok(p) => p,
                Err(_) => continue,
            };
            
            if pid == process_id {
                let volume: ISimpleAudioVolume = session.cast()
                    .map_err(|e| format!("Failed to get volume interface: {}", e))?;
                
                volume.SetMasterVolume(level, std::ptr::null())
                    .map_err(|e| format!("Failed to set volume: {}", e))?;
                
                return Ok(());
            }
        }
        
        Err(format!("Session not found for process ID {}", process_id))
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn set_session_volume(_process_id: u32, _level: f32) -> Result<(), String> {
    Err("Per-app volume not supported on this platform".to_string())
}

/// Mute/unmute a specific audio session
#[cfg(target_os = "windows")]
#[tauri::command]
fn set_session_mute(process_id: u32, muted: bool) -> Result<(), String> {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
        
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)
            .map_err(|e| format!("Failed to create device enumerator: {}", e))?;
        
        let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)
            .map_err(|e| format!("Failed to get default audio endpoint: {}", e))?;
        
        let session_manager: IAudioSessionManager2 = device.Activate(CLSCTX_ALL, None)
            .map_err(|e| format!("Failed to get session manager: {}", e))?;
        
        let session_enum: IAudioSessionEnumerator = session_manager.GetSessionEnumerator()
            .map_err(|e| format!("Failed to get session enumerator: {}", e))?;
        
        let count = session_enum.GetCount()
            .map_err(|e| format!("Failed to get session count: {}", e))?;
        
        for i in 0..count {
            let session: IAudioSessionControl = match session_enum.GetSession(i) {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            let session2: IAudioSessionControl2 = match session.cast() {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            let pid = match session2.GetProcessId() {
                Ok(p) => p,
                Err(_) => continue,
            };
            
            if pid == process_id {
                let volume: ISimpleAudioVolume = session.cast()
                    .map_err(|e| format!("Failed to get volume interface: {}", e))?;
                
                volume.SetMute(muted, std::ptr::null())
                    .map_err(|e| format!("Failed to set mute: {}", e))?;
                
                return Ok(());
            }
        }
        
        Err(format!("Session not found for process ID {}", process_id))
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn set_session_mute(_process_id: u32, _muted: bool) -> Result<(), String> {
    Err("Per-app mute not supported on this platform".to_string())
}

// =============================================================================
// Brightness Control Types
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrightnessInfo {
    pub level: u32,       // 0-100
    pub min: u32,         // minimum brightness level
    pub max: u32,         // maximum brightness level
    pub is_supported: bool,
}

// =============================================================================
// Brightness Control Commands
// =============================================================================

/// Helper to get physical monitor handle
#[cfg(target_os = "windows")]
fn get_primary_physical_monitor() -> Result<PHYSICAL_MONITOR, String> {
    unsafe {
        // Get the primary monitor
        let hwnd = GetForegroundWindow();
        let hmonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTOPRIMARY);
        
        // Get number of physical monitors
        let mut num_monitors: u32 = 0;
        GetNumberOfPhysicalMonitorsFromHMONITOR(hmonitor, &mut num_monitors)
            .map_err(|e| format!("Failed to get monitor count: {}", e))?;
        
        if num_monitors == 0 {
            return Err("No physical monitors found".to_string());
        }
        
        // Get physical monitor handles
        let mut monitors = vec![PHYSICAL_MONITOR::default(); num_monitors as usize];
        GetPhysicalMonitorsFromHMONITOR(hmonitor, &mut monitors)
            .map_err(|e| format!("Failed to get physical monitors: {}", e))?;
        
        Ok(monitors[0])
    }
}

/// Get system brightness: try WMI (laptops) first via brightness crate, then DDC/CI (external monitors)
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_system_brightness() -> Result<BrightnessInfo, String> {
    // 1. Try brightness crate first (WMI - works on laptop internal panels)
    for device_result in brightness::blocking::brightness_devices() {
        if let Ok(device) = device_result {
            if let Ok(level) = device.get() {
                return Ok(BrightnessInfo {
                    level: level.min(100),
                    min: 0,
                    max: 100,
                    is_supported: true,
                });
            }
        }
    }

    // 2. Fallback: DDC/CI for external monitors
    unsafe {
        let monitor = match get_primary_physical_monitor() {
            Ok(m) => m,
            Err(_) => {
                return Ok(BrightnessInfo {
                    level: 100,
                    min: 0,
                    max: 100,
                    is_supported: false,
                });
            }
        };

        let mut min_brightness: u32 = 0;
        let mut current_brightness: u32 = 0;
        let mut max_brightness: u32 = 0;

        let result = GetMonitorBrightness(
            monitor.hPhysicalMonitor,
            &mut min_brightness,
            &mut current_brightness,
            &mut max_brightness,
        );

        let _ = DestroyPhysicalMonitor(monitor.hPhysicalMonitor);

        if result != 0 {
            let range = max_brightness - min_brightness;
            let normalized = if range > 0 {
                ((current_brightness - min_brightness) * 100) / range
            } else {
                100
            };

            Ok(BrightnessInfo {
                level: normalized,
                min: min_brightness,
                max: max_brightness,
                is_supported: true,
            })
        } else {
            Ok(BrightnessInfo {
                level: 100,
                min: 0,
                max: 100,
                is_supported: false,
            })
        }
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_system_brightness() -> Result<BrightnessInfo, String> {
    Ok(BrightnessInfo {
        level: 100,
        min: 0,
        max: 100,
        is_supported: false,
    })
}

/// Payload for set_system_brightness (frontend sends { level: 0..100 })
#[derive(Deserialize)]
struct SetBrightnessPayload {
    level: u32,
}

/// Set system brightness (0-100): try WMI (laptops) first, then DDC/CI (external monitors)
#[cfg(target_os = "windows")]
#[tauri::command]
fn set_system_brightness(payload: SetBrightnessPayload) -> Result<(), String> {
    let level = payload.level.min(100);

    // 1. Try brightness crate first (WMI - works on laptop internal panels)
    for device_result in brightness::blocking::brightness_devices() {
        if let Ok(device) = device_result {
            if device.set(level).is_ok() {
                return Ok(());
            }
        }
    }

    // 2. Fallback: DDC/CI for external monitors
    unsafe {
        let monitor = get_primary_physical_monitor()?;

        let mut min_brightness: u32 = 0;
        let mut current_brightness: u32 = 0;
        let mut max_brightness: u32 = 0;

        let _ = GetMonitorBrightness(
            monitor.hPhysicalMonitor,
            &mut min_brightness,
            &mut current_brightness,
            &mut max_brightness,
        );

        let range = max_brightness - min_brightness;
        let actual_level = min_brightness + (level * range) / 100;

        let result = SetMonitorBrightness(monitor.hPhysicalMonitor, actual_level);

        let _ = DestroyPhysicalMonitor(monitor.hPhysicalMonitor);

        if result != 0 {
            Ok(())
        } else {
            Err("Failed to set brightness - DDC/CI may not be supported".to_string())
        }
    }
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn set_system_brightness(_payload: SetBrightnessPayload) -> Result<(), String> {
    Err("Brightness control not supported on this platform".to_string())
}

// =============================================================================
// Notification Commands
// =============================================================================

/// Helper to poll notification listener access
#[cfg(target_os = "windows")]
fn poll_notification_access() -> Result<UserNotificationListenerAccessStatus, String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get notification listener: {}", e))?;
    
    let op = listener.RequestAccessAsync()
        .map_err(|e| format!("Failed to request notification access: {}", e))?;
    
    // Poll until complete
    for _ in 0..100 {
        let status = op.Status().map_err(|e| format!("Failed to get status: {}", e))?;
        if status == AsyncStatus::Completed {
            return op.GetResults().map_err(|e| format!("Failed to get results: {}", e));
        }
        if status == AsyncStatus::Error {
            return Err("Async operation failed".to_string());
        }
        thread::sleep(Duration::from_millis(10));
    }
    Err("Timeout waiting for notification access".to_string())
}

#[cfg(not(target_os = "windows"))]
fn poll_notification_access() -> Result<(), String> {
    Err("Notifications not supported on this platform".to_string())
}

/// Helper to poll notifications list
#[cfg(target_os = "windows")]
fn poll_notifications_list(listener: &UserNotificationListener) -> Result<Vec<UserNotification>, String> {
    let op = listener.GetNotificationsAsync(windows::UI::Notifications::NotificationKinds::Toast)
        .map_err(|e| format!("Failed to get notifications: {}", e))?;
    
    for _ in 0..100 {
        let status = op.Status().map_err(|e| format!("Failed to get status: {}", e))?;
        if status == AsyncStatus::Completed {
            let notifs = op.GetResults()
                .map_err(|e| format!("Failed to get results: {}", e))?;
            
            // Convert IVectorView to Vec
            let mut result = Vec::new();
            let count = notifs.Size().unwrap_or(0);
            for i in 0..count {
                if let Ok(n) = notifs.GetAt(i) {
                    result.push(n);
                }
            }
            return Ok(result);
        }
        if status == AsyncStatus::Error {
            return Err("Async operation failed".to_string());
        }
        thread::sleep(Duration::from_millis(10));
    }
    Err("Timeout waiting for notifications".to_string())
}

#[cfg(not(target_os = "windows"))]
fn poll_notifications_list(_listener: &()) -> Result<Vec<()>, String> {
    Err("Notifications not supported on this platform".to_string())
}

/// Request notification access and check if granted
#[cfg(target_os = "windows")]
#[tauri::command]
fn check_notification_access() -> Result<bool, String> {
    let status = poll_notification_access()?;
    Ok(status == UserNotificationListenerAccessStatus::Allowed)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn check_notification_access() -> Result<bool, String> {
    Ok(false)
}

/// Get recent notifications
#[cfg(target_os = "windows")]
#[tauri::command]
fn get_notifications() -> Result<Vec<SystemNotification>, String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get notification listener: {}", e))?;
    
    // Check access first
    let access = poll_notification_access()?;
    if access != UserNotificationListenerAccessStatus::Allowed {
        return Ok(Vec::new()); // No access, return empty list
    }
    
    let notifications = poll_notifications_list(&listener)?;
    
    let mut result = Vec::new();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    
    for (idx, notif) in notifications.iter().take(10).enumerate() {
        let id = notif.Id().unwrap_or(idx as u32);
        
        // Get real app display name from UserNotification.AppInfo -> DisplayInfo -> DisplayName
        let app_name = notif
            .AppInfo()
            .ok()
            .and_then(|app_info| app_info.DisplayInfo().ok())
            .and_then(|display_info| display_info.DisplayName().ok())
            .map(|h| h.to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Windows App".to_string());
        
        // Get notification content
        let notification = match notif.Notification() {
            Ok(n) => n,
            Err(_) => continue,
        };
        
        // Get visual content
        let visual = match notification.Visual() {
            Ok(v) => v,
            Err(_) => continue,
        };
        
        // Try to extract title and body from binding
        let mut title = String::new();
        let mut body = String::new();
        
        if let Ok(bindings) = visual.Bindings() {
            if let Ok(count) = bindings.Size() {
                for i in 0..count {
                    if let Ok(binding) = bindings.GetAt(i) {
                        // Get text elements
                        if let Ok(elements) = binding.GetTextElements() {
                            if let Ok(elem_count) = elements.Size() {
                                for j in 0..elem_count {
                                    if let Ok(elem) = elements.GetAt(j) {
                                        if let Ok(text) = elem.Text() {
                                            let text_str = text.to_string();
                                            if title.is_empty() {
                                                title = text_str;
                                            } else if body.is_empty() {
                                                body = text_str;
                                            } else {
                                                body.push_str("\n");
                                                body.push_str(&text_str);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        break; // Only process first binding
                    }
                }
            }
        }
        
        // Prefer notification CreationTime (100-ns since 1601-01-01), fallback to approximate
        let timestamp = notif
            .CreationTime()
            .ok()
            .map(|dt| {
                let ticks: i64 = dt.UniversalTime;
                const EPOCH_OFFSET_100NS: i64 = 11644473600 * 10_000_000; // 1601 to 1970 in 100-ns
                let unix_ms = ((ticks - EPOCH_OFFSET_100NS) / 10_000) as u64;
                unix_ms
            })
            .filter(|&t| t > 0 && t < now + 86400_000) // sanity: within last 24h or future 1 day
            .unwrap_or_else(|| now.saturating_sub(idx as u64 * 60000));
        
        if !title.is_empty() || !body.is_empty() {
            result.push(SystemNotification {
                id,
                app_name,
                title,
                body,
                timestamp,
            });
        }
    }
    
    Ok(result)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn get_notifications() -> Result<Vec<SystemNotification>, String> {
    Ok(Vec::new())
}

/// Activate (bring to foreground) the app that created the notification with the given ID.
/// Uses the same mechanism as Windows Action Center: the app is identified by its
/// AppUserModelId (AUMID); we launch it via the shell (explorer shell:AppsFolder\AUMID)
/// so both UWP and desktop apps (e.g. WhatsApp) are activated correctly.
#[cfg(target_os = "windows")]
#[tauri::command]
fn activate_notification(id: u32) -> Result<(), String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get notification listener: {}", e))?;

    let access = poll_notification_access()?;
    if access != UserNotificationListenerAccessStatus::Allowed {
        return Err("Notification access not granted".to_string());
    }

    let notifications = poll_notifications_list(&listener)?;
    let notif = notifications
        .iter()
        .find(|n| n.Id().unwrap_or(0) == id)
        .ok_or_else(|| format!("Notification {} not found", id))?;

    let app_info = notif
        .AppInfo()
        .map_err(|e| format!("Failed to get app info: {}", e))?;

    let aumid = app_info
        .AppUserModelId()
        .map_err(|e| format!("AppUserModelId not available: {}", e))?
        .to_string();
    if aumid.is_empty() {
        return Err("AppUserModelId is empty".to_string());
    }

    // Allow the activated app to take foreground (same as when user clicks in Action Center).
    unsafe {
        let _ = AllowSetForegroundWindow(ASFW_ANY);
    }

    // Activate via shell:AppsFolder\{AUMID}. Try two methods:
    // 1) Open the shell path directly (lpFile = "shell:AppsFolder\AUMID")
    // 2) If that fails, run explorer.exe with the path as argument (for desktop apps)
    let shell_path = HSTRING::from(format!("shell:AppsFolder\\{}", aumid));
    let result = unsafe {
        ShellExecuteW(
            None,
            &HSTRING::from("open"),
            &shell_path,
            None,
            None,
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize > 32 {
        return Ok(());
    }
    // Fallback: explorer.exe shell:AppsFolder\AUMID (some apps need this)
    let explorer = HSTRING::from("explorer.exe");
    let params = HSTRING::from(format!("shell:AppsFolder\\{}", aumid));
    let result2 = unsafe {
        ShellExecuteW(
            None,
            &HSTRING::from("open"),
            &explorer,
            &params,
            None,
            SW_SHOWNORMAL,
        )
    };
    if result2.0 as isize <= 32 {
        return Err(format!(
            "Failed to activate app (ShellExecute returned {})",
            result2.0 as isize
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn activate_notification(_id: u32) -> Result<(), String> {
    Err("Notification activation not supported on this platform".to_string())
}

/// Dismiss a notification by ID
#[cfg(target_os = "windows")]
#[tauri::command]
fn dismiss_notification(id: u32) -> Result<(), String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get notification listener: {}", e))?;
    
    listener.RemoveNotification(id)
        .map_err(|e| format!("Failed to dismiss notification: {}", e))
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn dismiss_notification(_id: u32) -> Result<(), String> {
    Err("Notifications not supported on this platform".to_string())
}
// =============================================================================
// Auto-Start Commands
// =============================================================================

/// Check if auto-start is enabled
#[tauri::command]
fn check_autostart_enabled(app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch()
            .is_enabled()
            .map_err(|e| format!("Failed to check autostart status: {}", e))
    }
    #[cfg(not(desktop))]
    {
        Ok(false)
    }
}

/// Enable or disable auto-start
#[tauri::command]
fn set_autostart_enabled(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    #[cfg(desktop)]
    {
        use tauri_plugin_autostart::ManagerExt;
        let autostart = app.autolaunch();
        if enabled {
            autostart.enable()
                .map_err(|e| format!("Failed to enable autostart: {}", e))
        } else {
            autostart.disable()
                .map_err(|e| format!("Failed to disable autostart: {}", e))
        }
    }
    #[cfg(not(desktop))]
    {
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(target_os = "windows")]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            resize_window,
            position_window,
            resize_and_center,
            is_foreground_fullscreen,
            get_scale_factor,
            // Media session
            get_media_session,
            media_play_pause,
            media_next,
            media_previous,
            // Volume control
            get_system_volume,
            set_system_volume,
            toggle_mute,
            // Audio devices
            list_audio_devices,
            get_default_audio_device,
            // Per-app volume
            list_audio_sessions,
            set_session_volume,
            set_session_mute,
            // Brightness control
            get_system_brightness,
            set_system_brightness,
            // Notifications
            check_notification_access,
            get_notifications,
            dismiss_notification,
            activate_notification,
            // Auto-start
            check_autostart_enabled,
            set_autostart_enabled
        ])
        .setup(|app| {
            // Desktop-only UX (tray icon / window positioning). Mobile builds should skip this.
            #[cfg(desktop)]
            {
                // System tray with Quit so the app can be closed (window has no title bar / taskbar)
                let quit_i = MenuItem::with_id(app, "quit", "Quit PILLAR", true, None::<&str>)
                    .map_err(|e| e.to_string())?;
                let menu = Menu::with_items(app, &[&quit_i]).map_err(|e| e.to_string())?;
                let mut tray_builder = TrayIconBuilder::new()
                    .menu(&menu)
                    .show_menu_on_left_click(true)
                    .on_menu_event(move |app, event| {
                        if event.id.as_ref() == "quit" {
                            app.exit(0);
                        }
                    });

                if let Some(icon) = app.default_window_icon() {
                    tray_builder = tray_builder.icon(icon.clone());
                }

                let _tray = tray_builder
                    .build(app)
                    .map_err(|e| e.to_string())?;

                // Window positioning is a desktop API; ignore failures.
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(Some(monitor)) = window.primary_monitor() {
                        let monitor_size = monitor.size();
                        let scale_factor = monitor.scale_factor();
                        let window_width = 450.0;
                        let x = (monitor_size.width as f64 / scale_factor) / 2.0 - window_width / 2.0;
                        let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                            x,
                            y: 0.0,
                        }));
                    }
                }
            }

            #[cfg(target_os = "windows")]
            {
                use tauri::Emitter;
                match UserNotificationListener::Current() {
                    Ok(listener) => {
                        match poll_notification_access() {
                            Ok(UserNotificationListenerAccessStatus::Allowed) => {
                                let app_handle = app.handle().clone();
                                let handler = TypedEventHandler::new(
                                    move |_listener: &Option<UserNotificationListener>,
                                          _args: &Option<UserNotificationChangedEventArgs>| {
                                        let _ = app_handle.emit("notification-changed", ());
                                        Ok(())
                                    },
                                );
                                match listener.NotificationChanged(&handler) {
                                    Ok(_) => {
                                        eprintln!("[PILLAR] Successfully subscribed to NotificationChanged");
                                    }
                                    Err(e) => {
                                        eprintln!("[PILLAR] Failed to subscribe to NotificationChanged: {:?}", e);
                                        eprintln!("[PILLAR] Notifications will still work via polling fallback");
                                    }
                                }
                            }
                            Ok(status) => {
                                eprintln!("[PILLAR] Notification access not granted: {:?}", status);
                                eprintln!("[PILLAR] Enable notification access in Windows Settings > Privacy > Notifications");
                            }
                            Err(e) => {
                                eprintln!("[PILLAR] Failed to check notification access: {}", e);
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("[PILLAR] Failed to get UserNotificationListener: {:?}", e);
                        eprintln!("[PILLAR] Notifications will still work via polling fallback");
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
