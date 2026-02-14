mod error;
mod export;
mod project;
mod recording;
use error::AppError;

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use export::{build_ffmpeg_args, get_export_output_path, validate_export_inputs, ExportOptions};
use project::Project;
use recording::{
    check_screen_recording_permission, get_recording_state as do_get_recording_state,
    pause_recording as do_pause_recording, request_screen_recording_permission,
    resume_recording as do_resume_recording, set_media_offsets as do_set_media_offsets,
    start_recording as do_start_recording, stop_recording as do_stop_recording, CaptureSource,
    RecorderState, RecordingOptions, RecordingState as RecorderRecordingState, SharedRecorderState,
    SourceType, StartRecordingResult, StopRecordingResult,
};
use uuid::Uuid;

type SharedExportJobs = Arc<Mutex<HashMap<String, u32>>>;
const START_STOP_SHORTCUT: &str = "CmdOrCtrl+Shift+2";
const PAUSE_RESUME_SHORTCUT: &str = "CmdOrCtrl+Shift+P";
const MIN_RECORDING_FREE_SPACE_BYTES: u64 = 5 * 1024 * 1024 * 1024;
const TRAY_MENU_OPEN_RECORDER: &str = "tray.open-recorder";
const TRAY_MENU_OPEN_PROJECTS: &str = "tray.open-projects";
const TRAY_MENU_QUICK_RECORD: &str = "tray.quick-record";
const TRAY_MENU_START_STOP: &str = "tray.start-stop";
const TRAY_MENU_PAUSE_RESUME: &str = "tray.pause-resume";
const TRAY_MENU_QUIT: &str = "tray.quit";
const TRAY_MENU_RECENT_PREFIX: &str = "tray.recent.";
const APP_MENU_NEW_WINDOW: &str = "app.new-window";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportStartResult {
    job_id: String,
    output_path: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DiskSpaceStatus {
    free_bytes: u64,
    minimum_required_bytes: u64,
    sufficient: bool,
}

fn emit_with_log<S: serde::Serialize>(app: &AppHandle, event: &str, payload: S) {
    if let Err(error) = app.emit(event, payload) {
        eprintln!("Failed to emit event '{}': {}", event, error);
    }
}

fn log_if_err<T, E: std::fmt::Display>(result: Result<T, E>, context: &str) {
    if let Err(error) = result {
        eprintln!("{}: {}", context, error);
    }
}

fn show_main_window(app_handle: &AppHandle) {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        log_if_err(main_window.show(), "Failed to show main window");
        log_if_err(main_window.set_focus(), "Failed to focus main window");
    }
}

fn truncate_tray_label(value: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }

    let mut chars = value.chars();
    let mut output = String::new();
    for _ in 0..max_chars {
        if let Some(ch) = chars.next() {
            output.push(ch);
        } else {
            return output;
        }
    }
    if chars.next().is_some() {
        output.push('…');
    }
    output
}

fn open_videos_library_window(app: &AppHandle) -> Result<(), AppError> {
    let label = format!("library-{}", Uuid::new_v4());
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("/videos".into()))
        .title("Open Rec — Library")
        .inner_size(1120.0, 760.0)
        .min_inner_size(900.0, 620.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|error| {
            AppError::Message(format!("Failed to create library window: {}", error))
        })?;
    Ok(())
}

fn build_app_menu<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    recordings_dir: &PathBuf,
) -> Result<Menu<R>, AppError> {
    let new_window_item = MenuItem::with_id(
        manager,
        APP_MENU_NEW_WINDOW,
        "New Window",
        true,
        Some("CmdOrCtrl+Shift+N"),
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let open_recorder_item = MenuItem::with_id(
        manager,
        TRAY_MENU_OPEN_RECORDER,
        "Open Recorder",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let open_projects_item = MenuItem::with_id(
        manager,
        TRAY_MENU_OPEN_PROJECTS,
        "Open Projects",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let quick_record_item = MenuItem::with_id(
        manager,
        TRAY_MENU_QUICK_RECORD,
        "Quick Record Last Settings",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let recent_submenu = build_recent_projects_submenu(manager, recordings_dir)
        .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let quit_item = MenuItem::with_id(manager, TRAY_MENU_QUIT, "Quit OpenRec", true, None::<&str>)
        .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let separator_primary = PredefinedMenuItem::separator(manager)
        .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let separator = PredefinedMenuItem::separator(manager)
        .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;

    let file_submenu = Submenu::with_items(
        manager,
        "File",
        true,
        &[
            &new_window_item,
            &open_recorder_item,
            &open_projects_item,
            &quick_record_item,
            &recent_submenu,
            &separator_primary,
            &separator,
            &quit_item,
        ],
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;

    Menu::with_items(manager, &[&file_submenu])
        .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))
}

fn load_recent_projects_for_tray(recordings_dir: &PathBuf, max_items: usize) -> Vec<Project> {
    if max_items == 0 || std::fs::metadata(recordings_dir).is_err() {
        return Vec::new();
    }

    let mut projects = Vec::new();
    let entries = match std::fs::read_dir(recordings_dir) {
        Ok(entries) => entries,
        Err(error) => {
            eprintln!(
                "Failed to read recordings directory for tray recent projects: {}",
                error
            );
            return projects;
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                eprintln!(
                    "Failed to read an entry from recordings directory for tray menu: {}",
                    error
                );
                continue;
            }
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let project_file = path.join("project.json");
        let content = match std::fs::read_to_string(project_file) {
            Ok(content) => content,
            Err(error) => {
                eprintln!(
                    "Skipping tray recent candidate because project file could not be read in {}: {}",
                    path.display(),
                    error
                );
                continue;
            }
        };
        match serde_json::from_str::<Project>(&content) {
            Ok(project) => projects.push(project),
            Err(error) => {
                eprintln!(
                    "Skipping tray recent candidate because project JSON is invalid in {}: {}",
                    path.display(),
                    error
                );
            }
        }
    }

    projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    projects.into_iter().take(max_items).collect()
}

fn build_recent_projects_submenu<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    recordings_dir: &PathBuf,
) -> Result<Submenu<R>, AppError> {
    let recent_projects = load_recent_projects_for_tray(recordings_dir, 6);

    if recent_projects.is_empty() {
        let no_recent_item = MenuItem::with_id(
            manager,
            "tray.recent.none",
            "No recent projects",
            false,
            None::<&str>,
        )
        .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
        return Submenu::with_items(manager, "Recent Projects", true, &[&no_recent_item])
            .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)));
    }

    let recent_items = recent_projects
        .iter()
        .map(|project| {
            MenuItem::with_id(
                manager,
                format!("{TRAY_MENU_RECENT_PREFIX}{}", project.id),
                truncate_tray_label(&project.name, 28),
                true,
                None::<&str>,
            )
        })
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let recent_item_refs = recent_items.iter().collect::<Vec<_>>();
    Submenu::with_items(manager, "Recent Projects", true, &recent_item_refs)
        .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))
}

