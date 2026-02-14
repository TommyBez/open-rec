mod error;
mod export;
mod project;
mod recording;
use error::AppError;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use export::{build_ffmpeg_args, get_export_output_path, validate_export_inputs, ExportOptions};
use project::Project;
use recording::{
    check_screen_recording_permission, pause_recording as do_pause_recording,
    request_screen_recording_permission, resume_recording as do_resume_recording,
    set_media_offsets as do_set_media_offsets, start_recording as do_start_recording,
    stop_recording as do_stop_recording, CaptureSource, RecorderState, RecordingOptions,
    SharedRecorderState, SourceType, StartRecordingResult, StopRecordingResult,
};
use uuid::Uuid;

type SharedExportJobs = Arc<Mutex<HashMap<String, u32>>>;

async fn run_ffmpeg_command(app: &AppHandle, args: &[String]) -> Result<(), AppError> {
    let shell = app.shell();
    let (mut rx, _child) = shell
        .sidecar("ffmpeg")
        .unwrap_or_else(|_| shell.command("ffmpeg"))
        .args(args)
        .spawn()
        .map_err(|e| AppError::Message(format!("Failed to spawn ffmpeg: {}", e)))?;

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(status) = event {
            if status.code == Some(0) {
                return Ok(());
            }
            return Err(AppError::Message(format!(
                "ffmpeg failed with exit code: {:?}",
                status.code.unwrap_or(-1)
            )));
        }
    }

    Err(AppError::Message(
        "ffmpeg process terminated unexpectedly".to_string(),
    ))
}

fn escape_concat_path(path: &PathBuf) -> String {
    path.to_string_lossy().replace('\'', "'\\''")
}

async fn concatenate_screen_segments(
    app: &AppHandle,
    stop_result: &StopRecordingResult,
) -> Result<(), AppError> {
    if stop_result.screen_segment_paths.len() <= 1 {
        return Ok(());
    }

    let project_dir = stop_result
        .screen_video_path
        .parent()
        .ok_or_else(|| AppError::Message("Invalid screen video path".to_string()))?;
    let concat_list_path = project_dir.join("segments_concat.txt");
    let merged_path = project_dir.join("screen_merged.mp4");

    let concat_manifest = stop_result
        .screen_segment_paths
        .iter()
        .map(|path| format!("file '{}'", escape_concat_path(path)))
        .collect::<Vec<_>>()
        .join("\n");
    tokio::fs::write(&concat_list_path, concat_manifest)
        .await
        .map_err(|e| AppError::Message(format!("Failed to write concat manifest: {}", e)))?;

    let args = vec![
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        concat_list_path.to_string_lossy().to_string(),
        "-c".to_string(),
        "copy".to_string(),
        "-y".to_string(),
        merged_path.to_string_lossy().to_string(),
    ];

    run_ffmpeg_command(app, &args).await?;

    if tokio::fs::metadata(&stop_result.screen_video_path)
        .await
        .is_ok()
    {
        tokio::fs::remove_file(&stop_result.screen_video_path)
            .await
            .map_err(|e| {
                AppError::Message(format!("Failed to remove old screen recording: {}", e))
            })?;
    }
    tokio::fs::rename(&merged_path, &stop_result.screen_video_path)
        .await
        .map_err(|e| AppError::Message(format!("Failed to finalize merged recording: {}", e)))?;

    let _ = tokio::fs::remove_file(&concat_list_path).await;
    for path in &stop_result.screen_segment_paths {
        if path != &stop_result.screen_video_path {
            let _ = tokio::fs::remove_file(path).await;
        }
    }

    Ok(())
}

fn probe_video_dimensions(screen_video_path: &PathBuf) -> Option<(u32, u32)> {
    let output = std::process::Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-show_entries")
        .arg("stream=width,height")
        .arg("-of")
        .arg("csv=s=x:p=0")
        .arg(screen_video_path.as_os_str())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let dimensions = String::from_utf8_lossy(&output.stdout);
    let mut parts = dimensions.trim().split('x');
    let width = parts.next()?.parse().ok()?;
    let height = parts.next()?.parse().ok()?;
    Some((width, height))
}

