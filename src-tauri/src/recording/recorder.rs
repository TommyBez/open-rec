use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;

#[cfg(target_os = "macos")]
use screencapturekit::{
    prelude::*,
    recording_output::{
        SCRecordingOutput, SCRecordingOutputCodec, SCRecordingOutputConfiguration,
        SCRecordingOutputFileType,
    },
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
    #[serde(default = "default_quality_preset")]
    pub quality_preset: RecordingQualityPreset,
    #[serde(default = "default_recording_codec")]
    pub codec: RecordingCodec,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum RecordingQualityPreset {
    #[serde(rename = "720p30")]
    P72030,
    #[serde(rename = "1080p30")]
    P1080P30,
    #[serde(rename = "1080p60")]
    P1080P60,
    #[serde(rename = "4k30")]
    P4k30,
    #[serde(rename = "4k60")]
    P4k60,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RecordingCodec {
    H264,
    Hevc,
}

const fn default_quality_preset() -> RecordingQualityPreset {
    RecordingQualityPreset::P1080P30
}

const fn default_recording_codec() -> RecordingCodec {
    RecordingCodec::H264
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
    pub microphone_audio_path: Option<PathBuf>,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub recording_start_time_ms: i64,
    pub segment_index: u32,
    pub capture_width: u32,
    pub capture_height: u32,
    pub capture_fps: u32,
    pub recording_codec: RecordingCodec,
    pub screen_segments: Vec<PathBuf>,
    pub current_segment_path: PathBuf,
    pub active_duration_ms: u64,
    pub last_resume_instant: Option<Instant>,
    pub camera_offset_ms: Option<i64>,
    pub microphone_offset_ms: Option<i64>,
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
        if let Err(error) = std::fs::create_dir_all(&recordings_dir) {
            eprintln!(
                "Failed to ensure recordings directory exists ({}): {}",
                recordings_dir.to_string_lossy(),
                error
            );
        }
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
    pub recording_start_time_ms: i64,
}

/// Result of stopping a recording
#[derive(Debug, Clone)]
pub struct StopRecordingResult {
    pub project_id: String,
    pub screen_video_path: PathBuf,
    pub screen_segment_paths: Vec<PathBuf>,
    pub camera_video_path: Option<PathBuf>,
    pub microphone_audio_path: Option<PathBuf>,
    pub duration_seconds: f64,
    pub source_width: u32,
    pub source_height: u32,
    pub camera_offset_ms: Option<i64>,
    pub microphone_offset_ms: Option<i64>,
}

fn make_even_dimension(value: u32) -> u32 {
    let base = value.max(2);
    if base % 2 == 0 {
        base
    } else {
        base - 1
    }
}

impl RecordingQualityPreset {
    fn max_height(self) -> u32 {
        match self {
            RecordingQualityPreset::P72030 => 720,
            RecordingQualityPreset::P1080P30 | RecordingQualityPreset::P1080P60 => 1080,
            RecordingQualityPreset::P4k30 | RecordingQualityPreset::P4k60 => 2160,
        }
    }

    fn fps(self) -> u32 {
        match self {
            RecordingQualityPreset::P72030
            | RecordingQualityPreset::P1080P30
            | RecordingQualityPreset::P4k30 => 30,
            RecordingQualityPreset::P1080P60 | RecordingQualityPreset::P4k60 => 60,
        }
    }
}

fn resolve_output_dimensions(
    source_width: u32,
    source_height: u32,
    preset: RecordingQualityPreset,
) -> (u32, u32) {
    if source_width == 0 || source_height == 0 {
        return (1920, 1080);
    }

    let max_height = preset.max_height() as f64;
    let source_height_f = source_height as f64;
    let scale = (max_height / source_height_f).min(1.0);

    let scaled_width = make_even_dimension((source_width as f64 * scale).round() as u32);
    let scaled_height = make_even_dimension((source_height as f64 * scale).round() as u32);
    (scaled_width, scaled_height)
}

#[cfg(target_os = "macos")]
fn to_output_codec(codec: RecordingCodec) -> SCRecordingOutputCodec {
    match codec {
        RecordingCodec::H264 => SCRecordingOutputCodec::H264,
        RecordingCodec::Hevc => SCRecordingOutputCodec::HEVC,
    }
}

#[cfg(target_os = "macos")]
fn resolve_capture_dimensions(
    content: &SCShareableContent,
    source_type: SourceType,
    source_id: &str,
) -> Result<(u32, u32), String> {
    let (width, height) = match source_type {
        SourceType::Display => {
            let display_id: u32 = source_id.parse().map_err(|_| "Invalid display ID")?;
            let display = content
                .displays()
                .into_iter()
                .find(|d| d.display_id() == display_id)
                .ok_or("Display not found")?;
            (display.width(), display.height())
        }
        SourceType::Window => {
            let window_id: u32 = source_id.parse().map_err(|_| "Invalid window ID")?;
            let window = content
                .windows()
                .iter()
                .find(|w| w.window_id() == window_id)
                .ok_or("Window not found")?;
            let frame = window.frame();
            (frame.width.round() as u32, frame.height.round() as u32)
        }
    };

    Ok((make_even_dimension(width), make_even_dimension(height)))
}

fn wait_for_file_ready(path: &PathBuf, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    let mut last_size = 0;
    let mut stable_checks = 0;

    while started.elapsed() < timeout {
        match std::fs::metadata(path) {
            Ok(metadata) => {
                let size = metadata.len();
                if size > 1024 && size == last_size {
                    stable_checks += 1;
                    if stable_checks >= 3 {
                        return Ok(());
                    }
                } else {
                    stable_checks = 0;
                    last_size = size;
                }
            }
            Err(_) => {
                stable_checks = 0;
            }
        }

        std::thread::sleep(Duration::from_millis(200));
    }

    Err(format!(
        "Timed out waiting for recording file finalization: {}",
        path.to_string_lossy()
    ))
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
    std::fs::create_dir_all(&project_dir)
        .map_err(|e| format!("Failed to create project dir: {}", e))?;

    let screen_video_path = project_dir.join("screen.mp4");
    let camera_video_path = if options.capture_camera {
        Some(project_dir.join("camera.webm"))
    } else {
        None
    };
    let microphone_audio_path = if options.capture_microphone {
        Some(project_dir.join("microphone.webm"))
    } else {
        None
    };

    // Get shareable content
    let content = SCShareableContent::get()
        .map_err(|e| format!("Failed to get shareable content: {:?}", e))?;

    // Create content filter based on source type
    let filter = match options.source_type {
        SourceType::Display => {
            let display_id: u32 = options
                .source_id
                .parse()
                .map_err(|_| "Invalid display ID")?;
            let display = content
                .displays()
                .into_iter()
                .find(|d| d.display_id() == display_id)
                .ok_or("Display not found")?;
            SCContentFilter::create()
                .with_display(&display)
                .with_excluding_windows(&[])
                .build()
        }
        SourceType::Window => {
            let window_id: u32 = options.source_id.parse().map_err(|_| "Invalid window ID")?;
            let windows = content.windows();
            let window = windows
                .iter()
                .find(|w| w.window_id() == window_id)
                .ok_or("Window not found")?;
            SCContentFilter::create().with_window(window).build()
        }
    };

    let (source_width, source_height) =
        resolve_capture_dimensions(&content, options.source_type, &options.source_id)?;
    let (capture_width, capture_height) =
        resolve_output_dimensions(source_width, source_height, options.quality_preset);
    let capture_fps = options.quality_preset.fps();

    // Configure stream
    let config = SCStreamConfiguration::new()
        .with_width(capture_width)
        .with_height(capture_height)
        .with_fps(capture_fps)
        .with_pixel_format(PixelFormat::YCbCr_420v)
        .with_shows_cursor(true)
        .with_captures_audio(options.capture_system_audio)
        .with_sample_rate(48000)
        .with_channel_count(2);

    // Configure recording output
    let recording_config = SCRecordingOutputConfiguration::new()
        .with_output_url(&screen_video_path)
        .with_video_codec(to_output_codec(options.codec))
        .with_output_file_type(SCRecordingOutputFileType::MP4);

    let recording_output =
        SCRecordingOutput::new(&recording_config).ok_or("Failed to create recording output")?;

    // Create and start stream
    let stream = SCStream::new(&filter, &config);
    stream
        .add_recording_output(&recording_output)
        .map_err(|e| format!("Failed to add recording output: {:?}", e))?;
    stream
        .start_capture()
        .map_err(|e| format!("Failed to start capture: {:?}", e))?;

    let recording_start_time_ms = chrono::Utc::now().timestamp_millis();

    // Store session
    let session = RecordingSession {
        project_id: project_id.clone(),
        options: options.clone(),
        state: RecordingState::Recording,
        screen_video_path: screen_video_path.clone(),
        camera_video_path: camera_video_path.clone(),
        microphone_audio_path: microphone_audio_path.clone(),
        start_time: chrono::Utc::now(),
        recording_start_time_ms,
        segment_index: 0,
        capture_width,
        capture_height,
        capture_fps,
        recording_codec: options.codec,
        screen_segments: vec![screen_video_path.clone()],
        current_segment_path: screen_video_path.clone(),
        active_duration_ms: 0,
        last_resume_instant: Some(Instant::now()),
        camera_offset_ms: None,
        microphone_offset_ms: None,
        stream: Some(stream),
        recording_output: Some(recording_output),
    };

    state_guard.sessions.insert(project_id.clone(), session);

    Ok(StartRecordingResult {
        project_id,
        screen_video_path: screen_video_path.to_string_lossy().to_string(),
        camera_video_path: camera_video_path.map(|p| p.to_string_lossy().to_string()),
        recording_start_time_ms,
    })
}

/// Stop screen recording
#[cfg(target_os = "macos")]
pub fn stop_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<StopRecordingResult, String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut session = state_guard
        .sessions
        .remove(project_id)
        .ok_or("Recording session not found")?;

    let current_segment_path = session.current_segment_path.clone();

    if let Some(ref stream) = session.stream {
        // First stop the capture to signal we're done
        stream
            .stop_capture()
            .map_err(|e| format!("Failed to stop capture: {:?}", e))?;

        // Then remove the recording output - this should trigger file finalization
        if let Some(ref recording_output) = session.recording_output {
            stream
                .remove_recording_output(recording_output)
                .map_err(|e| format!("Failed to remove recording output: {:?}", e))?;
        }

        wait_for_file_ready(&current_segment_path, Duration::from_secs(20))?;
    }

    if let Some(last_resume) = session.last_resume_instant.take() {
        let elapsed = last_resume.elapsed().as_millis() as u64;
        session.active_duration_ms = session.active_duration_ms.saturating_add(elapsed);
    }

    session.state = RecordingState::Stopped;
    session.stream = None;
    session.recording_output = None;

    drop(state_guard);

    Ok(StopRecordingResult {
        project_id: session.project_id.clone(),
        screen_video_path: session.screen_video_path.clone(),
        screen_segment_paths: session.screen_segments.clone(),
        camera_video_path: session.camera_video_path.clone(),
        microphone_audio_path: session.microphone_audio_path.clone(),
        duration_seconds: session.active_duration_ms as f64 / 1000.0,
        source_width: session.capture_width,
        source_height: session.capture_height,
        camera_offset_ms: session.camera_offset_ms,
        microphone_offset_ms: session.microphone_offset_ms,
    })
}

/// Pause recording (creates a new segment)
#[cfg(target_os = "macos")]
pub fn pause_recording(state: &SharedRecorderState, project_id: &str) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or("Recording session not found")?;

    if session.state != RecordingState::Recording {
        return Err("Recording is not active".to_string());
    }

    // Stop current recording output
    if let Some(ref stream) = session.stream {
        if let Some(ref recording_output) = session.recording_output {
            stream
                .remove_recording_output(recording_output)
                .map_err(|e| format!("Failed to remove recording output: {:?}", e))?;
        }
        stream
            .stop_capture()
            .map_err(|e| format!("Failed to stop capture for pause: {:?}", e))?;
    }

    if let Some(last_resume) = session.last_resume_instant.take() {
        let elapsed = last_resume.elapsed().as_millis() as u64;
        session.active_duration_ms = session.active_duration_ms.saturating_add(elapsed);
    }

    wait_for_file_ready(&session.current_segment_path, Duration::from_secs(20))?;

    session.state = RecordingState::Paused;
    session.stream = None;
    session.recording_output = None;

    Ok(())
}