fn build_tray_menu<R: tauri::Runtime, M: Manager<R>>(
    manager: &M,
    recordings_dir: &PathBuf,
) -> Result<Menu<R>, AppError> {
    let open_recorder_item = MenuItem::with_id(
        manager,
        TRAY_MENU_OPEN_RECORDER,
        "Open Recorder",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let open_projects_item = MenuItem::with_id(
        manager,
        TRAY_MENU_OPEN_PROJECTS,
        "Open Projects",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let quick_record_item = MenuItem::with_id(
        manager,
        TRAY_MENU_QUICK_RECORD,
        "Quick Record Last Settings",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let start_stop_item = MenuItem::with_id(
        manager,
        TRAY_MENU_START_STOP,
        "Start/Stop Recording",
        true,
        Some(START_STOP_SHORTCUT),
    )
    .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let pause_resume_item = MenuItem::with_id(
        manager,
        TRAY_MENU_PAUSE_RESUME,
        "Pause/Resume Recording",
        true,
        Some(PAUSE_RESUME_SHORTCUT),
    )
    .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let quit_item = MenuItem::with_id(manager, TRAY_MENU_QUIT, "Quit OpenRec", true, None::<&str>)
        .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let recent_submenu = build_recent_projects_submenu(manager, recordings_dir)?;

    let separator_top = PredefinedMenuItem::separator(manager)
        .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    let separator_bottom = PredefinedMenuItem::separator(manager)
        .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))?;
    Menu::with_items(
        manager,
        &[
            &open_recorder_item,
            &open_projects_item,
            &quick_record_item,
            &recent_submenu,
            &separator_top,
            &start_stop_item,
            &pause_resume_item,
            &separator_bottom,
            &quit_item,
        ],
    )
    .map_err(|error| AppError::Message(format!("Failed to build tray menu: {}", error)))
}

fn refresh_tray_menu(app: &AppHandle, recordings_dir: &PathBuf) {
    if let Some(tray) = app.tray_by_id("open-rec-tray") {
        match build_tray_menu(app, recordings_dir) {
            Ok(menu) => {
                if let Err(error) = tray.set_menu(Some(menu)) {
                    eprintln!("Failed to refresh tray menu: {}", error);
                }
            }
            Err(error) => {
                eprintln!("Failed to refresh tray menu: {}", error);
            }
        }
    } else {
        eprintln!("Tray icon not available while attempting to refresh tray menu");
    }

    match build_app_menu(app, recordings_dir) {
        Ok(menu) => {
            if let Err(error) = app.set_menu(menu) {
                eprintln!("Failed to refresh app menu: {}", error);
            }
        }
        Err(error) => {
            eprintln!("Failed to refresh app menu: {}", error);
        }
    }
}

fn recording_disk_space_status(recordings_dir: &PathBuf) -> Result<DiskSpaceStatus, AppError> {
    let free_bytes = fs2::available_space(recordings_dir).map_err(|error| {
        AppError::Io(format!(
            "Failed to check disk space for recordings directory: {}",
            error
        ))
    })?;

    Ok(DiskSpaceStatus {
        free_bytes,
        minimum_required_bytes: MIN_RECORDING_FREE_SPACE_BYTES,
        sufficient: free_bytes >= MIN_RECORDING_FREE_SPACE_BYTES,
    })
}

fn ensure_recording_disk_headroom(recordings_dir: &PathBuf) -> Result<(), AppError> {
    let status = recording_disk_space_status(recordings_dir)?;

    if !status.sufficient {
        return Err(AppError::Message(format!(
            "Insufficient disk space. At least 5 GB free is required (currently {:.2} GB).",
            status.free_bytes as f64 / (1024.0 * 1024.0 * 1024.0)
        )));
    }

    Ok(())
}

fn terminate_process_by_pid(pid: u32) -> Result<(), AppError> {
    #[cfg(unix)]
    {
        let status = std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status()
            .map_err(|e| {
                AppError::Message(format!("Failed to terminate process {}: {}", pid, e))
            })?;
        if !status.success() {
            return Err(AppError::Message(format!(
                "Failed to terminate process {}",
                pid
            )));
        }
    }

    #[cfg(windows)]
    {
        let status = std::process::Command::new("taskkill")
            .arg("/PID")
            .arg(pid.to_string())
            .arg("/F")
            .status()
            .map_err(|e| {
                AppError::Message(format!("Failed to terminate process {}: {}", pid, e))
            })?;
        if !status.success() {
            return Err(AppError::Message(format!(
                "Failed to terminate process {}",
                pid
            )));
        }
    }

    Ok(())
}

fn cleanup_active_exports(export_jobs: &SharedExportJobs) -> Result<(), AppError> {
    let pids = {
        let mut jobs = export_jobs
            .lock()
            .map_err(|e| AppError::Lock(format!("Failed to lock export jobs state: {}", e)))?;
        let pids = jobs.values().copied().collect::<Vec<_>>();
        jobs.clear();
        pids
    };

    for pid in pids {
        if let Err(error) = terminate_process_by_pid(pid) {
            eprintln!(
                "Failed to terminate export pid {} during app cleanup: {}",
                pid, error
            );
        }
    }

    Ok(())
}

async fn run_ffmpeg_command(app: &AppHandle, args: &[String]) -> Result<(), AppError> {
    let shell = app.shell();
    let ffmpeg_command = match shell.sidecar("ffmpeg") {
        Ok(command) => command,
        Err(error) => {
            eprintln!(
                "Bundled ffmpeg sidecar unavailable, falling back to system ffmpeg: {}",
                error
            );
            shell.command("ffmpeg")
        }
    };
    // Use the sidecar when present, fallback to system binary otherwise.
    // This keeps concat/finalization functional in development environments.
    let (mut rx, _child) = ffmpeg_command
        .args(args)
        .spawn()
        .map_err(|e| AppError::Message(format!("Failed to spawn ffmpeg: {}", e)))?;

    while let Some(event) = rx.recv().await {
        if let CommandEvent::Terminated(status) = event {
            if status.code == Some(0) {
                return Ok(());
            }
            let exit_code = match status.code {
                Some(code) => code.to_string(),
                None => "unknown (terminated by signal)".to_string(),
            };
            return Err(AppError::Message(format!(
                "ffmpeg failed with exit code: {}",
                exit_code
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

    if let Err(error) = tokio::fs::remove_file(&concat_list_path).await {
        eprintln!(
            "Failed to remove concat manifest {}: {}",
            concat_list_path.display(),
            error
        );
    }
    for path in &stop_result.screen_segment_paths {
        if path != &stop_result.screen_video_path {
            if let Err(error) = tokio::fs::remove_file(path).await {
                eprintln!("Failed to remove segment {}: {}", path.display(), error);
            }
        }
    }

    Ok(())
}

fn probe_video_dimensions(screen_video_path: &PathBuf) -> Result<(u32, u32), AppError> {
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
        .map_err(|error| {
            AppError::Io(format!("Failed to run ffprobe for dimensions: {}", error))
        })?;

    if !output.status.success() {
        return Err(AppError::Message(format!(
            "ffprobe failed to extract video dimensions: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let dimensions = String::from_utf8_lossy(&output.stdout);
    let mut parts = dimensions.trim().split('x');
    let width = parts
        .next()
        .ok_or_else(|| AppError::Message("ffprobe did not return a video width".to_string()))?
        .parse()
        .map_err(|error| AppError::Message(format!("Invalid ffprobe width value: {}", error)))?;
    let height = parts
        .next()
        .ok_or_else(|| AppError::Message("ffprobe did not return a video height".to_string()))?
        .parse()
        .map_err(|error| AppError::Message(format!("Invalid ffprobe height value: {}", error)))?;
    Ok((width, height))
}

fn probe_video_duration(screen_video_path: &PathBuf) -> Result<f64, AppError> {
    let output = std::process::Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(screen_video_path.as_os_str())
        .output()
        .map_err(|error| AppError::Io(format!("Failed to run ffprobe for duration: {}", error)))?;

    if !output.status.success() {
        return Err(AppError::Message(format!(
            "ffprobe failed to extract video duration: {}",
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    let duration = String::from_utf8_lossy(&output.stdout);
    duration
        .trim()
        .parse::<f64>()
        .map_err(|error| AppError::Message(format!("Invalid ffprobe duration value: {}", error)))
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

#[tauri::command]
fn check_recording_disk_space(
    state: tauri::State<SharedRecorderState>,
) -> Result<DiskSpaceStatus, AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;

    recording_disk_space_status(&recordings_dir)
}

/// List available capture sources (displays or windows)
#[tauri::command]
fn list_capture_sources(source_type: SourceType) -> Result<Vec<CaptureSource>, AppError> {
    recording::list_capture_sources(source_type)
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

    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    ensure_recording_disk_headroom(&recordings_dir)?;

    let result = do_start_recording(&state, options)?;

    emit_with_log(&app, "recording-started", &result);

    Ok(result)
}

/// Stop screen recording
#[tauri::command]
async fn stop_screen_recording(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    let stop_result = do_stop_recording(&state, &project_id)?;

    emit_with_log(
        &app,
        "recording-finalizing",
        serde_json::json!({
            "projectId": project_id,
            "status": "merging"
        }),
    );
    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "stopping",
            "projectId": &project_id
        }),
    );

    concatenate_screen_segments(&app, &stop_result).await?;

    // Get the recordings directory from state
    let recordings_dir = recordings_dir_from_managed_state(&state)?;

    // Create project.json for the recording
    let duration = match probe_video_duration(&stop_result.screen_video_path) {
        Ok(value) if value.is_finite() && value > 0.0 => value,
        Ok(_) => stop_result.duration_seconds.max(0.1),
        Err(error) => {
            eprintln!(
                "Failed to probe recording duration, falling back to session timing: {error}"
            );
            stop_result.duration_seconds.max(0.1)
        }
    };
    let (width, height) = match probe_video_dimensions(&stop_result.screen_video_path) {
        Ok(dimensions) => dimensions,
        Err(error) => {
            eprintln!("Failed to probe recording dimensions, falling back to source size: {error}");
            (stop_result.source_width, stop_result.source_height)
        }
    };

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
    project::save_project(&recordings_dir, &project).await?;
    refresh_tray_menu(&app, &recordings_dir);
    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "idle",
            "projectId": &project_id
        }),
    );

    // First, show and prepare the main window BEFORE emitting events
    if let Some(main_window) = app.get_webview_window("main") {
        // Resize window for editor view
        log_if_err(
            main_window.set_size(tauri::LogicalSize::new(1200, 800)),
            "Failed to resize main window for editor",
        );
        log_if_err(main_window.center(), "Failed to center main window");
        log_if_err(main_window.show(), "Failed to show main window");
        log_if_err(main_window.set_focus(), "Failed to focus main window");
    }

    // Small delay to ensure the window is ready to receive events
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // Now emit event to notify frontend to navigate to editor
    emit_with_log(&app, "recording-stopped", &project_id);

    // Close recording widget window after main window is ready
    if let Some(widget_window) = app.get_webview_window("recording-widget") {
        log_if_err(
            widget_window.close(),
            "Failed to close recording widget window",
        );
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
}

#[tauri::command]
fn get_recording_state(
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<Option<RecorderRecordingState>, AppError> {
    do_get_recording_state(&state, &project_id)
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

    do_pause_recording(&state, &project_id)?;

    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "paused",
            "projectId": project_id
        }),
    );

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

    do_resume_recording(&state, &project_id)?;

    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "recording",
            "projectId": project_id
        }),
    );

    Ok(())
}

/// Open the recording widget window
#[tauri::command]
fn open_recording_widget(app: AppHandle) -> Result<(), AppError> {
    // Check if widget already exists
    if let Some(widget_window) = app.get_webview_window("recording-widget") {
        log_if_err(
            widget_window.show(),
            "Failed to show existing recording widget",
        );
        log_if_err(
            widget_window.set_focus(),
            "Failed to focus existing recording widget",
        );
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

fn recordings_dir_from_state(app: &AppHandle) -> Result<PathBuf, AppError> {
    let state = app
        .try_state::<SharedRecorderState>()
        .ok_or_else(|| AppError::Message("Recorder state is unavailable".to_string()))?;
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard.recordings_dir.clone())
}

fn recordings_dir_from_managed_state(
    state: &tauri::State<'_, SharedRecorderState>,
) -> Result<PathBuf, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard.recordings_dir.clone())
}

fn open_project_editor_window(app: &AppHandle, project_id: &str) -> Result<(), AppError> {
    let recordings_dir = recordings_dir_from_state(app)?;
    let project_file_path = recordings_dir.join(project_id).join("project.json");
    if !project_file_path.exists() {
        return Err(AppError::Message(format!(
            "Project '{}' was not found at {}",
            project_id,
            project_file_path.display()
        )));
    }

    let title = {
        let mut resolved_title = None;
        match std::fs::read_to_string(&project_file_path) {
            Ok(content) => match serde_json::from_str::<Project>(&content) {
                Ok(project) => {
                    resolved_title = Some(project.name);
                }
                Err(error) => {
                    eprintln!(
                        "Failed to parse project metadata while resolving window title ({}): {}",
                        project_file_path.display(),
                        error
                    );
                }
            },
            Err(error) => {
                eprintln!(
                    "Failed to read project metadata while resolving window title ({}): {}",
                    project_file_path.display(),
                    error
                );
            }
        }
        format!(
            "Open Rec — {}",
            resolved_title
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| project_id.chars().take(8).collect::<String>())
        )
    };

    let label = format!("editor-{}", Uuid::new_v4());
    let route = format!("/editor/{}", project_id);

    WebviewWindowBuilder::new(app, label, WebviewUrl::App(route.into()))
        .title(title)
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 620.0)
        .resizable(true)
        .center()
        .build()
        .map_err(|error| {
            AppError::Message(format!("Failed to create project window: {}", error))
        })?;

    Ok(())
}

fn normalize_opened_project_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let lowered = trimmed.to_ascii_lowercase();
    if lowered.ends_with(".openrec") && trimmed.len() > ".openrec".len() {
        let stripped = &trimmed[..trimmed.len() - ".openrec".len()];
        if !stripped.trim().is_empty() {
            return Some(stripped.to_string());
        }
    }
    Some(trimmed.to_string())
}

