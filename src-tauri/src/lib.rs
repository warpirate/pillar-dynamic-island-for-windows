use tauri::Manager;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect};

#[cfg(desktop)]
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

/// Set click-through mode for the window
/// When enabled, mouse events pass through the window to apps behind it
#[tauri::command]
fn set_click_through(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| format!("Failed to set click-through: {}", e))
}

/// Resize window to specified dimensions
#[tauri::command]
fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    if width <= 0.0 || height <= 0.0 {
        return Err("Invalid dimensions".to_string());
    }
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| format!("Failed to resize: {}", e))
}

/// Position window at top-center of primary monitor
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

/// Check if the foreground window is fullscreen/maximized
/// Uses 90% threshold to account for taskbar visibility variations
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
    
    // Consider fullscreen if window covers 90%+ of monitor
    // Handles: fullscreen apps, maximized windows, games, video players
    let threshold_w = (mon_w * 90) / 100;
    let threshold_h = (mon_h * 90) / 100;
    
    Ok(w >= threshold_w && h >= threshold_h)
}

/// Resize window and re-center in a single atomic operation
/// Prevents visual glitches from separate resize + position calls
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

/// Get current monitor scale factor for DPI-aware calculations
#[tauri::command]
fn get_scale_factor(window: tauri::Window) -> Result<f64, String> {
    let monitor = window
        .primary_monitor()
        .map_err(|e| format!("Failed to get monitor: {}", e))?
        .ok_or_else(|| "No primary monitor".to_string())?;
    
    Ok(monitor.scale_factor())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            set_click_through,
            resize_window,
            position_window,
            resize_and_center,
            is_foreground_fullscreen,
            get_scale_factor
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                let _ = app.handle().plugin(
                    tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None),
                );
                let autostart = app.autolaunch();
                let _ = autostart.enable();
            }

            let window = app.get_webview_window("main").unwrap();
            if let Some(monitor) = window.primary_monitor().unwrap() {
                let monitor_size = monitor.size();
                let scale_factor = monitor.scale_factor();
                let window_width = 450.0;
                let x = (monitor_size.width as f64 / scale_factor) / 2.0 - window_width / 2.0;
                let _ = window.set_position(tauri::Position::Logical(tauri::LogicalPosition {
                    x,
                    y: 0.0,
                }));
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
