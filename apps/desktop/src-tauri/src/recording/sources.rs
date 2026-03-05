use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[cfg(target_os = "macos")]
use screencapturekit::shareable_content::SCShareableContent;
#[cfg(target_os = "linux")]
use xcap::{Monitor, Window};

/// Represents a capture source (display or window)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSource {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub source_type: SourceType,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SourceType {
    Display,
    Window,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
pub(super) struct LinuxDisplaySource {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
pub(super) struct LinuxWindowSource {
    pub id: u32,
    pub name: String,
    pub width: u32,
    pub height: u32,
}

#[cfg(target_os = "linux")]
fn xcap_error_context(context: &str, error: impl std::fmt::Display) -> AppError {
    AppError::Message(format!("{context}: {error}"))
}

#[cfg(target_os = "linux")]
pub(super) fn linux_list_display_sources() -> Result<Vec<LinuxDisplaySource>, AppError> {
    let mut displays = Monitor::all()
        .map_err(|error| xcap_error_context("Failed to enumerate Linux displays", error))?
        .into_iter()
        .map(|monitor| {
            let id = monitor
                .id()
                .map_err(|error| xcap_error_context("Failed to read Linux display id", error))?;
            let x = monitor.x().map_err(|error| {
                xcap_error_context("Failed to read Linux display x position", error)
            })?;
            let y = monitor.y().map_err(|error| {
                xcap_error_context("Failed to read Linux display y position", error)
            })?;
            let width = monitor
                .width()
                .map_err(|error| xcap_error_context("Failed to read Linux display width", error))?;
            let height = monitor.height().map_err(|error| {
                xcap_error_context("Failed to read Linux display height", error)
            })?;
            let name = monitor.name().unwrap_or_else(|_| format!("Display {}", id));
            Ok(LinuxDisplaySource {
                id,
                name,
                x,
                y,
                width,
                height,
            })
        })
        .collect::<Result<Vec<_>, AppError>>()?;
    displays.sort_by_key(|display| display.id);
    Ok(displays)
}

#[cfg(target_os = "linux")]
pub(super) fn linux_list_window_sources() -> Result<Vec<LinuxWindowSource>, AppError> {
    let mut windows = Window::all()
        .map_err(|error| xcap_error_context("Failed to enumerate Linux windows", error))?
        .into_iter()
        .filter_map(|window| {
            let id = match window.id() {
                Ok(value) => value,
                Err(_) => return None,
            };
            let width = match window.width() {
                Ok(value) if value > 0 => value,
                _ => return None,
            };
            let height = match window.height() {
                Ok(value) if value > 0 => value,
                _ => return None,
            };
            if matches!(window.is_minimized(), Ok(true)) {
                return None;
            }
            let app_name = window
                .app_name()
                .unwrap_or_else(|_| "Unknown App".to_string());
            let title = window.title().unwrap_or_else(|_| format!("Window {}", id));
            let cleaned_title = title.trim().to_string();
            let cleaned_app_name = app_name.trim().to_string();
            let name = if cleaned_title.is_empty() {
                cleaned_app_name
            } else if cleaned_app_name.is_empty() {
                cleaned_title
            } else {
                format!("{} - {}", cleaned_app_name, cleaned_title)
            };
            Some(LinuxWindowSource {
                id,
                name,
                width,
                height,
            })
        })
        .collect::<Vec<_>>();
    windows.sort_by_key(|window| window.id);
    Ok(windows)
}

/// Check if screen recording permission is granted
#[cfg(target_os = "macos")]
pub fn check_screen_recording_permission() -> bool {
    // CGPreflightScreenCaptureAccess returns true if permission is granted
    unsafe {
        extern "C" {
            fn CGPreflightScreenCaptureAccess() -> bool;
        }
        CGPreflightScreenCaptureAccess()
    }
}

/// Request screen recording permission (shows system dialog)
#[cfg(target_os = "macos")]
pub fn request_screen_recording_permission() -> bool {
    // CGRequestScreenCaptureAccess prompts the user if not already granted
    unsafe {
        extern "C" {
            fn CGRequestScreenCaptureAccess() -> bool;
        }
        CGRequestScreenCaptureAccess()
    }
}

#[cfg(target_os = "linux")]
pub fn check_screen_recording_permission() -> bool {
    true
}

#[cfg(target_os = "linux")]
pub fn request_screen_recording_permission() -> bool {
    true
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn check_screen_recording_permission() -> bool {
    false
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn request_screen_recording_permission() -> bool {
    false
}

/// List available capture sources
#[cfg(target_os = "macos")]
pub fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, AppError> {
    // Check permission first - if not granted, return empty list without triggering prompt
    if !check_screen_recording_permission() {
        return Ok(vec![]);
    }

    let content = SCShareableContent::get()
        .map_err(|e| AppError::Message(format!("Failed to get shareable content: {:?}", e)))?;

    match source_type {
        SourceType::Display => {
            let mut displays = content.displays().into_iter().collect::<Vec<_>>();
            displays.sort_by_key(|display| display.display_id());
            Ok(displays
                .into_iter()
                .enumerate()
                .map(|(index, display)| CaptureSource {
                    id: display.display_id().to_string(),
                    name: format!("Display {}", index + 1),
                    source_type: SourceType::Display,
                    thumbnail: None,
                })
                .collect())
        }
        SourceType::Window => {
            let windows = content.windows();
            Ok(windows
                .iter()
                .filter(|w| w.is_on_screen())
                .map(|w| {
                    let app_name = w
                        .owning_application()
                        .map(|app| app.application_name())
                        .unwrap_or_else(|| "Unknown App".to_string());
                    let window_title = w
                        .title()
                        .unwrap_or_else(|| format!("Window {}", w.window_id()));
                    let name = if window_title.trim().is_empty() {
                        app_name.clone()
                    } else if app_name.trim().is_empty() {
                        window_title.clone()
                    } else {
                        format!("{} - {}", app_name, window_title)
                    };
                    CaptureSource {
                        id: w.window_id().to_string(),
                        name,
                        source_type: SourceType::Window,
                        thumbnail: None,
                    }
                })
                .collect())
        }
    }
}

#[cfg(target_os = "linux")]
pub fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, AppError> {
    match source_type {
        SourceType::Display => Ok(linux_list_display_sources()?
            .into_iter()
            .enumerate()
            .map(|(index, display)| CaptureSource {
                id: display.id.to_string(),
                name: if display.name.trim().is_empty() {
                    format!("Display {}", index + 1)
                } else {
                    display.name
                },
                source_type: SourceType::Display,
                thumbnail: None,
            })
            .collect()),
        SourceType::Window => Ok(linux_list_window_sources()?
            .into_iter()
            .map(|window| CaptureSource {
                id: window.id.to_string(),
                name: if window.name.trim().is_empty() {
                    format!("Window {}", window.id)
                } else {
                    window.name
                },
                source_type: SourceType::Window,
                thumbnail: None,
            })
            .collect()),
    }
}

/// Fallback for unsupported platforms
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn list_capture_sources(_source_type: SourceType) -> Result<Vec<CaptureSource>, AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS and Linux".to_string(),
    ))
}