fn project_id_from_opened_path(path: &Path) -> Option<String> {
    if path.is_dir() {
        if !path.join("project.json").exists() {
            return None;
        }
        let name = path.file_name()?.to_string_lossy();
        return normalize_opened_project_id(&name);
    }

    if path
        .file_name()?
        .to_string_lossy()
        .eq_ignore_ascii_case("project.json")
    {
        let parent_name = path.parent()?.file_name()?.to_string_lossy();
        return normalize_opened_project_id(&parent_name);
    }

    if path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("openrec"))
    {
        match std::fs::read_to_string(path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => {
                    if let Some(project_id) = json.get("projectId").and_then(|value| value.as_str())
                    {
                        if let Some(normalized) = normalize_opened_project_id(project_id) {
                            return Some(normalized);
                        }
                    }
                    if let Some(project_id) =
                        json.get("project_id").and_then(|value| value.as_str())
                    {
                        if let Some(normalized) = normalize_opened_project_id(project_id) {
                            return Some(normalized);
                        }
                    }
                    if let Some(project_dir) =
                        json.get("projectDir").and_then(|value| value.as_str())
                    {
                        let mut project_dir_path = PathBuf::from(project_dir);
                        if project_dir_path.is_relative() {
                            if let Some(association_parent) = path.parent() {
                                project_dir_path = association_parent.join(project_dir_path);
                            }
                        }
                        if project_dir_path
                            .file_name()
                            .and_then(|value| value.to_str())
                            == Some("project.json")
                        {
                            if let Some(parent_name) = project_dir_path
                                .parent()
                                .and_then(|parent| parent.file_name())
                                .and_then(|value| value.to_str())
                            {
                                if let Some(normalized) = normalize_opened_project_id(parent_name) {
                                    return Some(normalized);
                                }
                            }
                        } else if let Some(dir_name) = project_dir_path
                            .file_name()
                            .and_then(|value| value.to_str())
                        {
                            if let Some(normalized) = normalize_opened_project_id(dir_name) {
                                return Some(normalized);
                            }
                        }
                    }
                }
                Err(error) => {
                    eprintln!(
                        "Failed to parse .openrec association payload ({}): {}",
                        path.display(),
                        error
                    );
                }
            },
            Err(error) => {
                eprintln!(
                    "Failed to read .openrec association payload ({}): {}",
                    path.display(),
                    error
                );
            }
        }
        let stem = path.file_stem()?.to_string_lossy();
        return normalize_opened_project_id(&stem);
    }

    None
}

