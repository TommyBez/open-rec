use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

#[cfg(target_os = "macos")]
use screencapturekit::{
    prelude::*,
    recording_output::{SCRecordingOutput, SCRecordingOutputConfiguration, SCRecordingOutputCodec, SCRecordingOutputFileType},
    shareable_content::SCShareableContent,
};

use super::SourceType;

/// Recording options from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingOptions {
    pub source_id: String,
    pub source_type: SourceType,
    pub capture_camera: bool,
    pub capture_microphone: bool,
    pub capture_system_audio: bool,
}

/// Recording state
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingState {
    Recording,
    Paused,
    Stopped,
}

/// Information about an active recording session
#[derive(Debug)]
pub struct RecordingSession {
    pub project_id: String,
    pub options: RecordingOptions,
    pub state: RecordingState,
    pub screen_video_path: PathBuf,
    pub camera_video_path: Option<PathBuf>,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub segment_index: u32,
    #[cfg(target_os = "macos")]
    pub stream: Option<SCStream>,
    #[cfg(target_os = "macos")]
    pub recording_output: Option<SCRecordingOutput>,
}

/// Global recorder state
pub struct RecorderState {
    pub sessions: HashMap<String, RecordingSession>,
    pub recordings_dir: PathBuf,
}

impl RecorderState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let recordings_dir = app_data_dir.join("recordings");
        std::fs::create_dir_all(&recordings_dir).ok();
        Self {
            sessions: HashMap::new(),
            recordings_dir,
        }
    }
}

pub type SharedRecorderState = Arc<Mutex<RecorderState>>;

/// Result of starting a recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingResult {
    pub project_id: String,
    pub screen_video_path: String,
    pub camera_video_path: Option<String>,
}

/// Start screen recording
#[cfg(target_os = "macos")]
pub fn start_recording(
    state: &SharedRecorderState,
    options: RecordingOptions,
) -> Result<StartRecordingResult, String> {
    let project_id = Uuid::new_v4().to_string();
    
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    // Create project directory
    let project_dir = state_guard.recordings_dir.join(&project_id);
    std::fs::create_dir_all(&project_dir).map_err(|e| format!("Failed to create project dir: {}", e))?;
    
    let screen_video_path = project_dir.join("screen.mp4");
    let camera_video_path = if options.capture_camera {
        Some(project_dir.join("camera.mp4"))
    } else {
        None
    };
    
    // Get shareable content
    let content = SCShareableContent::get()
        .map_err(|e| format!("Failed to get shareable content: {:?}", e))?;
    
    // Create content filter based on source type
    let filter = match options.source_type {
        SourceType::Display => {
            let display_id: u32 = options.source_id.parse()
                .map_err(|_| "Invalid display ID")?;
            let display = content.displays()
                .into_iter()
                .find(|d| d.display_id() == display_id)
                .ok_or("Display not found")?;
            SCContentFilter::create()
                .with_display(&display)
                .with_excluding_windows(&[])
                .build()
        }
        SourceType::Window => {
            let window_id: u32 = options.source_id.parse()
                .map_err(|_| "Invalid window ID")?;
            let windows = content.windows();
            let window = windows
                .iter()
                .find(|w| w.window_id() == window_id)
                .ok_or("Window not found")?;
            SCContentFilter::create()
                .with_window(window)
                .build()
        }
    };
    
    // Configure stream
    let config = SCStreamConfiguration::new()
        .with_width(1920)
        .with_height(1080)
        .with_pixel_format(PixelFormat::YCbCr_420v)
        .with_shows_cursor(true)
        .with_captures_audio(options.capture_system_audio)
        .with_sample_rate(48000)
        .with_channel_count(2);
    
    // Configure recording output
    let recording_config = SCRecordingOutputConfiguration::new()
        .with_output_url(&screen_video_path)
        .with_video_codec(SCRecordingOutputCodec::H264)
        .with_output_file_type(SCRecordingOutputFileType::MP4);
    
    let recording_output = SCRecordingOutput::new(&recording_config)
        .ok_or("Failed to create recording output")?;
    
    // Create and start stream
    let stream = SCStream::new(&filter, &config);
    stream.add_recording_output(&recording_output)
        .map_err(|e| format!("Failed to add recording output: {:?}", e))?;
    stream.start_capture()
        .map_err(|e| format!("Failed to start capture: {:?}", e))?;
    
    // Store session
    let session = RecordingSession {
        project_id: project_id.clone(),
        options: options.clone(),
        state: RecordingState::Recording,
        screen_video_path: screen_video_path.clone(),
        camera_video_path: camera_video_path.clone(),
        start_time: chrono::Utc::now(),
        segment_index: 0,
        stream: Some(stream),
        recording_output: Some(recording_output),
    };
    
    state_guard.sessions.insert(project_id.clone(), session);
    
    Ok(StartRecordingResult {
        project_id,
        screen_video_path: screen_video_path.to_string_lossy().to_string(),
        camera_video_path: camera_video_path.map(|p| p.to_string_lossy().to_string()),
    })
}