fn probe_video_duration(screen_video_path: &PathBuf) -> Option<f64> {
    let output = std::process::Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(screen_video_path.as_os_str())
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let duration = String::from_utf8_lossy(&output.stdout);
    duration.trim().parse::<f64>().ok()
}

/// Check if screen recording permission is granted
#[tauri::command]
fn check_permission() -> bool {
    check_screen_recording_permission()
}

/// Request screen recording permission
#[tauri::command]
fn request_permission() -> bool {
    request_screen_recording_permission()
}

/// List available capture sources (displays or windows)
#[tauri::command]
fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, AppError> {
    recording::list_capture_sources(source_type).map_err(AppError::from)
}

/// Start screen recording
#[tauri::command]
fn start_screen_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    options: RecordingOptions,
) -> Result<StartRecordingResult, AppError> {
    if !check_screen_recording_permission() {
        return Err(AppError::PermissionDenied(
            "Screen recording permission is not granted".to_string(),
        ));
    }

    let result = do_start_recording(&state, options).map_err(AppError::from)?;

    // Emit event to notify frontend
    let _ = app.emit("recording-started", &result);

    Ok(result)
}

/// Stop screen recording
#[tauri::command]
async fn stop_screen_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    let stop_result = do_stop_recording(&state, &project_id).map_err(AppError::from)?;

    let _ = app.emit(
        "recording-finalizing",
        serde_json::json!({
            "projectId": project_id,
            "status": "merging"
        }),
    );

    concatenate_screen_segments(&app, &stop_result).await?;

    // Get the recordings directory from state
    let recordings_dir = {
        let state_guard = state
            .lock()
            .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
        state_guard.recordings_dir.clone()
    };

    // Create project.json for the recording
    let probed_duration =
        probe_video_duration(&stop_result.screen_video_path).filter(|d| d.is_finite() && *d > 0.0);
    let duration = probed_duration.unwrap_or(stop_result.duration_seconds.max(0.1));
    let (width, height) = probe_video_dimensions(&stop_result.screen_video_path)
        .unwrap_or((stop_result.source_width, stop_result.source_height));

    let project = Project::new(
        stop_result.project_id.clone(),
        stop_result.screen_video_path.clone(),
        stop_result.camera_video_path.clone(),
        stop_result.microphone_audio_path.clone(),
        duration,
        width,
        height,
        stop_result.camera_offset_ms,
        stop_result.microphone_offset_ms,
    );
    project::save_project(&recordings_dir, &project)?;

    // First, show and prepare the main window BEFORE emitting events
    if let Some(main_window) = app.get_webview_window("main") {
        // Resize window for editor view
        let _ = main_window.set_size(tauri::LogicalSize::new(1200, 800));
        let _ = main_window.center();
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }

    // Small delay to ensure the window is ready to receive events
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Now emit event to notify frontend to navigate to editor
    let _ = app.emit("recording-stopped", &project_id);

    // Close recording widget window after main window is ready
    if let Some(widget_window) = app.get_webview_window("recording-widget") {
        let _ = widget_window.close();
    }

    Ok(())
}

/// Set media offsets gathered by frontend camera/mic recorders
#[tauri::command]
fn set_recording_media_offsets(
    state: tauri::State<SharedRecorderState>,
    project_id: String,
    camera_offset_ms: Option<i64>,
    microphone_offset_ms: Option<i64>,
) -> Result<(), AppError> {
    do_set_media_offsets(&state, &project_id, camera_offset_ms, microphone_offset_ms)
        .map_err(AppError::from)
}

/// Pause screen recording
#[tauri::command]
fn pause_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    if !check_screen_recording_permission() {
        return Err(AppError::PermissionDenied(
            "Screen recording permission was revoked".to_string(),
        ));
    }

    do_pause_recording(&state, &project_id).map_err(AppError::from)?;

    app.emit(
        "recording-state-changed",
        serde_json::json!({
            "state": "paused",
            "projectId": project_id
        }),
    )
    .map_err(|e| AppError::Message(format!("Failed to emit pause event: {}", e)))?;

    Ok(())
}

