use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future::Future;
#[cfg(target_os = "macos")]
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
#[cfg(target_os = "macos")]
use std::time::Duration;
use std::time::Instant;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use uuid::Uuid;
#[cfg(target_os = "linux")]
use {
    std::io::{Read, Write},
    std::process::{Child, Command, Stdio},
    std::thread,
    std::time::Duration,
};

use crate::error::AppError;

#[cfg(target_os = "macos")]
use screencapturekit::{
    prelude::*,
    recording_output::{
        SCRecordingOutput, SCRecordingOutputCodec, SCRecordingOutputConfiguration,
        SCRecordingOutputFileType,
    },
    shareable_content::SCShareableContent,
};

#[cfg(target_os = "linux")]
use super::sources::{linux_list_display_sources, linux_list_window_sources};
use super::SourceType;

/// Recording options from the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingOptions {
    pub source_id: String,
    pub source_type: SourceType,
    #[serde(default)]
    pub preferred_display_ordinal: Option<u32>,
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
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
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
    #[cfg(target_os = "linux")]
    pub ffmpeg_child: Option<Child>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSessionSnapshot {
    pub state: RecordingState,
    pub elapsed_seconds: f64,
}

/// Global recorder state
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub struct RecorderState {
    pub sessions: HashMap<String, RecordingSession>,
    pub recordings_dir: PathBuf,
}

impl RecorderState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let recordings_dir = app_data_dir.join("recordings");
        match block_on_io(tokio::fs::create_dir_all(&recordings_dir)) {
            Ok(Ok(())) => {}
            Ok(Err(error)) => {
                eprintln!(
                    "Failed to ensure recordings directory exists ({}): {}",
                    recordings_dir.to_string_lossy(),
                    error
                );
            }
            Err(error) => {
                eprintln!(
                    "Failed to initialize async runtime while ensuring recordings directory exists ({}): {}",
                    recordings_dir.to_string_lossy(),
                    error
                );
            }
        }
        Self {
            sessions: HashMap::new(),
            recordings_dir,
        }
    }
}

pub type SharedRecorderState = Arc<Mutex<RecorderState>>;

fn block_on_io<T>(future: impl Future<Output = T>) -> Result<T, AppError> {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        return Ok(tokio::task::block_in_place(|| handle.block_on(future)));
    }

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| {
            AppError::Io(format!(
                "Failed to initialize temporary Tokio runtime for recorder file I/O: {}",
                error
            ))
        })?;
    Ok(runtime.block_on(future))
}

