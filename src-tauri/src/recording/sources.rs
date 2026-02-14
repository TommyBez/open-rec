use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[cfg(target_os = "macos")]
use screencapturekit::shareable_content::SCShareableContent;

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

#[cfg(not(target_os = "macos"))]
pub fn check_screen_recording_permission() -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
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
            let displays = content.displays();
            Ok(displays
                .iter()
                .map(|d| CaptureSource {
                    id: d.display_id().to_string(),
                    name: format!("Display {}", d.display_id()),
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
                        .unwrap_or_default();
                    let window_title = w.title().unwrap_or_default();
                    let name = if window_title.is_empty() {
                        app_name.clone()
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

/// Fallback for non-macOS platforms
#[cfg(not(target_os = "macos"))]
pub fn list_capture_sources(_source_type: SourceType) -> Result<Vec<CaptureSource>, AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS".to_string(),
    ))
}