/// Resume screen recording
#[tauri::command]
fn resume_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    if !check_screen_recording_permission() {
        return Err(AppError::PermissionDenied(
            "Screen recording permission was revoked".to_string(),
        ));
    }

    do_resume_recording(&state, &project_id).map_err(AppError::from)?;

    app.emit(
        "recording-state-changed",
        serde_json::json!({
            "state": "recording",
            "projectId": project_id
        }),
    )
    .map_err(|e| AppError::Message(format!("Failed to emit resume event: {}", e)))?;

    Ok(())
}

/// Open the recording widget window
#[tauri::command]
fn open_recording_widget(app: AppHandle) -> Result<(), AppError> {
    // Check if widget already exists
    if app.get_webview_window("recording-widget").is_some() {
        return Ok(());
    }

    // Create the recording widget window
    let _widget = WebviewWindowBuilder::new(
        &app,
        "recording-widget",
        WebviewUrl::App("/recording-widget".into()),
    )
    .title("Recording")
    .inner_size(220.0, 60.0)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .build()
    .map_err(|e| AppError::Message(format!("Failed to create widget window: {}", e)))?;

    Ok(())
}

/// Load a project by ID
#[tauri::command]
fn load_project(
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<Project, AppError> {
    let recordings_dir = {
        let state_guard = state
            .lock()
            .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
        state_guard.recordings_dir.clone()
    };
    project::load_project(&recordings_dir, &project_id)
}

/// Save a project
#[tauri::command]
fn save_project(
    state: tauri::State<SharedRecorderState>,
    project: Project,
) -> Result<(), AppError> {
    let recordings_dir = {
        let state_guard = state
            .lock()
            .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
        state_guard.recordings_dir.clone()
    };
    project::save_project(&recordings_dir, &project)
}

/// List all projects
#[tauri::command]
fn list_projects(state: tauri::State<SharedRecorderState>) -> Result<Vec<Project>, AppError> {
    let recordings_dir = {
        let state_guard = state
            .lock()
            .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
        state_guard.recordings_dir.clone()
    };
    project::list_projects(&recordings_dir)
}

/// Export a project
#[tauri::command]
async fn export_project(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    export_jobs: tauri::State<'_, SharedExportJobs>,
    project_id: String,
    options: ExportOptions,
) -> Result<String, AppError> {
    // Load the project
    let (_recordings_dir, project) = {
        let state_guard = state
            .lock()
            .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
        let recordings_dir = state_guard.recordings_dir.clone();
        let project = project::load_project(&recordings_dir, &project_id)?;
        (recordings_dir, project)
    };

    validate_export_inputs(&project).map_err(AppError::from)?;

    // Get downloads directory
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));

    // Get output path
    let output_path = get_export_output_path(&project, &options, &downloads_dir);

    // Build ffmpeg arguments
    let args = build_ffmpeg_args(&project, &options, &output_path);

    // Run ffmpeg using the shell plugin
    let shell = app.shell();

    // Try to use bundled ffmpeg sidecar, fallback to system ffmpeg
    let (mut rx, child) = shell
        .sidecar("ffmpeg")
        .unwrap_or_else(|_| shell.command("ffmpeg"))
        .args(&args)
        .spawn()
        .map_err(|e| AppError::Message(format!("Failed to spawn ffmpeg: {}", e)))?;

    // Clone output_path for use in async block
    let output_path_for_event = output_path.clone();
    let output_path_str = output_path.to_string_lossy().to_string();
    let expected_duration = project.duration.max(1.0);
    let job_id = Uuid::new_v4().to_string();
    let job_pid = child.pid();

    {
        let mut jobs = export_jobs
            .lock()
            .map_err(|e| AppError::Lock(format!("Failed to lock export jobs state: {}", e)))?;
        jobs.insert(job_id.clone(), job_pid);
    }
    let _ = app.emit(
        "export-started",
        serde_json::json!({ "jobId": job_id, "pid": job_pid }),
    );

    // Process output for progress
    let app_clone = app.clone();
    let export_jobs_clone = export_jobs.inner().clone();
    let job_id_for_task = job_id.clone();
    tokio::spawn(async move {
        let started = tokio::time::Instant::now();
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    // Parse ffmpeg progress from stderr
                    let line_str = String::from_utf8_lossy(&line);
                    let progress = parse_ffmpeg_progress(&line_str).unwrap_or_else(|| {
                        started
                            .elapsed()
                            .as_secs_f64()
                            .min(expected_duration * 0.98)
                    });
                    let _ = app_clone.emit("export-progress", progress);
                }
                CommandEvent::Terminated(status) => {
                    let was_registered = export_jobs_clone
                        .lock()
                        .map(|mut jobs| jobs.remove(&job_id_for_task).is_some())
                        .unwrap_or(false);

                    if !was_registered {
                        break;
                    }

                    if status.code == Some(0) {
                        let _ = app_clone.emit("export-complete", &output_path_for_event);
                    } else {
                        let _ = app_clone.emit("export-error", "Export failed");
                    }
                }
                _ => {}
            }
        }
    });

    Ok(output_path_str)
}

