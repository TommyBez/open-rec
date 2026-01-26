use serde::{Deserialize, Serialize};

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

/// List available capture sources
#[cfg(target_os = "macos")]
pub fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, String> {
    let content = SCShareableContent::get().map_err(|e| format!("Failed to get shareable content: {:?}", e))?;

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
pub fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, String> {
    Err("Screen capture is only supported on macOS".to_string())
}