fn handle_opened_project_paths(app: &AppHandle, paths: Vec<PathBuf>) {
    let mut opened_project_ids = HashSet::new();
    for path in paths {
        let Some(project_id) = project_id_from_opened_path(&path) else {
            eprintln!(
                "Ignoring opened path because project id could not be resolved: {}",
                path.display()
            );
            continue;
        };
        if !opened_project_ids.insert(project_id.clone()) {
            continue;
        }
        if let Err(error) = open_project_editor_window(app, &project_id) {
            eprintln!(
                "Failed to open associated project for path {}: {}",
                path.display(),
                error
            );
        }
    }
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn collect_startup_opened_paths() -> Vec<PathBuf> {
    std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| {
            if let Ok(url) = url::Url::parse(&arg) {
                if let Ok(path) = url.to_file_path() {
                    return path;
                }
            }
            PathBuf::from(arg)
        })
        .collect()
}

/// Open a project editor in a separate window
#[tauri::command]
fn open_project_window(app: AppHandle, project_id: String) -> Result<(), AppError> {
    open_project_editor_window(&app, &project_id)
}

/// Load a project by ID
#[tauri::command]
async fn load_project(
    state: tauri::State<SharedRecorderState>,
    project_id: String,
) -> Result<Project, AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    project::load_project(&recordings_dir, &project_id).await
}