/// Result of starting a recording
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingResult {
    pub project_id: String,
    pub screen_video_path: String,
    pub camera_video_path: Option<String>,
    pub recording_start_time_ms: i64,
    pub resolved_source_id: String,
    pub fallback_source: Option<RecordingSourceFallback>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSourceFallback {
    pub source_id: String,
    pub source_ordinal: Option<u32>,
}

#[derive(Debug, Clone)]
pub struct RecordingSourceFallbackUpdate {
    pub source_type: SourceType,
    pub fallback_source: RecordingSourceFallback,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingSourceStatus {
    pub source_type: SourceType,
    pub source_id: String,
    pub available: bool,
    pub fallback_source: Option<RecordingSourceFallback>,
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

#[cfg(target_os = "macos")]
fn make_even_dimension(value: u32) -> u32 {
    let base = value.max(2);
    if base % 2 == 0 {
        base
    } else {
        base - 1
    }
}

impl RecordingQualityPreset {
    #[cfg(target_os = "macos")]
    fn max_height(self) -> u32 {
        match self {
            RecordingQualityPreset::P72030 => 720,
            RecordingQualityPreset::P1080P30 | RecordingQualityPreset::P1080P60 => 1080,
            RecordingQualityPreset::P4k30 | RecordingQualityPreset::P4k60 => 2160,
        }
    }

    #[cfg(target_os = "macos")]
    fn fps(self) -> u32 {
        match self {
            RecordingQualityPreset::P72030
            | RecordingQualityPreset::P1080P30
            | RecordingQualityPreset::P4k30 => 30,
            RecordingQualityPreset::P1080P60 | RecordingQualityPreset::P4k60 => 60,
        }
    }
}

#[cfg(target_os = "macos")]
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
fn parse_display_id(source_id: &str) -> Result<u32, AppError> {
    source_id
        .parse()
        .map_err(|_| AppError::Message(format!("Invalid display ID: {}", source_id)))
}

#[cfg(target_os = "macos")]
fn parse_window_id(source_id: &str) -> Result<u32, AppError> {
    source_id
        .parse()
        .map_err(|_| AppError::Message(format!("Invalid window ID: {}", source_id)))
}

#[cfg(target_os = "macos")]
fn find_display_or_fallback(
    content: &SCShareableContent,
    requested_display_id: u32,
) -> Result<(SCDisplay, bool, u32), AppError> {
    let mut displays: Vec<SCDisplay> = content.displays().into_iter().collect();
    if displays.is_empty() {
        return Err(AppError::Message(
            "No displays are currently available for capture".to_string(),
        ));
    }

    displays.sort_by_key(|display| display.display_id());
    if let Some(index) = displays
        .iter()
        .position(|display| display.display_id() == requested_display_id)
    {
        return Ok((displays.remove(index), false, index as u32));
    }

    let fallback_display = displays.remove(0);
    Ok((fallback_display, true, 0))
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn resolve_display_fallback_index(
    available_display_count: usize,
    preferred_display_ordinal: Option<u32>,
) -> usize {
    if available_display_count == 0 {
        return 0;
    }
    if let Some(ordinal) = preferred_display_ordinal {
        let preferred_index = ordinal as usize;
        if preferred_index < available_display_count {
            return preferred_index;
        }
    }
    0
}

#[cfg(target_os = "macos")]
fn find_display_or_fallback_with_ordinal(
    content: &SCShareableContent,
    requested_display_id: u32,
    preferred_display_ordinal: Option<u32>,
) -> Result<(SCDisplay, bool, u32), AppError> {
    let (display, used_fallback, requested_ordinal) =
        find_display_or_fallback(content, requested_display_id)?;
    if !used_fallback {
        return Ok((display, used_fallback, requested_ordinal));
    }

    let mut displays: Vec<SCDisplay> = content.displays().into_iter().collect();
    displays.sort_by_key(|candidate| candidate.display_id());
    let fallback_index = resolve_display_fallback_index(displays.len(), preferred_display_ordinal);
    if fallback_index < displays.len() {
        let preferred_display = displays.remove(fallback_index);
        return Ok((preferred_display, true, fallback_index as u32));
    }
    Ok((display, used_fallback, requested_ordinal))
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn resolve_window_fallback_id(
    requested_window_id: u32,
    available_window_ids: &[u32],
) -> Option<(u32, bool)> {
    if available_window_ids.is_empty() {
        return None;
    }
    let mut sorted_window_ids = available_window_ids.to_vec();
    sorted_window_ids.sort_unstable();
    if sorted_window_ids.contains(&requested_window_id) {
        return Some((requested_window_id, false));
    }
    Some((sorted_window_ids[0], true))
}

#[cfg(target_os = "macos")]
fn find_window_or_fallback(
    content: &SCShareableContent,
    requested_window_id: u32,
) -> Result<(SCWindow, bool), AppError> {
    let on_screen_windows = content
        .windows()
        .into_iter()
        .filter(|window| window.is_on_screen())
        .collect::<Vec<SCWindow>>();
    let available_window_ids = on_screen_windows
        .iter()
        .map(|window| window.window_id())
        .collect::<Vec<u32>>();
    let Some((resolved_window_id, used_fallback)) =
        resolve_window_fallback_id(requested_window_id, &available_window_ids)
    else {
        return Err(AppError::Message(
            "No windows are currently available for capture".to_string(),
        ));
    };
    let resolved_window = on_screen_windows
        .into_iter()
        .find(|window| window.window_id() == resolved_window_id)
        .ok_or_else(|| {
            AppError::Message(format!(
                "Window not found after fallback resolution: {}",
                resolved_window_id
            ))
        })?;
    Ok((resolved_window, used_fallback))
}

#[cfg(target_os = "macos")]
fn create_recording_output(
    config: &SCRecordingOutputConfiguration,
) -> Result<SCRecordingOutput, AppError> {
    SCRecordingOutput::new(config).ok_or_else(|| {
        AppError::Message("Failed to create ScreenCaptureKit recording output".to_string())
    })
}

#[cfg_attr(not(any(target_os = "macos", test)), allow(dead_code))]
fn parse_ffprobe_duration_seconds(raw: &str) -> Option<f64> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("n/a") {
        return None;
    }
    match trimmed.parse::<f64>() {
        Ok(value) if value.is_finite() && value >= 0.0 => Some(value),
        _ => None,
    }
}

#[cfg(target_os = "macos")]
enum VideoProbeReadiness {
    Ready,
    Pending,
    Skipped,
}

#[cfg(target_os = "macos")]
fn probe_recording_file_readiness(path: &Path) -> VideoProbeReadiness {
    let output = std::process::Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(path)
        .output();

    match output {
        Ok(command_output) => {
            if !command_output.status.success() {
                return VideoProbeReadiness::Pending;
            }
            let raw_duration = String::from_utf8_lossy(&command_output.stdout);
            if parse_ffprobe_duration_seconds(&raw_duration).is_some() {
                VideoProbeReadiness::Ready
            } else {
                VideoProbeReadiness::Pending
            }
        }
        Err(error) => {
            if error.kind() == std::io::ErrorKind::NotFound {
                eprintln!(
                    "ffprobe is unavailable; skipping probe readiness check for {}",
                    path.display()
                );
                VideoProbeReadiness::Skipped
            } else {
                eprintln!(
                    "ffprobe probe failed for {} ({}); continuing with size-based readiness check",
                    path.display(),
                    error
                );
                VideoProbeReadiness::Skipped
            }
        }
    }
}

#[cfg(target_os = "macos")]
fn wait_for_file_ready(path: &PathBuf, timeout: Duration) -> Result<(), AppError> {
    block_on_io(wait_for_file_ready_async(path, timeout))?
}

#[cfg(target_os = "macos")]
async fn wait_for_file_ready_async(path: &Path, timeout: Duration) -> Result<(), AppError> {
    let started = Instant::now();
    let mut last_size = 0;
    let mut stable_checks = 0;

    while started.elapsed() < timeout {
        match tokio::fs::metadata(path).await {
            Ok(metadata) => {
                let size = metadata.len();
                if size > 1024 && size == last_size {
                    stable_checks += 1;
                    if stable_checks >= 3 {
                        match probe_recording_file_readiness(path) {
                            VideoProbeReadiness::Ready | VideoProbeReadiness::Skipped => {
                                return Ok(());
                            }
                            VideoProbeReadiness::Pending => {}
                        }
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

        tokio::time::sleep(Duration::from_millis(200)).await;
    }

    Err(AppError::Message(format!(
        "Timed out waiting for recording file finalization: {}",
        path.to_string_lossy()
    )))
}

/// Start screen recording
#[cfg(target_os = "macos")]
pub fn start_recording(
    state: &SharedRecorderState,
    options: RecordingOptions,
) -> Result<StartRecordingResult, AppError> {
    let project_id = Uuid::new_v4().to_string();

    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    // Create project directory
    let project_dir = state_guard.recordings_dir.join(&project_id);
    let project_dir_create_result = block_on_io(tokio::fs::create_dir_all(&project_dir))?;
    project_dir_create_result
        .map_err(|e| AppError::Io(format!("Failed to create project dir: {}", e)))?;

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
        .map_err(|e| AppError::Message(format!("Failed to get shareable content: {:?}", e)))?;

    // Create content filter based on source type and resolve dimensions
    let (
        filter,
        source_width,
        source_height,
        resolved_source_id,
        resolved_display_ordinal,
        fallback_source,
    ) = match options.source_type {
        SourceType::Display => {
            let display_id = parse_display_id(&options.source_id)?;
            let (display, used_fallback, resolved_display_ordinal) =
                find_display_or_fallback_with_ordinal(
                    &content,
                    display_id,
                    options.preferred_display_ordinal,
                )?;
            if used_fallback {
                eprintln!(
                    "Requested display {} was unavailable. Falling back to display {}.",
                    display_id,
                    display.display_id()
                );
            }
            (
                SCContentFilter::create()
                    .with_display(&display)
                    .with_excluding_windows(&[])
                    .build(),
                display.width(),
                display.height(),
                display.display_id().to_string(),
                Some(resolved_display_ordinal),
                if used_fallback {
                    Some(RecordingSourceFallback {
                        source_id: display.display_id().to_string(),
                        source_ordinal: Some(resolved_display_ordinal),
                    })
                } else {
                    None
                },
            )
        }
        SourceType::Window => {
            let window_id = parse_window_id(&options.source_id)?;
            let (window, used_fallback) = find_window_or_fallback(&content, window_id)?;
            if used_fallback {
                eprintln!(
                    "Requested window {} was unavailable. Falling back to window {}.",
                    window_id,
                    window.window_id()
                );
            }
            let frame = window.frame();
            (
                SCContentFilter::create().with_window(&window).build(),
                frame.width.round() as u32,
                frame.height.round() as u32,
                window.window_id().to_string(),
                None,
                if used_fallback {
                    Some(RecordingSourceFallback {
                        source_id: window.window_id().to_string(),
                        source_ordinal: None,
                    })
                } else {
                    None
                },
            )
        }
    };

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

    let recording_output = create_recording_output(&recording_config)?;

    // Create and start stream
    let stream = SCStream::new(&filter, &config);
    stream
        .add_recording_output(&recording_output)
        .map_err(|e| AppError::Message(format!("Failed to add recording output: {:?}", e)))?;
    stream
        .start_capture()
        .map_err(|e| AppError::Message(format!("Failed to start capture: {:?}", e)))?;

    let recording_start_time_ms = chrono::Utc::now().timestamp_millis();

    // Store session
    let mut session_options = options.clone();
    session_options.source_id = resolved_source_id.clone();
    session_options.preferred_display_ordinal = resolved_display_ordinal;

    let session = RecordingSession {
        project_id: project_id.clone(),
        options: session_options,
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
        resolved_source_id,
        fallback_source,
    })
}

/// Stop screen recording
#[cfg(target_os = "macos")]
pub fn stop_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<StopRecordingResult, AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    {
        let session = state_guard.sessions.get_mut(project_id).ok_or_else(|| {
            AppError::Message(format!("Recording session not found: {}", project_id))
        })?;
        let current_segment_path = session.current_segment_path.clone();

        if let Some(ref stream) = session.stream {
            // First stop the capture to signal we're done
            stream
                .stop_capture()
                .map_err(|e| AppError::Message(format!("Failed to stop capture: {:?}", e)))?;

            // Then remove the recording output - this should trigger file finalization
            if let Some(ref recording_output) = session.recording_output {
                stream
                    .remove_recording_output(recording_output)
                    .map_err(|e| {
                        AppError::Message(format!("Failed to remove recording output: {:?}", e))
                    })?;
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
    }

    let session = state_guard
        .sessions
        .remove(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

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
pub fn pause_recording(state: &SharedRecorderState, project_id: &str) -> Result<(), AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

    if session.state != RecordingState::Recording {
        return Err(AppError::Message(format!(
            "Recording is not active for project {}",
            project_id
        )));
    }

    // Stop current recording output
    if let Some(ref stream) = session.stream {
        if let Some(ref recording_output) = session.recording_output {
            stream
                .remove_recording_output(recording_output)
                .map_err(|e| {
                    AppError::Message(format!("Failed to remove recording output: {:?}", e))
                })?;
        }
        stream
            .stop_capture()
            .map_err(|e| AppError::Message(format!("Failed to stop capture for pause: {:?}", e)))?;
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
pub fn resume_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingSourceFallbackUpdate>, AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

    if session.state != RecordingState::Paused {
        return Err(AppError::Message(format!(
            "Recording is not paused for project {}",
            project_id
        )));
    }

    // Increment segment index
    session.segment_index += 1;

    // Get the project directory
    let project_dir = session.screen_video_path.parent().ok_or_else(|| {
        AppError::Message(format!(
            "Invalid video path for project {}: {}",
            project_id,
            session.screen_video_path.display()
        ))
    })?;

    // Create new segment file path
    let segment_path = project_dir.join(format!("screen_part{}.mp4", session.segment_index));

    // Get shareable content again
    let content = SCShareableContent::get()
        .map_err(|e| AppError::Message(format!("Failed to get shareable content: {:?}", e)))?;

    let mut fallback_source: Option<RecordingSourceFallbackUpdate> = None;

    // Recreate filter
    let filter = match session.options.source_type {
        SourceType::Display => {
            let display_id = parse_display_id(&session.options.source_id)?;
            let (display, used_fallback, resolved_display_ordinal) =
                find_display_or_fallback_with_ordinal(
                    &content,
                    display_id,
                    session.options.preferred_display_ordinal,
                )?;
            session.options.preferred_display_ordinal = Some(resolved_display_ordinal);
            if used_fallback {
                eprintln!(
                    "Requested display {} for project {} is unavailable. Resuming on display {}.",
                    display_id,
                    project_id,
                    display.display_id()
                );
                session.options.source_id = display.display_id().to_string();
                fallback_source = Some(RecordingSourceFallbackUpdate {
                    source_type: SourceType::Display,
                    fallback_source: RecordingSourceFallback {
                        source_id: session.options.source_id.clone(),
                        source_ordinal: session.options.preferred_display_ordinal,
                    },
                });
            }
            SCContentFilter::create()
                .with_display(&display)
                .with_excluding_windows(&[])
                .build()
        }
        SourceType::Window => {
            let window_id = parse_window_id(&session.options.source_id)?;
            let (window, used_fallback) = find_window_or_fallback(&content, window_id)?;
            if used_fallback {
                eprintln!(
                    "Requested window {} for project {} is unavailable. Resuming on window {}.",
                    window_id,
                    project_id,
                    window.window_id()
                );
                session.options.source_id = window.window_id().to_string();
                fallback_source = Some(RecordingSourceFallbackUpdate {
                    source_type: SourceType::Window,
                    fallback_source: RecordingSourceFallback {
                        source_id: session.options.source_id.clone(),
                        source_ordinal: None,
                    },
                });
            }
            SCContentFilter::create().with_window(&window).build()
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

    let recording_output = create_recording_output(&recording_config)?;

    // Create and start new stream
    let stream = SCStream::new(&filter, &config);
    stream
        .add_recording_output(&recording_output)
        .map_err(|e| AppError::Message(format!("Failed to add recording output: {:?}", e)))?;
    stream
        .start_capture()
        .map_err(|e| AppError::Message(format!("Failed to resume capture: {:?}", e)))?;

    session.state = RecordingState::Recording;
    session.stream = Some(stream);
    session.recording_output = Some(recording_output);
    session.current_segment_path = segment_path.clone();
    session.screen_segments.push(segment_path);
    session.last_resume_instant = Some(Instant::now());

    Ok(fallback_source)
}

/// Update media offsets for camera/microphone recordings
#[cfg(target_os = "macos")]
pub fn set_media_offsets(
    state: &SharedRecorderState,
    project_id: &str,
    camera_offset_ms: Option<i64>,
    microphone_offset_ms: Option<i64>,
) -> Result<(), AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

    if let Some(offset) = camera_offset_ms {
        session.camera_offset_ms = Some(offset);
    }
    if let Some(offset) = microphone_offset_ms {
        session.microphone_offset_ms = Some(offset);
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub fn get_recording_source_status(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingSourceStatus>, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    let session = if let Some(session) = state_guard.sessions.get(project_id) {
        session
    } else {
        return Ok(None);
    };

    let source_type = session.options.source_type;
    let source_id = session.options.source_id.clone();
    let preferred_display_ordinal = session.options.preferred_display_ordinal;
    drop(state_guard);

    let content = SCShareableContent::get()
        .map_err(|e| AppError::Message(format!("Failed to get shareable content: {:?}", e)))?;

    match source_type {
        SourceType::Display => {
            let display_id = parse_display_id(&source_id)?;
            let (resolved_display, used_fallback, fallback_ordinal) =
                find_display_or_fallback_with_ordinal(
                    &content,
                    display_id,
                    preferred_display_ordinal,
                )?;
            if used_fallback {
                return Ok(Some(RecordingSourceStatus {
                    source_type,
                    source_id,
                    available: false,
                    fallback_source: Some(RecordingSourceFallback {
                        source_id: resolved_display.display_id().to_string(),
                        source_ordinal: Some(fallback_ordinal),
                    }),
                }));
            }

            Ok(Some(RecordingSourceStatus {
                source_type,
                source_id,
                available: true,
                fallback_source: None,
            }))
        }
        SourceType::Window => {
            let window_id = parse_window_id(&source_id)?;
            let available_window_ids = content
                .windows()
                .into_iter()
                .filter(|window| window.is_on_screen())
                .map(|window| window.window_id())
                .collect::<Vec<u32>>();
            let Some((resolved_window_id, used_fallback)) =
                resolve_window_fallback_id(window_id, &available_window_ids)
            else {
                return Ok(Some(RecordingSourceStatus {
                    source_type,
                    source_id,
                    available: false,
                    fallback_source: None,
                }));
            };
            if !used_fallback {
                return Ok(Some(RecordingSourceStatus {
                    source_type,
                    source_id,
                    available: true,
                    fallback_source: None,
                }));
            }
            Ok(Some(RecordingSourceStatus {
                source_type,
                source_id,
                available: false,
                fallback_source: Some(RecordingSourceFallback {
                    source_id: resolved_window_id.to_string(),
                    source_ordinal: None,
                }),
            }))
        }
    }
}

#[cfg(any(target_os = "macos", target_os = "linux", test))]
fn calculate_elapsed_duration_ms(session: &RecordingSession) -> u64 {
    let mut elapsed_ms = session.active_duration_ms;
    if session.state == RecordingState::Recording {
        if let Some(last_resume) = session.last_resume_instant.as_ref() {
            elapsed_ms = elapsed_ms.saturating_add(last_resume.elapsed().as_millis() as u64);
        }
    }
    elapsed_ms
}

#[cfg(target_os = "macos")]
pub fn get_recording_state(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingState>, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard
        .sessions
        .get(project_id)
        .map(|session| session.state))
}

#[cfg(target_os = "macos")]
pub fn get_recording_snapshot(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingSessionSnapshot>, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard.sessions.get(project_id).map(|session| {
        let elapsed_seconds = calculate_elapsed_duration_ms(session) as f64 / 1000.0;
        RecordingSessionSnapshot {
            state: session.state,
            elapsed_seconds,
        }
    }))
}

/// Cleanup all active recording streams (used on app termination)
#[cfg(target_os = "macos")]
pub fn cleanup_active_recordings(state: &SharedRecorderState) -> Result<(), AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    for session in state_guard.sessions.values_mut() {
        if let Some(stream) = session.stream.as_ref() {
            if let Err(error) = stream.stop_capture() {
                eprintln!(
                    "Failed to stop active capture stream during cleanup for {}: {:?}",
                    session.project_id, error
                );
            }
            if let Some(recording_output) = session.recording_output.as_ref() {
                if let Err(error) = stream.remove_recording_output(recording_output) {
                    eprintln!(
                        "Failed to detach recording output during cleanup for {}: {:?}",
                        session.project_id, error
                    );
                }
            }
        }

        session.stream = None;
        session.recording_output = None;
        session.state = RecordingState::Stopped;

        if let Err(error) =
            wait_for_file_ready(&session.current_segment_path, Duration::from_secs(5))
        {
            eprintln!(
                "Recording file was not finalized during cleanup for {} ({}): {}",
                session.project_id,
                session.current_segment_path.display(),
                error
            );
        }
    }

    state_guard.sessions.clear();
    Ok(())
}

#[cfg(target_os = "linux")]
#[derive(Debug, Clone)]
struct LinuxCaptureSelection {
    source_type: SourceType,
    source_id: String,
    source_width: u32,
    source_height: u32,
    x: i32,
    y: i32,
    window_id: Option<u32>,
    preferred_display_ordinal: Option<u32>,
    fallback_source: Option<RecordingSourceFallback>,
}

#[cfg(target_os = "linux")]
fn make_even_dimension_linux(value: u32) -> u32 {
    let base = value.max(2);
    if base % 2 == 0 {
        base
    } else {
        base - 1
    }
}

#[cfg(target_os = "linux")]
fn linux_max_height(preset: RecordingQualityPreset) -> u32 {
    match preset {
        RecordingQualityPreset::P72030 => 720,
        RecordingQualityPreset::P1080P30 | RecordingQualityPreset::P1080P60 => 1080,
        RecordingQualityPreset::P4k30 | RecordingQualityPreset::P4k60 => 2160,
    }
}

#[cfg(target_os = "linux")]
fn linux_fps(preset: RecordingQualityPreset) -> u32 {
    match preset {
        RecordingQualityPreset::P72030
        | RecordingQualityPreset::P1080P30
        | RecordingQualityPreset::P4k30 => 30,
        RecordingQualityPreset::P1080P60 | RecordingQualityPreset::P4k60 => 60,
    }
}

#[cfg(target_os = "linux")]
fn resolve_output_dimensions_linux(
    source_width: u32,
    source_height: u32,
    preset: RecordingQualityPreset,
) -> (u32, u32) {
    if source_width == 0 || source_height == 0 {
        return (1920, 1080);
    }
    let max_height = linux_max_height(preset) as f64;
    let scale = (max_height / source_height as f64).min(1.0);
    let scaled_width = make_even_dimension_linux((source_width as f64 * scale).round() as u32);
    let scaled_height = make_even_dimension_linux((source_height as f64 * scale).round() as u32);
    (scaled_width, scaled_height)
}

#[cfg(target_os = "linux")]
fn parse_linux_source_id(source_id: &str, label: &str) -> Result<u32, AppError> {
    source_id
        .parse::<u32>()
        .map_err(|_| AppError::Message(format!("Invalid {} ID: {}", label, source_id)))
}

#[cfg(target_os = "linux")]
fn resolve_linux_display_selection(
    source_id: &str,
    preferred_display_ordinal: Option<u32>,
) -> Result<LinuxCaptureSelection, AppError> {
    let requested_display_id = parse_linux_source_id(source_id, "display")?;
    let mut displays = linux_list_display_sources()?;
    if displays.is_empty() {
        return Err(AppError::Message(
            "No displays are currently available for capture".to_string(),
        ));
    }

    if let Some(index) = displays
        .iter()
        .position(|display| display.id == requested_display_id)
    {
        let display = displays.remove(index);
        return Ok(LinuxCaptureSelection {
            source_type: SourceType::Display,
            source_id: display.id.to_string(),
            source_width: display.width,
            source_height: display.height,
            x: display.x,
            y: display.y,
            window_id: None,
            preferred_display_ordinal: Some(index as u32),
            fallback_source: None,
        });
    }

    let fallback_index = resolve_display_fallback_index(displays.len(), preferred_display_ordinal);
    let display = displays
        .get(fallback_index)
        .ok_or_else(|| AppError::Message("No display fallback is available".to_string()))?
        .clone();
    Ok(LinuxCaptureSelection {
        source_type: SourceType::Display,
        source_id: display.id.to_string(),
        source_width: display.width,
        source_height: display.height,
        x: display.x,
        y: display.y,
        window_id: None,
        preferred_display_ordinal: Some(fallback_index as u32),
        fallback_source: Some(RecordingSourceFallback {
            source_id: display.id.to_string(),
            source_ordinal: Some(fallback_index as u32),
        }),
    })
}

#[cfg(target_os = "linux")]
fn resolve_linux_window_selection(source_id: &str) -> Result<LinuxCaptureSelection, AppError> {
    let requested_window_id = parse_linux_source_id(source_id, "window")?;
    let windows = linux_list_window_sources()?;
    let available_window_ids = windows.iter().map(|window| window.id).collect::<Vec<u32>>();
    let Some((resolved_window_id, used_fallback)) =
        resolve_window_fallback_id(requested_window_id, &available_window_ids)
    else {
        return Err(AppError::Message(
            "No windows are currently available for capture".to_string(),
        ));
    };
    let window = windows
        .into_iter()
        .find(|candidate| candidate.id == resolved_window_id)
        .ok_or_else(|| {
            AppError::Message(format!(
                "Window not found after fallback resolution: {}",
                resolved_window_id
            ))
        })?;
    Ok(LinuxCaptureSelection {
        source_type: SourceType::Window,
        source_id: window.id.to_string(),
        source_width: window.width,
        source_height: window.height,
        x: 0,
        y: 0,
        window_id: Some(window.id),
        preferred_display_ordinal: None,
        fallback_source: if used_fallback {
            Some(RecordingSourceFallback {
                source_id: window.id.to_string(),
                source_ordinal: None,
            })
        } else {
            None
        },
    })
}

#[cfg(target_os = "linux")]
fn resolve_linux_capture_selection(
    source_id: &str,
    source_type: SourceType,
    preferred_display_ordinal: Option<u32>,
) -> Result<LinuxCaptureSelection, AppError> {
    match source_type {
        SourceType::Display => {
            resolve_linux_display_selection(source_id, preferred_display_ordinal)
        }
        SourceType::Window => resolve_linux_window_selection(source_id),
    }
}

#[cfg(target_os = "linux")]
fn resolve_linux_display_env() -> Result<String, AppError> {
    std::env::var("DISPLAY").map_err(|_| {
        AppError::Message(
            "Linux screen capture requires an active X11 display (DISPLAY is unset).".to_string(),
        )
    })
}

#[cfg(target_os = "linux")]
fn resolve_default_pulse_monitor_input() -> Option<String> {
    let from_default_sink = Command::new("pactl")
        .arg("get-default-sink")
        .output()
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| {
            let sink = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if sink.is_empty() {
                None
            } else {
                Some(format!("{}.monitor", sink))
            }
        });
    if from_default_sink.is_some() {
        return from_default_sink;
    }

    let info_output = Command::new("pactl").arg("info").output().ok()?;
    if !info_output.status.success() {
        return None;
    }
    let info = String::from_utf8_lossy(&info_output.stdout);
    info.lines().find_map(|line| {
        let trimmed = line.trim();
        if let Some(sink) = trimmed.strip_prefix("Default Sink:") {
            let sink_name = sink.trim();
            if sink_name.is_empty() {
                None
            } else {
                Some(format!("{}.monitor", sink_name))
            }
        } else {
            None
        }
    })
}

#[cfg(target_os = "linux")]
fn spawn_linux_ffmpeg_capture(
    options: &RecordingOptions,
    selection: &LinuxCaptureSelection,
    output_path: &PathBuf,
) -> Result<Child, AppError> {
    let display = resolve_linux_display_env()?;
    let fps = linux_fps(options.quality_preset);
    let (capture_width, capture_height) = resolve_output_dimensions_linux(
        selection.source_width,
        selection.source_height,
        options.quality_preset,
    );

    let mut args = vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "error".to_string(),
        "-thread_queue_size".to_string(),
        "1024".to_string(),
        "-f".to_string(),
        "x11grab".to_string(),
        "-framerate".to_string(),
        fps.to_string(),
    ];

    match selection.source_type {
        SourceType::Display => {
            args.push("-video_size".to_string());
            args.push(format!(
                "{}x{}",
                selection.source_width, selection.source_height
            ));
            args.push("-i".to_string());
            args.push(format!("{}+{},{}", display, selection.x, selection.y));
        }
        SourceType::Window => {
            let window_id = selection.window_id.ok_or_else(|| {
                AppError::Message("Window capture source is missing a window id".to_string())
            })?;
            args.push("-window_id".to_string());
            args.push(format!("0x{:x}", window_id));
            args.push("-i".to_string());
            args.push(display);
        }
    }

    if options.capture_system_audio {
        let pulse_input =
            resolve_default_pulse_monitor_input().unwrap_or_else(|| "default".to_string());
        args.extend([
            "-thread_queue_size".to_string(),
            "1024".to_string(),
            "-f".to_string(),
            "pulse".to_string(),
            "-i".to_string(),
            pulse_input,
        ]);
    }

    if capture_width != selection.source_width || capture_height != selection.source_height {
        args.push("-vf".to_string());
        args.push(format!(
            "scale={}x{}:flags=lanczos",
            capture_width, capture_height
        ));
    }

    args.push("-r".to_string());
    args.push(fps.to_string());
    match options.codec {
        RecordingCodec::H264 => {
            args.extend([
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                "veryfast".to_string(),
                "-crf".to_string(),
                "23".to_string(),
            ]);
        }
        RecordingCodec::Hevc => {
            args.extend([
                "-c:v".to_string(),
                "libx265".to_string(),
                "-preset".to_string(),
                "medium".to_string(),
                "-crf".to_string(),
                "28".to_string(),
            ]);
        }
    }

    if options.capture_system_audio {
        args.extend([
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            "-ac".to_string(),
            "2".to_string(),
            "-ar".to_string(),
            "48000".to_string(),
        ]);
    } else {
        args.push("-an".to_string());
    }

    args.extend([
        "-movflags".to_string(),
        "+faststart".to_string(),
        "-y".to_string(),
        output_path.to_string_lossy().to_string(),
    ]);

    Command::new("ffmpeg")
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            AppError::Io(format!(
                "Failed to spawn ffmpeg for Linux capture. Ensure ffmpeg is installed and available on PATH: {}",
                error
            ))
        })
}

#[cfg(target_os = "linux")]
fn read_child_stderr(child: &mut Child) -> String {
    if let Some(mut stderr) = child.stderr.take() {
        let mut buffer = String::new();
        if stderr.read_to_string(&mut buffer).is_ok() {
            return buffer.trim().to_string();
        }
    }
    String::new()
}

#[cfg(target_os = "linux")]
fn stop_linux_ffmpeg_capture(child: &mut Child, context: &str) -> Result<(), AppError> {
    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"q\n");
        let _ = stdin.flush();
    }

    let timeout = Duration::from_secs(20);
    let started = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|error| {
            AppError::Io(format!("Failed to poll ffmpeg process state: {error}"))
        })? {
            if status.success() {
                return Ok(());
            }
            let stderr = read_child_stderr(child);
            let detail = if stderr.is_empty() {
                status
                    .code()
                    .map(|code| format!("exit code {code}"))
                    .unwrap_or_else(|| "terminated by signal".to_string())
            } else {
                stderr
            };
            return Err(AppError::Message(format!(
                "ffmpeg failed while {context}: {detail}"
            )));
        }

        if started.elapsed() >= timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(AppError::Message(format!(
                "Timed out waiting for ffmpeg while {context}"
            )));
        }
        thread::sleep(Duration::from_millis(120));
    }
}

#[cfg(target_os = "linux")]
fn wait_for_file_ready_linux(path: &PathBuf, timeout: Duration) -> Result<(), AppError> {
    let started = Instant::now();
    let mut last_size = 0_u64;
    let mut stable_checks = 0_u8;
    while started.elapsed() < timeout {
        match std::fs::metadata(path) {
            Ok(metadata) => {
                let size = metadata.len();
                if size > 1024 && size == last_size {
                    stable_checks = stable_checks.saturating_add(1);
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
        thread::sleep(Duration::from_millis(200));
    }
    Err(AppError::Message(format!(
        "Timed out waiting for Linux capture output finalization: {}",
        path.display()
    )))
}

#[cfg(target_os = "linux")]
pub fn start_recording(
    state: &SharedRecorderState,
    options: RecordingOptions,
) -> Result<StartRecordingResult, AppError> {
    let project_id = Uuid::new_v4().to_string();
    let mut selection = resolve_linux_capture_selection(
        &options.source_id,
        options.source_type,
        options.preferred_display_ordinal,
    )?;

    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    let project_dir = state_guard.recordings_dir.join(&project_id);
    block_on_io(tokio::fs::create_dir_all(&project_dir))?
        .map_err(|error| AppError::Io(format!("Failed to create project dir: {}", error)))?;

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

    let child = spawn_linux_ffmpeg_capture(&options, &selection, &screen_video_path)?;
    let recording_start_time_ms = chrono::Utc::now().timestamp_millis();
    let (capture_width, capture_height) = resolve_output_dimensions_linux(
        selection.source_width,
        selection.source_height,
        options.quality_preset,
    );
    let capture_fps = linux_fps(options.quality_preset);

    let mut session_options = options.clone();
    session_options.source_id = selection.source_id.clone();
    session_options.preferred_display_ordinal = selection.preferred_display_ordinal;

    let session = RecordingSession {
        project_id: project_id.clone(),
        options: session_options,
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
        ffmpeg_child: Some(child),
    };
    state_guard.sessions.insert(project_id.clone(), session);

    Ok(StartRecordingResult {
        project_id,
        screen_video_path: screen_video_path.to_string_lossy().to_string(),
        camera_video_path: camera_video_path.map(|path| path.to_string_lossy().to_string()),
        recording_start_time_ms,
        resolved_source_id: selection.source_id,
        fallback_source: selection.fallback_source.take(),
    })
}

#[cfg(target_os = "linux")]
pub fn stop_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<StopRecordingResult, AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    {
        let session = state_guard.sessions.get_mut(project_id).ok_or_else(|| {
            AppError::Message(format!("Recording session not found: {}", project_id))
        })?;

        if let Some(last_resume) = session.last_resume_instant.take() {
            let elapsed = last_resume.elapsed().as_millis() as u64;
            session.active_duration_ms = session.active_duration_ms.saturating_add(elapsed);
        }

        if let Some(mut child) = session.ffmpeg_child.take() {
            stop_linux_ffmpeg_capture(&mut child, "stopping recording")?;
            wait_for_file_ready_linux(&session.current_segment_path, Duration::from_secs(20))?;
        }
        session.state = RecordingState::Stopped;
    }

    let session = state_guard
        .sessions
        .remove(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

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

#[cfg(target_os = "linux")]
pub fn pause_recording(state: &SharedRecorderState, project_id: &str) -> Result<(), AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

    if session.state != RecordingState::Recording {
        return Err(AppError::Message(format!(
            "Recording is not active for project {}",
            project_id
        )));
    }

    let mut child = session.ffmpeg_child.take().ok_or_else(|| {
        AppError::Message(format!(
            "Recording process is unavailable for project {}",
            project_id
        ))
    })?;
    stop_linux_ffmpeg_capture(&mut child, "pausing recording")?;
    wait_for_file_ready_linux(&session.current_segment_path, Duration::from_secs(20))?;

    if let Some(last_resume) = session.last_resume_instant.take() {
        let elapsed = last_resume.elapsed().as_millis() as u64;
        session.active_duration_ms = session.active_duration_ms.saturating_add(elapsed);
    }
    session.state = RecordingState::Paused;
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn resume_recording(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingSourceFallbackUpdate>, AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;

    if session.state != RecordingState::Paused {
        return Err(AppError::Message(format!(
            "Recording is not paused for project {}",
            project_id
        )));
    }

    session.segment_index = session.segment_index.saturating_add(1);
    let project_dir = session.screen_video_path.parent().ok_or_else(|| {
        AppError::Message(format!(
            "Invalid video path for project {}: {}",
            project_id,
            session.screen_video_path.display()
        ))
    })?;
    let segment_path = project_dir.join(format!("screen_part{}.mp4", session.segment_index));

    let selection = resolve_linux_capture_selection(
        &session.options.source_id,
        session.options.source_type,
        session.options.preferred_display_ordinal,
    )?;
    let child = spawn_linux_ffmpeg_capture(&session.options, &selection, &segment_path)?;

    let mut fallback_update = None;
    session.options.source_id = selection.source_id.clone();
    session.options.preferred_display_ordinal = selection.preferred_display_ordinal;
    if let Some(fallback_source) = selection.fallback_source {
        fallback_update = Some(RecordingSourceFallbackUpdate {
            source_type: selection.source_type,
            fallback_source,
        });
    }

    let (capture_width, capture_height) = resolve_output_dimensions_linux(
        selection.source_width,
        selection.source_height,
        session.options.quality_preset,
    );
    session.capture_width = capture_width;
    session.capture_height = capture_height;
    session.capture_fps = linux_fps(session.options.quality_preset);
    session.ffmpeg_child = Some(child);
    session.current_segment_path = segment_path.clone();
    session.screen_segments.push(segment_path);
    session.last_resume_instant = Some(Instant::now());
    session.state = RecordingState::Recording;

    Ok(fallback_update)
}

#[cfg(target_os = "linux")]
pub fn set_media_offsets(
    state: &SharedRecorderState,
    project_id: &str,
    camera_offset_ms: Option<i64>,
    microphone_offset_ms: Option<i64>,
) -> Result<(), AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    let session = state_guard
        .sessions
        .get_mut(project_id)
        .ok_or_else(|| AppError::Message(format!("Recording session not found: {}", project_id)))?;
    if let Some(offset) = camera_offset_ms {
        session.camera_offset_ms = Some(offset);
    }
    if let Some(offset) = microphone_offset_ms {
        session.microphone_offset_ms = Some(offset);
    }
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn get_recording_source_status(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingSourceStatus>, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    let session = if let Some(session) = state_guard.sessions.get(project_id) {
        session
    } else {
        return Ok(None);
    };

    match session.options.source_type {
        SourceType::Display => {
            let requested_display_id =
                parse_linux_source_id(&session.options.source_id, "display")?;
            let displays = linux_list_display_sources()?;
            if displays
                .iter()
                .any(|display| display.id == requested_display_id)
            {
                return Ok(Some(RecordingSourceStatus {
                    source_type: SourceType::Display,
                    source_id: session.options.source_id.clone(),
                    available: true,
                    fallback_source: None,
                }));
            }
            if displays.is_empty() {
                return Ok(Some(RecordingSourceStatus {
                    source_type: SourceType::Display,
                    source_id: session.options.source_id.clone(),
                    available: false,
                    fallback_source: None,
                }));
            }
            let fallback_index = resolve_display_fallback_index(
                displays.len(),
                session.options.preferred_display_ordinal,
            );
            let fallback = displays.get(fallback_index).ok_or_else(|| {
                AppError::Message(
                    "No display fallback is available for status resolution".to_string(),
                )
            })?;
            Ok(Some(RecordingSourceStatus {
                source_type: SourceType::Display,
                source_id: session.options.source_id.clone(),
                available: false,
                fallback_source: Some(RecordingSourceFallback {
                    source_id: fallback.id.to_string(),
                    source_ordinal: Some(fallback_index as u32),
                }),
            }))
        }
        SourceType::Window => {
            let requested_window_id = parse_linux_source_id(&session.options.source_id, "window")?;
            let windows = linux_list_window_sources()?;
            let available_ids = windows.iter().map(|window| window.id).collect::<Vec<u32>>();
            let Some((fallback_id, used_fallback)) =
                resolve_window_fallback_id(requested_window_id, &available_ids)
            else {
                return Ok(Some(RecordingSourceStatus {
                    source_type: SourceType::Window,
                    source_id: session.options.source_id.clone(),
                    available: false,
                    fallback_source: None,
                }));
            };
            Ok(Some(RecordingSourceStatus {
                source_type: SourceType::Window,
                source_id: session.options.source_id.clone(),
                available: !used_fallback,
                fallback_source: if used_fallback {
                    Some(RecordingSourceFallback {
                        source_id: fallback_id.to_string(),
                        source_ordinal: None,
                    })
                } else {
                    None
                },
            }))
        }
    }
}

#[cfg(target_os = "linux")]
pub fn get_recording_state(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingState>, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard
        .sessions
        .get(project_id)
        .map(|session| session.state))
}

#[cfg(target_os = "linux")]
pub fn get_recording_snapshot(
    state: &SharedRecorderState,
    project_id: &str,
) -> Result<Option<RecordingSessionSnapshot>, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard.sessions.get(project_id).map(|session| {
        let elapsed_seconds = calculate_elapsed_duration_ms(session) as f64 / 1000.0;
        RecordingSessionSnapshot {
            state: session.state,
            elapsed_seconds,
        }
    }))
}

#[cfg(target_os = "linux")]
pub fn cleanup_active_recordings(state: &SharedRecorderState) -> Result<(), AppError> {
    let mut state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;

    for session in state_guard.sessions.values_mut() {
        if let Some(mut child) = session.ffmpeg_child.take() {
            if let Err(error) = stop_linux_ffmpeg_capture(&mut child, "cleaning up recording") {
                eprintln!(
                    "Failed to stop active ffmpeg capture during cleanup for {}: {}",
                    session.project_id, error
                );
            }
        }
        session.state = RecordingState::Stopped;
        if let Err(error) =
            wait_for_file_ready_linux(&session.current_segment_path, Duration::from_secs(5))
        {
            eprintln!(
                "Recording file was not finalized during Linux cleanup for {} ({}): {}",
                session.project_id,
                session.current_segment_path.display(),
                error
            );
        }
    }

    state_guard.sessions.clear();
    Ok(())
}

// Unsupported-platform stubs
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn start_recording(
    _state: &SharedRecorderState,
    _options: RecordingOptions,
) -> Result<StartRecordingResult, AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS and Linux".to_string(),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn stop_recording(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<StopRecordingResult, AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS and Linux".to_string(),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn pause_recording(_state: &SharedRecorderState, _project_id: &str) -> Result<(), AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS and Linux".to_string(),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn resume_recording(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<Option<RecordingSourceFallbackUpdate>, AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS and Linux".to_string(),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn set_media_offsets(
    _state: &SharedRecorderState,
    _project_id: &str,
    _camera_offset_ms: Option<i64>,
    _microphone_offset_ms: Option<i64>,
) -> Result<(), AppError> {
    Err(AppError::Message(
        "Screen capture is only supported on macOS and Linux".to_string(),
    ))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn get_recording_source_status(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<Option<RecordingSourceStatus>, AppError> {
    Ok(None)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn get_recording_state(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<Option<RecordingState>, AppError> {
    Ok(None)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn get_recording_snapshot(
    _state: &SharedRecorderState,
    _project_id: &str,
) -> Result<Option<RecordingSessionSnapshot>, AppError> {
    Ok(None)
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
pub fn cleanup_active_recordings(_state: &SharedRecorderState) -> Result<(), AppError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn resolves_display_fallback_index_from_preferred_ordinal() {
        assert_eq!(resolve_display_fallback_index(3, Some(2)), 2);
        assert_eq!(resolve_display_fallback_index(3, Some(99)), 0);
        assert_eq!(resolve_display_fallback_index(3, None), 0);
        assert_eq!(resolve_display_fallback_index(0, Some(1)), 0);
    }

    #[test]
    fn resolves_window_fallback_id_from_available_sources() {
        assert_eq!(
            resolve_window_fallback_id(12, &[12, 44, 7]),
            Some((12, false))
        );
        assert_eq!(
            resolve_window_fallback_id(99, &[12, 44, 7]),
            Some((7, true))
        );
        assert_eq!(resolve_window_fallback_id(99, &[]), None);
    }

    fn build_test_session(
        state: RecordingState,
        active_duration_ms: u64,
        last_resume_instant: Option<Instant>,
    ) -> RecordingSession {
        RecordingSession {
            project_id: "test-project".to_string(),
            options: RecordingOptions {
                source_id: "source-1".to_string(),
                source_type: SourceType::Display,
                preferred_display_ordinal: Some(0),
                capture_camera: false,
                capture_microphone: false,
                capture_system_audio: false,
                quality_preset: RecordingQualityPreset::P1080P30,
                codec: RecordingCodec::H264,
            },
            state,
            screen_video_path: PathBuf::from("/tmp/screen.mp4"),
            camera_video_path: None,
            microphone_audio_path: None,
            start_time: chrono::Utc::now(),
            recording_start_time_ms: 0,
            segment_index: 0,
            capture_width: 1920,
            capture_height: 1080,
            capture_fps: 30,
            recording_codec: RecordingCodec::H264,
            screen_segments: vec![],
            current_segment_path: PathBuf::from("/tmp/screen.mp4"),
            active_duration_ms,
            last_resume_instant,
            camera_offset_ms: None,
            microphone_offset_ms: None,
            #[cfg(target_os = "macos")]
            stream: None,
            #[cfg(target_os = "macos")]
            recording_output: None,
            #[cfg(target_os = "linux")]
            ffmpeg_child: None,
        }
    }

    #[test]
    fn elapsed_duration_uses_active_total_for_paused_state() {
        let session = build_test_session(RecordingState::Paused, 4_250, None);
        assert_eq!(calculate_elapsed_duration_ms(&session), 4_250);
    }

    #[test]
    fn elapsed_duration_accumulates_running_interval_for_recording_state() {
        let session = build_test_session(
            RecordingState::Recording,
            2_000,
            Some(Instant::now() - Duration::from_millis(500)),
        );
        let elapsed = calculate_elapsed_duration_ms(&session);
        assert!(elapsed >= 2_500);
    }

    #[test]
    fn parses_ffprobe_duration_output() {
        assert_eq!(parse_ffprobe_duration_seconds("12.34"), Some(12.34));
        assert_eq!(parse_ffprobe_duration_seconds(" 0.0 "), Some(0.0));
        assert_eq!(parse_ffprobe_duration_seconds("N/A"), None);
        assert_eq!(parse_ffprobe_duration_seconds(""), None);
        assert_eq!(parse_ffprobe_duration_seconds("not-a-number"), None);
    }
}