/// Stop screen recording
#[cfg(target_os = "macos")]
pub fn stop_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let session = state_guard.sessions.get_mut(project_id)
        .ok_or("Recording session not found")?;
    
    if let Some(ref stream) = session.stream {
        if let Some(ref recording_output) = session.recording_output {
            stream.remove_recording_output(recording_output)
                .map_err(|e| format!("Failed to remove recording output: {:?}", e))?;
        }
        stream.stop_capture()
            .map_err(|e| format!("Failed to stop capture: {:?}", e))?;
    }
    
    session.state = RecordingState::Stopped;
    session.stream = None;
    session.recording_output = None;
    
    Ok(())
}

/// Pause recording (creates a new segment)
#[cfg(target_os = "macos")]
pub fn pause_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let session = state_guard.sessions.get_mut(project_id)
        .ok_or("Recording session not found")?;
    
    if session.state != RecordingState::Recording {
        return Err("Recording is not active".to_string());
    }
    
    // Stop current recording output
    if let Some(ref stream) = session.stream {
        if let Some(ref recording_output) = session.recording_output {
            stream.remove_recording_output(recording_output)
                .map_err(|e| format!("Failed to remove recording output: {:?}", e))?;
        }
        stream.stop_capture()
            .map_err(|e| format!("Failed to stop capture for pause: {:?}", e))?;
    }
    
    session.state = RecordingState::Paused;
    session.stream = None;
    session.recording_output = None;
    
    Ok(())
}

/// Resume recording (starts a new segment)
#[cfg(target_os = "macos")]
pub fn resume_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    let session = state_guard.sessions.get_mut(project_id)
        .ok_or("Recording session not found")?;
    
    if session.state != RecordingState::Paused {
        return Err("Recording is not paused".to_string());
    }
    
    // Increment segment index
    session.segment_index += 1;
    
    // Get the project directory
    let project_dir = session.screen_video_path.parent()
        .ok_or("Invalid video path")?;
    
    // Create new segment file path
    let segment_path = project_dir.join(format!("screen_part{}.mp4", session.segment_index));
    
    // Get shareable content again
    let content = SCShareableContent::get()
        .map_err(|e| format!("Failed to get shareable content: {:?}", e))?;
    
    // Recreate filter
    let filter = match session.options.source_type {
        SourceType::Display => {
            let display_id: u32 = session.options.source_id.parse()
                .map_err(|_| "Invalid display ID")?;
            let display = content.displays()
                .into_iter()
                .find(|d| d.display_id() == display_id)
                .ok_or("Display not found")?;
            SCContentFilter::create()
                .with_display(&display)
                .with_excluding_windows(&[])
                .build()
        }
        SourceType::Window => {
            let window_id: u32 = session.options.source_id.parse()
                .map_err(|_| "Invalid window ID")?;
            let windows = content.windows();
            let window = windows
                .iter()
                .find(|w| w.window_id() == window_id)
                .ok_or("Window not found")?;
            SCContentFilter::create()
                .with_window(window)
                .build()
        }
    };
    
    // Configure stream
    let config = SCStreamConfiguration::new()
        .with_width(1920)
        .with_height(1080)
        .with_pixel_format(PixelFormat::YCbCr_420v)
        .with_shows_cursor(true)
        .with_captures_audio(session.options.capture_system_audio)
        .with_sample_rate(48000)
        .with_channel_count(2);
    
    // Configure new recording output
    let recording_config = SCRecordingOutputConfiguration::new()
        .with_output_url(&segment_path)
        .with_video_codec(SCRecordingOutputCodec::H264)
        .with_output_file_type(SCRecordingOutputFileType::MP4);
    
    let recording_output = SCRecordingOutput::new(&recording_config)
        .ok_or("Failed to create recording output")?;
    
    // Create and start new stream
    let stream = SCStream::new(&filter, &config);
    stream.add_recording_output(&recording_output)
        .map_err(|e| format!("Failed to add recording output: {:?}", e))?;
    stream.start_capture()
        .map_err(|e| format!("Failed to resume capture: {:?}", e))?;
    
    session.state = RecordingState::Recording;
    session.stream = Some(stream);
    session.recording_output = Some(recording_output);
    
    Ok(())
}

// Non-macOS stubs
#[cfg(not(target_os = "macos"))]
pub fn start_recording(
    _state: &SharedRecorderState,
    _options: RecordingOptions,
) -> Result<StartRecordingResult, String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn stop_recording(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<(), String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn pause_recording(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<(), String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn resume_recording(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<(), String> {
    Err("Screen capture is only supported on macOS".to_string())
}