/// Resume recording (starts a new segment)
#[cfg(target_os = "macos")]
pub fn resume_recording(state: &SharedRecorderState, project_id: &str) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or("Recording session not found")?;

    if session.state != RecordingState::Paused {
        return Err("Recording is not paused".to_string());
    }

    // Increment segment index
    session.segment_index += 1;

    // Get the project directory
    let project_dir = session
        .screen_video_path
        .parent()
        .ok_or("Invalid video path")?;

    // Create new segment file path
    let segment_path = project_dir.join(format!("screen_part{}.mp4", session.segment_index));

    // Get shareable content again
    let content = SCShareableContent::get()
        .map_err(|e| format!("Failed to get shareable content: {:?}", e))?;

    // Recreate filter
    let filter = match session.options.source_type {
        SourceType::Display => {
            let display_id: u32 = session
                .options
                .source_id
                .parse()
                .map_err(|_| "Invalid display ID")?;
            let display = content
                .displays()
                .into_iter()
                .find(|d| d.display_id() == display_id)
                .ok_or("Display not found")?;
            SCContentFilter::create()
                .with_display(&display)
                .with_excluding_windows(&[])
                .build()
        }
        SourceType::Window => {
            let window_id: u32 = session
                .options
                .source_id
                .parse()
                .map_err(|_| "Invalid window ID")?;
            let windows = content.windows();
            let window = windows
                .iter()
                .find(|w| w.window_id() == window_id)
                .ok_or("Window not found")?;
            SCContentFilter::create().with_window(window).build()
        }
    };

    // Configure stream
    let config = SCStreamConfiguration::new()
        .with_width(session.capture_width)
        .with_height(session.capture_height)
        .with_fps(session.capture_fps)
        .with_pixel_format(PixelFormat::YCbCr_420v)
        .with_shows_cursor(true)
        .with_captures_audio(session.options.capture_system_audio)
        .with_sample_rate(48000)
        .with_channel_count(2);

    // Configure new recording output
    let recording_config = SCRecordingOutputConfiguration::new()
        .with_output_url(&segment_path)
        .with_video_codec(to_output_codec(session.recording_codec))
        .with_output_file_type(SCRecordingOutputFileType::MP4);

    let recording_output =
        SCRecordingOutput::new(&recording_config).ok_or("Failed to create recording output")?;

    // Create and start new stream
    let stream = SCStream::new(&filter, &config);
    stream
        .add_recording_output(&recording_output)
        .map_err(|e| format!("Failed to add recording output: {:?}", e))?;
    stream
        .start_capture()
        .map_err(|e| format!("Failed to resume capture: {:?}", e))?;

    session.state = RecordingState::Recording;
    session.stream = Some(stream);
    session.recording_output = Some(recording_output);
    session.current_segment_path = segment_path.clone();
    session.screen_segments.push(segment_path);
    session.last_resume_instant = Some(Instant::now());

    Ok(())
}