/// Save a project
#[tauri::command]
async fn save_project(
    app: AppHandle,
    state: tauri::State<SharedRecorderState>,
    project: Project,
) -> Result<(), AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    project::save_project(&recordings_dir, &project).await?;
    refresh_tray_menu(&app, &recordings_dir);
    Ok(())
}

/// List all projects
#[tauri::command]
async fn list_projects(state: tauri::State<SharedRecorderState>) -> Result<Vec<Project>, AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    project::list_projects(&recordings_dir).await
}

/// Delete project and all local assets
#[tauri::command]
async fn delete_project(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;

    project::delete_project(&recordings_dir, &project_id).await?;
    refresh_tray_menu(&app, &recordings_dir);
    Ok(())
}

/// Export a project
#[tauri::command]
async fn export_project(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    export_jobs: tauri::State<'_, SharedExportJobs>,
    project_id: String,
    options: ExportOptions,
) -> Result<ExportStartResult, AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    let project = project::load_project(&recordings_dir, &project_id).await?;

    validate_export_inputs(&project, &options)?;

    // Get downloads directory
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));

    // Get output path
    let output_path = get_export_output_path(&project, &options, &downloads_dir);

    // Build ffmpeg arguments
    let args = build_ffmpeg_args(&project, &options, &output_path);

    // Run ffmpeg using the shell plugin
    let shell = app.shell();

    // Try to use bundled ffmpeg sidecar, fallback to system ffmpeg.
    let ffmpeg_command = match shell.sidecar("ffmpeg") {
        Ok(command) => command,
        Err(error) => {
            eprintln!(
                "Bundled ffmpeg sidecar unavailable, falling back to system ffmpeg: {}",
                error
            );
            shell.command("ffmpeg")
        }
    };
    let (mut rx, child) = ffmpeg_command
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
    emit_with_log(
        &app,
        "export-started",
        serde_json::json!({ "jobId": job_id, "pid": job_pid }),
    );

    // Process output for progress
    let app_clone = app.clone();
    let export_jobs_clone = export_jobs.inner().clone();
    let job_id_for_task = job_id.clone();
    tokio::spawn(async move {
        let started = tokio::time::Instant::now();
        let mut last_progress_seconds = 0.0_f64;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stderr(line) => {
                    // Parse ffmpeg progress from stderr
                    let line_str = String::from_utf8_lossy(&line);
                    let fallback_progress = started
                        .elapsed()
                        .as_secs_f64()
                        .min(expected_duration * 0.98);
                    let parsed_progress =
                        parse_ffmpeg_progress(&line_str).unwrap_or(fallback_progress);
                    let bounded_progress = if parsed_progress.is_finite() && parsed_progress >= 0.0
                    {
                        parsed_progress.min(expected_duration)
                    } else {
                        last_progress_seconds
                    };
                    let progress = bounded_progress.max(last_progress_seconds);
                    if progress > last_progress_seconds {
                        last_progress_seconds = progress;
                    }
                    emit_with_log(
                        &app_clone,
                        "export-progress",
                        serde_json::json!({
                            "jobId": &job_id_for_task,
                            "progressSeconds": progress
                        }),
                    );
                }
                CommandEvent::Terminated(status) => {
                    let was_registered = match export_jobs_clone.lock() {
                        Ok(mut jobs) => jobs.remove(&job_id_for_task).is_some(),
                        Err(error) => {
                            eprintln!("Failed to lock export jobs state on termination: {}", error);
                            false
                        }
                    };

                    if !was_registered {
                        break;
                    }

                    if status.code == Some(0) {
                        emit_with_log(
                            &app_clone,
                            "export-progress",
                            serde_json::json!({
                                "jobId": &job_id_for_task,
                                "progressSeconds": expected_duration
                            }),
                        );
                        emit_with_log(
                            &app_clone,
                            "export-complete",
                            serde_json::json!({
                                "jobId": &job_id_for_task,
                                "outputPath": output_path_for_event.to_string_lossy().to_string()
                            }),
                        );
                    } else {
                        emit_with_log(
                            &app_clone,
                            "export-error",
                            serde_json::json!({
                                "jobId": &job_id_for_task,
                                "message": "Export failed"
                            }),
                        );
                    }
                }
                _ => {}
            }
        }
    });

    Ok(ExportStartResult {
        job_id,
        output_path: output_path_str,
    })
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
    terminate_process_by_pid(pid)?;

    emit_with_log(
        &app,
        "export-cancelled",
        serde_json::json!({
            "jobId": job_id
        }),
    );

    Ok(())
}

