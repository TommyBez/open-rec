mod export;
mod project;
mod recording;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

use export::{build_ffmpeg_args, get_export_output_path, ExportOptions};
use project::Project;
use recording::{
    check_screen_recording_permission, request_screen_recording_permission,
    pause_recording as do_pause_recording, resume_recording as do_resume_recording,
    start_recording as do_start_recording, stop_recording as do_stop_recording,
    CaptureSource, RecorderState, RecordingOptions, SharedRecorderState, SourceType,
    StartRecordingResult,
};

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
fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, String> {
    recording::list_capture_sources(source_type)
}

/// Start screen recording
#[tauri::command]
fn start_screen_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    options: RecordingOptions,
) -> Result<StartRecordingResult, String> {
    let result = do_start_recording(&state, options)?;
    
    // Emit event to notify frontend
    app.emit("recording-started", &result).ok();
    
    Ok(result)
}

/// Stop screen recording
#[tauri::command]
fn stop_screen_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), String> {
    // Get session info before stopping
    let capture_camera = {
        let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state_guard.sessions.get(&project_id).map(|s| s.options.capture_camera).unwrap_or(false)
    };
    
    do_stop_recording(&state, &project_id)?;
    
    // Get the recordings directory from state
    let recordings_dir = {
        let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state_guard.recordings_dir.clone()
    };
    
    // Create project.json for the recording
    // For now, use placeholder duration - in production would read from video file
    let project_dir = recordings_dir.join(&project_id);
    let screen_video_path = project_dir.join("screen.mp4");
    
    // Determine camera path - use .webm if camera was enabled
    let camera_video_path = if capture_camera {
        Some(project_dir.join("camera.webm"))
    } else {
        None
    };
    
    let project = Project::new(
        project_id.clone(),
        screen_video_path,
        camera_video_path,
        60.0, // placeholder duration
        1920,
        1080,
    );
    project::save_project(&recordings_dir, &project)?;
    
    // First, show and prepare the main window BEFORE emitting events
    if let Some(main_window) = app.get_webview_window("main") {
        // Resize window for editor view
        main_window.set_size(tauri::LogicalSize::new(1200, 800)).ok();
        main_window.center().ok();
        main_window.show().ok();
        main_window.set_focus().ok();
    }
    
    // Small delay to ensure the window is ready to receive events
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    // Now emit event to notify frontend to navigate to editor
    app.emit("recording-stopped", &project_id).ok();
    
    // Close recording widget window after main window is ready
    if let Some(widget_window) = app.get_webview_window("recording-widget") {
        widget_window.close().ok();
    }
    
    Ok(())
}

/// Pause screen recording
#[tauri::command]
fn pause_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), String> {
    do_pause_recording(&state, &project_id)?;
    
    app.emit(
        "recording-state-changed",
        serde_json::json!({
            "state": "paused",
            "projectId": project_id
        }),
    )
    .ok();
    
    Ok(())
}

/// Resume screen recording
#[tauri::command]
fn resume_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), String> {
    do_resume_recording(&state, &project_id)?;
    
    app.emit(
        "recording-state-changed",
        serde_json::json!({
            "state": "recording",
            "projectId": project_id
        }),
    )
    .ok();
    
    Ok(())
}

/// Open the recording widget window
#[tauri::command]
fn open_recording_widget(app: AppHandle) -> Result<(), String> {
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
    .map_err(|e| format!("Failed to create widget window: {}", e))?;
    
    Ok(())
}

/// Load a project by ID
#[tauri::command]
fn load_project(
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<Project, String> {
    let recordings_dir = {
        let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state_guard.recordings_dir.clone()
    };
    project::load_project(&recordings_dir, &project_id)
}

/// Save a project
#[tauri::command]
fn save_project(
    state: tauri::State<SharedRecorderState>,
    project: Project,
) -> Result<(), String> {
    let recordings_dir = {
        let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state_guard.recordings_dir.clone()
    };
    project::save_project(&recordings_dir, &project)
}

/// List all projects
#[tauri::command]
fn list_projects(state: tauri::State<SharedRecorderState>) -> Result<Vec<Project>, String> {
    let recordings_dir = {
        let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        state_guard.recordings_dir.clone()
    };
    project::list_projects(&recordings_dir)
}

/// Export a project
#[tauri::command]
async fn export_project(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
    options: ExportOptions,
) -> Result<String, String> {
    // Load the project
    let (_recordings_dir, project) = {
        let state_guard = state.lock().map_err(|e| format!("Lock error: {}", e))?;
        let recordings_dir = state_guard.recordings_dir.clone();
        let project = project::load_project(&recordings_dir, &project_id)?;
        (recordings_dir, project)
    };
    
    // Get downloads directory
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    
    // Get output path
    let output_path = get_export_output_path(&project, &options, &downloads_dir);
    
    // Build ffmpeg arguments
    let args = build_ffmpeg_args(&project, &options, &output_path);
    
    // Run ffmpeg using the shell plugin
    let shell = app.shell();
    
    // Try to use bundled ffmpeg sidecar, fallback to system ffmpeg
    let (mut rx, _child) = shell
        .sidecar("ffmpeg")
        .unwrap_or_else(|_| shell.command("ffmpeg"))
        .args(&args)
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;
    
    // Clone output_path for use in async block
    let output_path_for_event = output_path.clone();
    let output_path_str = output_path.to_string_lossy().to_string();
    
    // Process output for progress
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    // Parse ffmpeg progress from stderr
                    let line_str = String::from_utf8_lossy(&line);
                    if let Some(progress) = parse_ffmpeg_progress(&line_str) {
                        app_clone.emit("export-progress", progress).ok();
                    }
                }
                CommandEvent::Terminated(status) => {
                    if status.code == Some(0) {
                        app_clone.emit("export-complete", &output_path_for_event).ok();
                    } else {
                        app_clone
                            .emit("export-error", "Export failed")
                            .ok();
                    }
                }
                _ => {}
            }
        }
    });
    
    Ok(output_path_str)
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
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            // Initialize recorder state with app data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            let recorder_state = Arc::new(Mutex::new(RecorderState::new(app_data_dir)));
            app.manage(recorder_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_permission,
            request_permission,
            list_capture_sources,
            start_screen_recording,
            stop_screen_recording,
            pause_recording,
            resume_recording,
            open_recording_widget,
            load_project,
            save_project,
            list_projects,
            export_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
