use tauri::Manager;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect};

#[cfg(desktop)]
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

#[tauri::command]
fn set_click_through(window: tauri::Window, ignore: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(ignore)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn position_window(window: tauri::Window) -> Result<(), String> {
    if let Some(monitor) = window.primary_monitor().map_err(|e| e.to_string())? {
        let monitor_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let window_size = window.outer_size().map_err(|e| e.to_string())?;
        let w = window_size.width as f64 / scale_factor;
        let x = (monitor_size.width as f64 / scale_factor) / 2.0 - w / 2.0;
        let y = 0.0;
        window
            .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Returns true if the foreground (active) window is fullscreen on the primary monitor.
#[tauri::command]
fn is_foreground_fullscreen(window: tauri::Window) -> Result<bool, String> {
    let Some(monitor) = window.primary_monitor().map_err(|e| e.to_string())? else {
        return Ok(false);
    };
    let mon_size = monitor.size();
    let mon_w = mon_size.width as i32;
    let mon_h = mon_size.height as i32;

    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return Ok(false);
    }

    let mut rect = windows::Win32::Foundation::RECT::default();
    if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() {
        return Ok(false);
    }

    let w = rect.right - rect.left;
    let h = rect.bottom - rect.top;
    // Fullscreen if foreground window covers most of the monitor (YouTube, games, maximized browser)
    let threshold_w = (mon_w * 88) / 100;
    let threshold_h = (mon_h * 88) / 100;
    let fullscreen = w >= threshold_w && h >= threshold_h;
    Ok(fullscreen)
}

/// Resize and re-center in one call so the window stays top-center (avoids off-screen after expand).
#[tauri::command]
fn resize_and_center(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(tauri::Size::Logical(tauri::LogicalSize { width, height }))
        .map_err(|e| e.to_string())?;
    if let Some(monitor) = window.primary_monitor().map_err(|e| e.to_string())? {
        let monitor_size = monitor.size();
        let scale_factor = monitor.scale_factor();
        let x = (monitor_size.width as f64 / scale_factor) / 2.0 - width / 2.0;
        let y = 0.0;
        window
            .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
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
            is_foreground_fullscreen
        ])
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(
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