/// Parse ffmpeg progress from stderr line
fn parse_ffmpeg_progress(line: &str) -> Option<f64> {
    fn parse_hhmmss(value: &str) -> Option<f64> {
        let mut parts = value.trim().split(':');
        let hours: f64 = match parts.next()?.parse() {
            Ok(value) => value,
            Err(_) => return None,
        };
        let minutes: f64 = match parts.next()?.parse() {
            Ok(value) => value,
            Err(_) => return None,
        };
        let seconds: f64 = match parts.next()?.parse() {
            Ok(value) => value,
            Err(_) => return None,
        };
        if parts.next().is_some() {
            return None;
        }
        Some(hours * 3600.0 + minutes * 60.0 + seconds)
    }

    // FFmpeg can emit either:
    // 1) key/value progress (`out_time_us=1234567`, `out_time_ms=1234567`, `out_time=00:00:01.23`)
    // 2) human stderr status (`... time=00:00:01.23 ...`)
    if let Some(out_time_us_idx) = line.find("out_time_us=") {
        let value = &line[out_time_us_idx + "out_time_us=".len()..];
        let raw = value.split_whitespace().next().unwrap_or_default().trim();
        if let Ok(microseconds) = raw.parse::<f64>() {
            if microseconds >= 0.0 {
                return Some(microseconds / 1_000_000.0);
            }
        }
    }

    if let Some(out_time_ms_idx) = line.find("out_time_ms=") {
        let value = &line[out_time_ms_idx + "out_time_ms=".len()..];
        let raw = value.split_whitespace().next().unwrap_or_default().trim();
        if let Ok(microseconds) = raw.parse::<f64>() {
            if microseconds >= 0.0 {
                return Some(microseconds / 1_000_000.0);
            }
        }
    }

    if let Some(out_time_idx) = line.find("out_time=") {
        let value = &line[out_time_idx + "out_time=".len()..];
        let raw = value.split_whitespace().next().unwrap_or_default().trim();
        if let Some(seconds) = parse_hhmmss(raw) {
            return Some(seconds);
        }
    }

    if let Some(time_idx) = line.find("time=") {
        let value = &line[time_idx + "time=".len()..];
        let raw = value.split_whitespace().next().unwrap_or_default().trim();
        if let Some(seconds) = parse_hhmmss(raw) {
            return Some(seconds);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::{normalize_opened_project_id, parse_ffmpeg_progress, project_id_from_opened_path};
    use std::path::PathBuf;
    use uuid::Uuid;

    fn create_test_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!("openrec-{}-{}", name, Uuid::new_v4()));
        std::fs::create_dir_all(&path).expect("failed to create test directory");
        path
    }

    #[test]
    fn parses_out_time_us_progress() {
        let parsed = parse_ffmpeg_progress("out_time_us=3500000");
        assert_eq!(parsed, Some(3.5));
    }

    #[test]
    fn parses_out_time_ms_progress() {
        let parsed = parse_ffmpeg_progress("out_time_ms=4200000");
        assert_eq!(parsed, Some(4.2));
    }

    #[test]
    fn parses_out_time_hhmmss_progress() {
        let parsed = parse_ffmpeg_progress("out_time=00:01:02.25");
        assert_eq!(parsed, Some(62.25));
    }

    #[test]
    fn parses_legacy_time_progress() {
        let parsed = parse_ffmpeg_progress(
            "frame=  32 fps=0.0 q=0.0 size=0kB time=00:00:05.04 bitrate=0.0kbits/s",
        );
        assert_eq!(parsed, Some(5.04));
    }

    #[test]
    fn ignores_invalid_progress_tokens() {
        assert_eq!(parse_ffmpeg_progress("out_time_ms=abc"), None);
        assert_eq!(parse_ffmpeg_progress("time=bad-value"), None);
    }

    #[test]
    fn normalizes_opened_project_ids() {
        assert_eq!(normalize_opened_project_id(""), None);
        assert_eq!(normalize_opened_project_id("   "), None);
        assert_eq!(
            normalize_opened_project_id("example-project.openrec").as_deref(),
            Some("example-project")
        );
        assert_eq!(
            normalize_opened_project_id("EXAMPLE-PROJECT.OPENREC").as_deref(),
            Some("EXAMPLE-PROJECT")
        );
        assert_eq!(
            normalize_opened_project_id("already-normalized").as_deref(),
            Some("already-normalized")
        );
    }

    #[test]
    fn resolves_project_id_from_project_directory() {
        let root = create_test_dir("path-directory");
        let project_dir = root.join("project-123");
        std::fs::create_dir_all(&project_dir).expect("failed to create project directory");
        std::fs::write(project_dir.join("project.json"), "{}")
            .expect("failed to write project.json");

        let resolved = project_id_from_opened_path(&project_dir);
        assert_eq!(resolved.as_deref(), Some("project-123"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_openrec_payload() {
        let root = create_test_dir("openrec-payload");
        let association_path = root.join("open-from-payload.openrec");
        std::fs::write(&association_path, r#"{"projectId":"payload-project"}"#)
            .expect("failed to write association file");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("payload-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_openrec_snake_case_payload() {
        let root = create_test_dir("openrec-snake-payload");
        let association_path = root.join("open-from-snake-payload.openrec");
        std::fs::write(&association_path, r#"{"project_id":"snake-project"}"#)
            .expect("failed to write association file");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("snake-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_openrec_project_dir_fallback() {
        let root = create_test_dir("openrec-project-dir");
        let project_dir = root.join("fallback-project");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        let association_path = root.join("fallback-association.openrec");
        let payload = serde_json::json!({
            "projectDir": project_dir.to_string_lossy().to_string()
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("fallback-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_openrec_project_json_path() {
        let root = create_test_dir("openrec-project-json");
        let project_dir = root.join("json-fallback-project");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        let project_json_path = project_dir.join("project.json");
        std::fs::write(&project_json_path, "{}").expect("failed to write fallback project json");
        let association_path = root.join("json-fallback-association.openrec");
        let payload = serde_json::json!({
            "projectDir": project_json_path.to_string_lossy().to_string()
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("json-fallback-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_relative_openrec_project_dir() {
        let root = create_test_dir("openrec-relative-project-dir");
        let project_dir = root.join("relative-fallback-project");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        let association_path = root.join("relative-association.openrec");
        let payload = serde_json::json!({
            "projectDir": "relative-fallback-project"
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("relative-fallback-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_relative_openrec_project_json_path() {
        let root = create_test_dir("openrec-relative-project-json");
        let project_dir = root.join("relative-json-project");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        std::fs::write(project_dir.join("project.json"), "{}")
            .expect("failed to write fallback project json");
        let association_path = root.join("relative-json-association.openrec");
        let payload = serde_json::json!({
            "projectDir": "relative-json-project/project.json"
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("relative-json-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn falls_back_to_stem_for_invalid_openrec_payload() {
        let root = create_test_dir("openrec-invalid-json");
        let association_path = root.join("fallback-stem.openrec");
        std::fs::write(&association_path, "{invalid-json")
            .expect("failed to write invalid payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("fallback-stem"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn ignores_directory_without_project_file() {
        let root = create_test_dir("openrec-missing-project-json");
        let empty_dir = root.join("not-a-project");
        std::fs::create_dir_all(&empty_dir).expect("failed to create empty directory");

        let resolved = project_id_from_opened_path(&empty_dir);
        assert_eq!(resolved, None);

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_uppercase_openrec_extension() {
        let root = create_test_dir("openrec-uppercase-extension");
        let association_path = root.join("UpperCasePayload.OPENREC");
        std::fs::write(&association_path, r#"{"projectId":"uppercase-project"}"#)
            .expect("failed to write association file");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("uppercase-project"));

        let _ = std::fs::remove_dir_all(root);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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

            let start_stop_shortcut: Shortcut = START_STOP_SHORTCUT
                .parse()
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            let pause_resume_shortcut: Shortcut = PAUSE_RESUME_SHORTCUT
                .parse()
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            let start_stop_handler = start_stop_shortcut;
            let pause_resume_handler = pause_resume_shortcut;

            app.global_shortcut()
                .on_shortcuts(
                    [start_stop_shortcut, pause_resume_shortcut],
                    move |app_handle, shortcut, event| {
                        if event.state != ShortcutState::Pressed {
                            return;
                        }

                        if shortcut == &start_stop_handler {
                            emit_with_log(app_handle, "global-shortcut-start-stop", ());
                        } else if shortcut == &pause_resume_handler {
                            emit_with_log(app_handle, "global-shortcut-toggle-pause", ());
                        }
                    },
                )
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;

            let recordings_dir = app_data_dir.join("recordings");
            let tray_menu = build_tray_menu(app, &recordings_dir)
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;

            let mut tray_builder = TrayIconBuilder::with_id("open-rec-tray")
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app_handle, event| match event.id.as_ref() {
                    APP_MENU_NEW_WINDOW => {
                        if let Err(error) = open_videos_library_window(app_handle) {
                            eprintln!("Failed to open new window from app menu: {}", error);
                        }
                    }
                    TRAY_MENU_OPEN_RECORDER => {
                        show_main_window(app_handle);
                        emit_with_log(app_handle, "tray-open-recorder", ());
                    }
                    TRAY_MENU_OPEN_PROJECTS => {
                        show_main_window(app_handle);
                        emit_with_log(app_handle, "tray-open-projects", ());
                    }
                    TRAY_MENU_QUICK_RECORD => {
                        show_main_window(app_handle);
                        let app_handle = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(120)).await;
                            emit_with_log(&app_handle, "tray-quick-record", ());
                        });
                    }
                    TRAY_MENU_START_STOP => {
                        show_main_window(app_handle);
                        emit_with_log(app_handle, "tray-open-recorder", ());
                        let app_handle = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            tokio::time::sleep(std::time::Duration::from_millis(120)).await;
                            emit_with_log(&app_handle, "global-shortcut-start-stop", ());
                        });
                    }
                    TRAY_MENU_PAUSE_RESUME => {
                        emit_with_log(app_handle, "global-shortcut-toggle-pause", ());
                    }
                    TRAY_MENU_QUIT => {
                        app_handle.exit(0);
                    }
                    other_id => {
                        if let Some(project_id) = other_id.strip_prefix(TRAY_MENU_RECENT_PREFIX) {
                            if project_id != "none" {
                                if let Err(error) =
                                    open_project_editor_window(app_handle, project_id)
                                {
                                    eprintln!(
                                        "Failed to open project {} from tray menu: {}",
                                        project_id, error
                                    );
                                }
                            }
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app_handle = tray.app_handle();
                        show_main_window(app_handle);
                        emit_with_log(app_handle, "tray-open-recorder", ());
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder
                .build(app)
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;

            let app_menu = build_app_menu(app, &recordings_dir)
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;
            app.set_menu(app_menu)
                .map_err(|error| -> Box<dyn std::error::Error> { Box::new(error) })?;

            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                let opened_paths = collect_startup_opened_paths();
                if !opened_paths.is_empty() {
                    handle_opened_project_paths(&app.handle().clone(), opened_paths);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_permission,
            request_permission,
            check_recording_disk_space,
            list_capture_sources,
            start_screen_recording,
            stop_screen_recording,
            set_recording_media_offsets,
            get_recording_state,
            pause_recording,
            resume_recording,
            open_recording_widget,
            open_project_window,
            load_project,
            save_project,
            list_projects,
            delete_project,
            export_project,
            cancel_export,
        ])
        .build(tauri::generate_context!());

    match app_result {
        Ok(app) => {
            app.run(|app_handle, event| {
                #[cfg(any(target_os = "macos", target_os = "ios"))]
                if let RunEvent::Opened { urls } = &event {
                    let mut opened_paths = Vec::new();
                    for url in urls {
                        match url.to_file_path() {
                            Ok(path) => opened_paths.push(path),
                            Err(_) => {
                                eprintln!(
                                    "Skipping non-file URL from Opened event: {}",
                                    url.as_str()
                                );
                            }
                        }
                    }
                    if !opened_paths.is_empty() {
                        handle_opened_project_paths(app_handle, opened_paths);
                    }
                }

                if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                    if let Some(state) = app_handle.try_state::<SharedRecorderState>() {
                        if let Err(error) = recording::cleanup_active_recordings(&state) {
                            eprintln!("Failed to cleanup active recordings: {}", error);
                        }
                    }
                    if let Some(export_jobs) = app_handle.try_state::<SharedExportJobs>() {
                        if let Err(error) = cleanup_active_exports(&export_jobs) {
                            eprintln!("Failed to cleanup active exports: {}", error);
                        }
                    }
                }
            });
        }
        Err(error) => {
            eprintln!("error while running tauri application: {error}");
        }
    }
}