/// Cancel an active export job
#[tauri::command]
fn cancel_export(
    app: AppHandle,
    export_jobs: tauri::State<'_, SharedExportJobs>,
    job_id: String,
) -> Result<(), AppError> {
    let pid = {
        let mut jobs = export_jobs
            .lock()
            .map_err(|e| AppError::Lock(format!("Failed to lock export jobs state: {}", e)))?;
        jobs.remove(&job_id)
            .ok_or_else(|| AppError::Message("Export job not found".to_string()))?
    };

    #[cfg(unix)]
    {
        let status = std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status()
            .map_err(|e| AppError::Message(format!("Failed to cancel export process: {}", e)))?;
        if !status.success() {
            return Err(AppError::Message(
                "Failed to cancel export process".to_string(),
            ));
        }
    }

    #[cfg(windows)]
    {
        let status = std::process::Command::new("taskkill")
            .arg("/PID")
            .arg(pid.to_string())
            .arg("/F")
            .status()
            .map_err(|e| AppError::Message(format!("Failed to cancel export process: {}", e)))?;
        if !status.success() {
            return Err(AppError::Message(
                "Failed to cancel export process".to_string(),
            ));
        }
    }

    let _ = app.emit(
        "export-cancelled",
        serde_json::json!({
            "jobId": job_id
        }),
    );

    Ok(())
}

/// Parse ffmpeg progress from stderr line
fn parse_ffmpeg_progress(line: &str) -> Option<f64> {
    // FFmpeg outputs lines like: "frame=  100 fps=30 ... time=00:00:03.33 ..."
    if let Some(time_idx) = line.find("time=") {
        let time_str = &line[time_idx + 5..];
        if let Some(end_idx) = time_str.find(' ') {
            let time_part = &time_str[..end_idx];
            // Parse time format HH:MM:SS.ff
            let parts: Vec<&str> = time_part.split(':').collect();
            if parts.len() == 3 {
                let hours: f64 = parts[0].parse().unwrap_or(0.0);
                let minutes: f64 = parts[1].parse().unwrap_or(0.0);
                let seconds: f64 = parts[2].parse().unwrap_or(0.0);
                return Some(hours * 3600.0 + minutes * 60.0 + seconds);
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let run_result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Initialize recorder state with app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            let recorder_state = Arc::new(Mutex::new(RecorderState::new(app_data_dir)));
            app.manage(recorder_state);
            let export_jobs: SharedExportJobs = Arc::new(Mutex::new(HashMap::new()));
            app.manage(export_jobs);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_permission,
            request_permission,
            list_capture_sources,
            start_screen_recording,
            stop_screen_recording,
            set_recording_media_offsets,
            pause_recording,
            resume_recording,
            open_recording_widget,
            load_project,
            save_project,
            list_projects,
            export_project,
            cancel_export,
        ])
        .run(tauri::generate_context!());

    if let Err(error) = run_result {
        eprintln!("error while running tauri application: {error}");
    }
}