/// Update media offsets for camera/microphone recordings
#[cfg(target_os = "macos")]
pub fn set_media_offsets(
    state: &SharedRecorderState,
    project_id: &str,
    camera_offset_ms: Option<i64>,
    microphone_offset_ms: Option<i64>,
) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or("Recording session not found")?;

    if let Some(offset) = camera_offset_ms {
        session.camera_offset_ms = Some(offset);
    }
    if let Some(offset) = microphone_offset_ms {
        session.microphone_offset_ms = Some(offset);
    }

    Ok(())
}

/// Cleanup all active recording streams (used on app termination)
#[cfg(target_os = "macos")]
pub fn cleanup_active_recordings(state: &SharedRecorderState) -> Result<(), String> {
    let mut state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;

    for session in state_guard.sessions.values_mut() {
        if let Some(stream) = session.stream.as_ref() {
            let _ = stream.stop_capture();
            if let Some(recording_output) = session.recording_output.as_ref() {
                let _ = stream.remove_recording_output(recording_output);
            }
        }

        session.stream = None;
        session.recording_output = None;
        session.state = RecordingState::Stopped;

        let _ = wait_for_file_ready(&session.current_segment_path, Duration::from_secs(5));
    }

    state_guard.sessions.clear();
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
) -> Result<StopRecordingResult, String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn pause_recording(_state: &SharedRecorderState, _project_id: &str) -> Result<(), String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn resume_recording(_state: &SharedRecorderState, _project_id: &str) -> Result<(), String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn set_media_offsets(
    _state: &SharedRecorderState,
    _project_id: &str,
    _camera_offset_ms: Option<i64>,
    _microphone_offset_ms: Option<i64>,
) -> Result<(), String> {
    Err("Screen capture is only supported on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
pub fn cleanup_active_recordings(_state: &SharedRecorderState) -> Result<(), String> {
    Ok(())
}
