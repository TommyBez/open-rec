mod error;
mod export;
mod project;
mod recording;
use error::AppError;

use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use export::{build_ffmpeg_args, get_export_output_path, validate_export_inputs, ExportOptions};
use project::Project;
use recording::{
    check_screen_recording_permission, get_recording_snapshot as do_get_recording_snapshot,
    get_recording_state as do_get_recording_state, pause_recording as do_pause_recording,
    request_screen_recording_permission, resume_recording as do_resume_recording,
    set_media_offsets as do_set_media_offsets, start_recording as do_start_recording,
    stop_recording as do_stop_recording, CaptureSource, RecorderState, RecordingOptions,
    RecordingSessionSnapshot, RecordingSourceStatus, RecordingState as RecorderRecordingState,
    SharedRecorderState, SourceType, StartRecordingResult, StopRecordingResult,
};
use uuid::Uuid;

type SharedExportJobs = Arc<Mutex<HashMap<String, u32>>>;
type SharedPendingFinalizations = Arc<Mutex<HashMap<String, StopRecordingResult>>>;
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
const APP_MENU_CHECK_UPDATES: &str = "app.check-updates";
const APP_MENU_UNSIGNED_INSTALL_GUIDE: &str = "app.unsigned-install-guide";
const STOP_RECORDING_FINALIZATION_TIMEOUT_SECS: u64 = 120;
const FFMPEG_COMMAND_TIMEOUT_SECS: u64 = 120;
const OPENREC_RELEASES_URL: &str = "https://github.com/TommyBez/open-rec/releases";
const OPENREC_UNSIGNED_INSTALL_GUIDE_URL: &str =
    "https://github.com/TommyBez/open-rec/blob/main/docs/UNSIGNED_MAC_INSTALL.md";

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

fn emit_with_log<S: serde::Serialize + Clone>(app: &AppHandle, event: &str, payload: S) {
    if let Err(error) = app.emit(event, payload) {
        eprintln!("Failed to emit event '{}': {}", event, error);
    }
}

fn log_if_err<T, E: std::fmt::Display>(result: Result<T, E>, context: &str) {
    if let Err(error) = result {
        eprintln!("{}: {}", context, error);
    }
}

fn block_on_io<T>(future: impl Future<Output = T>) -> Result<T, AppError> {
    if let Ok(handle) = tokio::runtime::Handle::try_current() {
        return Ok(tokio::task::block_in_place(|| handle.block_on(future)));
    }

    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .map_err(|error| {
            AppError::Io(format!(
                "Failed to initialize temporary Tokio runtime for file I/O: {}",
                error
            ))
        })?;
    Ok(runtime.block_on(future))
}

fn normalize_project_id_input(project_id: String, context: &str) -> Result<String, AppError> {
    let normalized = project_id.trim().to_string();
    if normalized.is_empty() {
        return Err(AppError::Message(format!(
            "Missing project id for {}",
            context
        )));
    }
    Ok(normalized)
}

fn show_main_window(app_handle: &AppHandle) {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        log_if_err(main_window.show(), "Failed to show main window");
        log_if_err(main_window.set_focus(), "Failed to focus main window");
    }
}

fn prepare_main_window_for_post_recording(app: &AppHandle) {
    if let Some(main_window) = app.get_webview_window("main") {
        log_if_err(
            main_window.set_size(tauri::LogicalSize::new(1200, 800)),
            "Failed to resize main window for editor",
        );
        log_if_err(main_window.center(), "Failed to center main window");
        log_if_err(main_window.show(), "Failed to show main window");
        log_if_err(main_window.set_focus(), "Failed to focus main window");
    }
}

fn close_recording_widget_window(app: &AppHandle) {
    if let Some(widget_window) = app.get_webview_window("recording-widget") {
        log_if_err(
            widget_window.close(),
            "Failed to close recording widget window",
        );
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
    let check_updates_item = MenuItem::with_id(
        manager,
        APP_MENU_CHECK_UPDATES,
        "Check for Updates",
        true,
        None::<&str>,
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;
    let install_guide_item = MenuItem::with_id(
        manager,
        APP_MENU_UNSIGNED_INSTALL_GUIDE,
        "Unsigned Install Guide",
        true,
        None::<&str>,
    )
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

    let help_submenu = Submenu::with_items(
        manager,
        "Help",
        true,
        &[&check_updates_item, &install_guide_item],
    )
    .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))?;

    Menu::with_items(manager, &[&file_submenu, &help_submenu])
        .map_err(|error| AppError::Message(format!("Failed to build app menu: {}", error)))
}

async fn load_recent_projects_for_tray_async(
    recordings_dir: &Path,
    max_items: usize,
) -> Vec<Project> {
    if max_items == 0 {
        return Vec::new();
    }
    if tokio::fs::metadata(recordings_dir).await.is_err() {
        return Vec::new();
    }

    let mut projects = Vec::new();
    let mut entries = match tokio::fs::read_dir(recordings_dir).await {
        Ok(entries) => entries,
        Err(error) => {
            eprintln!(
                "Failed to read recordings directory for tray recent projects: {}",
                error
            );
            return projects;
        }
    };

    loop {
        let entry = match entries.next_entry().await {
            Ok(Some(entry)) => entry,
            Ok(None) => break,
            Err(error) => {
                eprintln!(
                    "Failed to read an entry from recordings directory for tray menu: {}",
                    error
                );
                continue;
            }
        };

        let file_type = match entry.file_type().await {
            Ok(file_type) => file_type,
            Err(error) => {
                eprintln!(
                    "Failed to inspect recordings directory entry type for tray menu ({}): {}",
                    entry.path().display(),
                    error
                );
                continue;
            }
        };
        if !file_type.is_dir() {
            continue;
        }

        let path = entry.path();
        let project_file = path.join("project.json");
        let content = match tokio::fs::read_to_string(&project_file).await {
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

fn load_recent_projects_for_tray(recordings_dir: &PathBuf, max_items: usize) -> Vec<Project> {
    match block_on_io(load_recent_projects_for_tray_async(
        recordings_dir,
        max_items,
    )) {
        Ok(projects) => projects,
        Err(error) => {
            eprintln!(
                "Failed to load recent projects for tray menu via async I/O: {}",
                error
            );
            Vec::new()
        }
    }
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
    let recent_item_refs = recent_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<_>>();
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

fn open_external_url(url: &str) -> Result<(), AppError> {
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|error| {
        AppError::Message(format!(
            "Opening URL {} failed via opener plugin: {}",
            url, error
        ))
    })
}

fn is_missing_process_error(stderr: &str) -> bool {
    let normalized = stderr.trim().to_ascii_lowercase();
    normalized.contains("no such process")
        || normalized.contains("not found")
        || normalized.contains("cannot find the process")
}

fn terminate_process_by_pid(pid: u32) -> Result<(), AppError> {
    #[cfg(unix)]
    {
        let output = std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .output()
            .map_err(|e| {
                AppError::Message(format!("Failed to terminate process {}: {}", pid, e))
            })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if is_missing_process_error(&stderr) {
                return Ok(());
            }
            return Err(AppError::Message(format!(
                "Failed to terminate process {}: {}",
                pid,
                if stderr.is_empty() {
                    "kill exited with non-zero status".to_string()
                } else {
                    stderr
                }
            )));
        }
    }

    #[cfg(windows)]
    {
        let output = std::process::Command::new("taskkill")
            .arg("/PID")
            .arg(pid.to_string())
            .arg("/F")
            .output()
            .map_err(|e| {
                AppError::Message(format!("Failed to terminate process {}: {}", pid, e))
            })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            if is_missing_process_error(&stderr) {
                return Ok(());
            }
            return Err(AppError::Message(format!(
                "Failed to terminate process {}: {}",
                pid,
                if stderr.is_empty() {
                    "taskkill exited with non-zero status".to_string()
                } else {
                    stderr
                }
            )));
        }
    }

    Ok(())
}

fn is_process_running(pid: u32) -> Result<bool, AppError> {
    #[cfg(unix)]
    {
        let output = std::process::Command::new("kill")
            .arg("-0")
            .arg(pid.to_string())
            .output()
            .map_err(|error| {
                AppError::Message(format!("Failed to inspect process {}: {}", pid, error))
            })?;
        if output.status.success() {
            return Ok(true);
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let normalized = stderr.to_ascii_lowercase();
        if is_missing_process_error(&stderr) {
            return Ok(false);
        }
        if normalized.contains("operation not permitted")
            || normalized.contains("permission denied")
        {
            return Ok(true);
        }
        return Err(AppError::Message(format!(
            "Failed to inspect process {}: {}",
            pid,
            if stderr.is_empty() {
                "kill -0 exited with non-zero status".to_string()
            } else {
                stderr
            }
        )));
    }

    #[cfg(windows)]
    {
        let output = std::process::Command::new("tasklist")
            .args(["/FI", &format!("PID eq {}", pid), "/FO", "CSV", "/NH"])
            .output()
            .map_err(|error| {
                AppError::Message(format!("Failed to inspect process {}: {}", pid, error))
            })?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            return Err(AppError::Message(format!(
                "Failed to inspect process {}: {}",
                pid,
                if stderr.is_empty() {
                    "tasklist exited with non-zero status".to_string()
                } else {
                    stderr
                }
            )));
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        let normalized = stdout.trim().to_ascii_lowercase();
        if normalized.is_empty() || normalized.contains("no tasks are running") {
            return Ok(false);
        }
        return Ok(true);
    }
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
    let (mut rx, child) = ffmpeg_command
        .args(args)
        .spawn()
        .map_err(|e| AppError::Message(format!("Failed to spawn ffmpeg: {}", e)))?;
    let pid = child.pid();
    let timeout_duration = std::time::Duration::from_secs(FFMPEG_COMMAND_TIMEOUT_SECS);
    let timeout = tokio::time::sleep(timeout_duration);
    tokio::pin!(timeout);

    loop {
        tokio::select! {
            _ = &mut timeout => {
                return Err(handle_ffmpeg_timeout(
                    pid,
                    FFMPEG_COMMAND_TIMEOUT_SECS,
                    terminate_process_by_pid,
                ));
            }
            event = rx.recv() => {
                let Some(event) = event else {
                    break;
                };
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
        }
    }

    Err(AppError::Message(
        "ffmpeg process terminated unexpectedly".to_string(),
    ))
}

fn handle_ffmpeg_timeout<F>(pid: u32, timeout_secs: u64, terminate_process: F) -> AppError
where
    F: FnOnce(u32) -> Result<(), AppError>,
{
    if let Err(error) = terminate_process(pid) {
        eprintln!(
            "Failed to terminate timed-out ffmpeg process {}: {}",
            pid, error
        );
    }
    AppError::Message(format!(
        "ffmpeg command timed out after {} seconds",
        timeout_secs
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

    let merge_result = async {
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
            .map_err(|e| AppError::Message(format!("Failed to finalize merged recording: {}", e)))
    }
    .await;

    if let Err(error) = tokio::fs::remove_file(&concat_list_path).await {
        eprintln!(
            "Failed to remove concat manifest {}: {}",
            concat_list_path.display(),
            error
        );
    }

    if merge_result.is_err() {
        if tokio::fs::metadata(&merged_path).await.is_ok() {
            if let Err(error) = tokio::fs::remove_file(&merged_path).await {
                eprintln!(
                    "Failed to remove incomplete merged recording {}: {}",
                    merged_path.display(),
                    error
                );
            }
        }
        return merge_result;
    }

    for path in &stop_result.screen_segment_paths {
        if path != &stop_result.screen_video_path {
            if let Err(error) = tokio::fs::remove_file(path).await {
                eprintln!("Failed to remove segment {}: {}", path.display(), error);
            }
        }
    }

    merge_result
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
    parse_ffprobe_dimensions_output(&dimensions)
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
    parse_ffprobe_duration_output(&duration)
}

fn parse_ffprobe_dimensions_output(raw: &str) -> Result<(u32, u32), AppError> {
    let mut parts = raw.trim().split('x');
    let width = parts
        .next()
        .ok_or_else(|| AppError::Message("ffprobe did not return a video width".to_string()))?
        .trim()
        .parse::<u32>()
        .map_err(|error| AppError::Message(format!("Invalid ffprobe width value: {}", error)))?;
    let height = parts
        .next()
        .ok_or_else(|| AppError::Message("ffprobe did not return a video height".to_string()))?
        .trim()
        .parse::<u32>()
        .map_err(|error| AppError::Message(format!("Invalid ffprobe height value: {}", error)))?;
    if parts.next().is_some() {
        return Err(AppError::Message(
            "Invalid ffprobe dimensions format; expected WIDTHxHEIGHT".to_string(),
        ));
    }
    if width == 0 || height == 0 {
        return Err(AppError::Message(
            "ffprobe returned non-positive video dimensions".to_string(),
        ));
    }
    Ok((width, height))
}

fn parse_ffprobe_duration_output(raw: &str) -> Result<f64, AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("n/a") {
        return Err(AppError::Message(
            "ffprobe did not return a valid duration".to_string(),
        ));
    }
    let duration = trimmed
        .parse::<f64>()
        .map_err(|error| AppError::Message(format!("Invalid ffprobe duration value: {}", error)))?;
    if !duration.is_finite() || duration <= 0.0 {
        return Err(AppError::Message(
            "ffprobe returned a non-positive duration".to_string(),
        ));
    }
    Ok(duration)
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
    state: tauri::State<'_, SharedRecorderState>,
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
    state: tauri::State<'_, SharedRecorderState>,
    options: RecordingOptions,
) -> Result<StartRecordingResult, AppError> {
    if !check_screen_recording_permission() {
        return Err(AppError::PermissionDenied(
            "Screen recording permission is not granted".to_string(),
        ));
    }

    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    ensure_recording_disk_headroom(&recordings_dir)?;

    let source_type_for_event = options.source_type;
    let result = do_start_recording(&state, options)?;

    emit_with_log(&app, "recording-started", &result);
    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "recording",
            "projectId": &result.project_id
        }),
    );
    if let Some(fallback_source) = result.fallback_source.as_ref() {
        emit_with_log(
            &app,
            "recording-source-fallback",
            serde_json::json!({
                "projectId": &result.project_id,
                "sourceType": source_type_for_event,
                "sourceId": &fallback_source.source_id,
                "sourceOrdinal": fallback_source.source_ordinal
            }),
        );
    }

    Ok(result)
}

fn store_pending_finalization(
    pending_finalizations: &SharedPendingFinalizations,
    stop_result: &StopRecordingResult,
) -> Result<(), AppError> {
    let mut guard = pending_finalizations
        .lock()
        .map_err(|error| AppError::Lock(format!("Lock error: {}", error)))?;
    guard.insert(stop_result.project_id.clone(), stop_result.clone());
    Ok(())
}

fn check_path_exists(path: &Path) -> Result<bool, AppError> {
    let exists_result = block_on_io(tokio::fs::try_exists(path))?;
    exists_result.map_err(|error| {
        AppError::Io(format!(
            "Failed to verify pending finalization artifact {}: {}",
            path.display(),
            error
        ))
    })
}

fn has_required_finalization_artifacts(
    stop_result: &StopRecordingResult,
) -> Result<bool, AppError> {
    if !check_path_exists(&stop_result.screen_video_path)? {
        return Ok(false);
    }
    for segment_path in &stop_result.screen_segment_paths {
        if !check_path_exists(segment_path)? {
            return Ok(false);
        }
    }
    Ok(true)
}

fn get_pending_finalization(
    pending_finalizations: &SharedPendingFinalizations,
    project_id: &str,
) -> Result<Option<StopRecordingResult>, AppError> {
    let stop_result = {
        let guard = pending_finalizations
            .lock()
            .map_err(|error| AppError::Lock(format!("Lock error: {}", error)))?;
        guard.get(project_id).cloned()
    };

    let Some(stop_result) = stop_result else {
        return Ok(None);
    };

    if has_required_finalization_artifacts(&stop_result)? {
        return Ok(Some(stop_result));
    }

    eprintln!(
        "Pending finalization context for {} is stale and will be cleared.",
        project_id
    );
    clear_pending_finalization(pending_finalizations, project_id)?;
    Ok(None)
}

fn clear_pending_finalization(
    pending_finalizations: &SharedPendingFinalizations,
    project_id: &str,
) -> Result<(), AppError> {
    let mut guard = pending_finalizations
        .lock()
        .map_err(|error| AppError::Lock(format!("Lock error: {}", error)))?;
    guard.remove(project_id);
    Ok(())
}

fn has_pending_finalization(
    pending_finalizations: &SharedPendingFinalizations,
    project_id: &str,
) -> Result<bool, AppError> {
    Ok(get_pending_finalization(pending_finalizations, project_id)?.is_some())
}

async fn finalize_stopped_recording(
    app: &AppHandle,
    state: &tauri::State<'_, SharedRecorderState>,
    project_id: &str,
    stop_result: &StopRecordingResult,
) -> Result<(), AppError> {
    let emit_finalizing_status = |status: &str| {
        emit_with_log(
            app,
            "recording-finalizing",
            serde_json::json!({
                "projectId": project_id,
                "status": status
            }),
        );
    };

    emit_finalizing_status("concatenating-segments");
    concatenate_screen_segments(app, stop_result).await?;
    emit_finalizing_status("verifying-duration");

    let recordings_dir = recordings_dir_from_managed_state(state)?;
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

    emit_finalizing_status("verifying-dimensions");
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

    emit_finalizing_status("saving-project");
    project::save_project(&recordings_dir, &project).await?;
    emit_finalizing_status("refreshing-ui");
    refresh_tray_menu(app, &recordings_dir);
    Ok(())
}

/// Stop screen recording
#[tauri::command]
async fn stop_screen_recording(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    pending_finalizations: tauri::State<'_, SharedPendingFinalizations>,
    project_id: String,
) -> Result<(), AppError> {
    let project_id = normalize_project_id_input(project_id, "stop recording")?;
    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "stopping",
            "projectId": &project_id
        }),
    );
    emit_with_log(
        &app,
        "recording-finalizing",
        serde_json::json!({
            "projectId": &project_id,
            "status": "stopping-capture"
        }),
    );
    let stop_result = match do_stop_recording(&state, &project_id) {
        Ok(result) => result,
        Err(error) => {
            let _ = clear_pending_finalization(pending_finalizations.inner(), &project_id);
            emit_with_log(
                &app,
                "recording-stop-failed",
                serde_json::json!({
                    "projectId": &project_id,
                    "message": error.to_string()
                }),
            );
            emit_with_log(
                &app,
                "recording-state-changed",
                serde_json::json!({
                    "state": "idle",
                    "projectId": &project_id
                }),
            );
            prepare_main_window_for_post_recording(&app);
            close_recording_widget_window(&app);
            return Err(error);
        }
    };
    if let Err(error) = store_pending_finalization(pending_finalizations.inner(), &stop_result) {
        emit_with_log(
            &app,
            "recording-stop-failed",
            serde_json::json!({
                "projectId": &project_id,
                "message": error.to_string()
            }),
        );
        emit_with_log(
            &app,
            "recording-state-changed",
            serde_json::json!({
                "state": "idle",
                "projectId": &project_id
            }),
        );
        prepare_main_window_for_post_recording(&app);
        close_recording_widget_window(&app);
        return Err(error);
    }

    let finalization_result = tokio::time::timeout(
        std::time::Duration::from_secs(STOP_RECORDING_FINALIZATION_TIMEOUT_SECS),
        finalize_stopped_recording(&app, &state, &project_id, &stop_result),
    )
    .await
    .unwrap_or_else(|_| {
        Err(AppError::Message(format!(
            "Recording finalization timed out after {} seconds.",
            STOP_RECORDING_FINALIZATION_TIMEOUT_SECS
        )))
    });

    if let Err(error) = finalization_result {
        emit_with_log(
            &app,
            "recording-stop-failed",
            serde_json::json!({
                "projectId": &project_id,
                "message": error.to_string()
            }),
        );
        emit_with_log(
            &app,
            "recording-state-changed",
            serde_json::json!({
                "state": "idle",
                "projectId": &project_id
            }),
        );
        prepare_main_window_for_post_recording(&app);
        close_recording_widget_window(&app);
        return Err(error);
    }
    let _ = clear_pending_finalization(pending_finalizations.inner(), &project_id);

    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "idle",
            "projectId": &project_id
        }),
    );

    // First, show and prepare the main window BEFORE emitting events
    prepare_main_window_for_post_recording(&app);

    // Small delay to ensure the window is ready to receive events
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // Now emit event to notify frontend to navigate to editor
    emit_with_log(&app, "recording-stopped", &project_id);

    // Close recording widget window after main window is ready
    close_recording_widget_window(&app);

    Ok(())
}

#[tauri::command]
async fn retry_recording_finalization(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    pending_finalizations: tauri::State<'_, SharedPendingFinalizations>,
    project_id: String,
) -> Result<(), AppError> {
    let project_id = normalize_project_id_input(project_id, "retry recording finalization")?;
    let Some(stop_result) = get_pending_finalization(pending_finalizations.inner(), &project_id)?
    else {
        emit_with_log(
            &app,
            "recording-finalization-retry-status",
            serde_json::json!({
                "projectId": &project_id,
                "status": "failed",
                "message": "No failed finalization context is available for retry."
            }),
        );
        return Err(AppError::Message(
            "No failed finalization context is available for retry.".to_string(),
        ));
    };

    emit_with_log(
        &app,
        "recording-finalization-retry-status",
        serde_json::json!({
            "projectId": &project_id,
            "status": "started"
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

    let retry_result = tokio::time::timeout(
        std::time::Duration::from_secs(STOP_RECORDING_FINALIZATION_TIMEOUT_SECS),
        finalize_stopped_recording(&app, &state, &project_id, &stop_result),
    )
    .await
    .unwrap_or_else(|_| {
        Err(AppError::Message(format!(
            "Recording finalization retry timed out after {} seconds.",
            STOP_RECORDING_FINALIZATION_TIMEOUT_SECS
        )))
    });

    if let Err(error) = retry_result {
        emit_with_log(
            &app,
            "recording-finalization-retry-status",
            serde_json::json!({
                "projectId": &project_id,
                "status": "failed",
                "message": error.to_string()
            }),
        );
        emit_with_log(
            &app,
            "recording-stop-failed",
            serde_json::json!({
                "projectId": &project_id,
                "message": error.to_string()
            }),
        );
        emit_with_log(
            &app,
            "recording-state-changed",
            serde_json::json!({
                "state": "idle",
                "projectId": &project_id
            }),
        );
        prepare_main_window_for_post_recording(&app);
        close_recording_widget_window(&app);
        return Err(error);
    }

    let _ = clear_pending_finalization(pending_finalizations.inner(), &project_id);
    emit_with_log(
        &app,
        "recording-finalization-retry-status",
        serde_json::json!({
            "projectId": &project_id,
            "status": "succeeded"
        }),
    );

    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "idle",
            "projectId": &project_id
        }),
    );

    prepare_main_window_for_post_recording(&app);
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    emit_with_log(&app, "recording-stopped", &project_id);
    close_recording_widget_window(&app);

    Ok(())
}

#[tauri::command]
fn has_pending_recording_finalization(
    pending_finalizations: tauri::State<'_, SharedPendingFinalizations>,
    project_id: String,
) -> Result<bool, AppError> {
    let project_id = normalize_project_id_input(project_id, "check pending finalization")?;
    has_pending_finalization(pending_finalizations.inner(), &project_id)
}

/// Set media offsets gathered by frontend camera/mic recorders
#[tauri::command]
fn set_recording_media_offsets(
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
    camera_offset_ms: Option<i64>,
    microphone_offset_ms: Option<i64>,
) -> Result<(), AppError> {
    let project_id = normalize_project_id_input(project_id, "set media offsets")?;
    do_set_media_offsets(&state, &project_id, camera_offset_ms, microphone_offset_ms)
}

#[tauri::command]
fn get_recording_state(
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<Option<RecorderRecordingState>, AppError> {
    let project_id = normalize_project_id_input(project_id, "get recording state")?;
    do_get_recording_state(&state, &project_id)
}

#[tauri::command]
fn get_recording_snapshot(
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<Option<RecordingSessionSnapshot>, AppError> {
    let project_id = normalize_project_id_input(project_id, "get recording snapshot")?;
    do_get_recording_snapshot(&state, &project_id)
}

#[tauri::command]
fn get_recording_source_status(
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<Option<RecordingSourceStatus>, AppError> {
    let project_id = normalize_project_id_input(project_id, "get recording source status")?;
    recording::get_recording_source_status(&state, &project_id)
}

/// Pause screen recording
#[tauri::command]
fn pause_recording(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    let project_id = normalize_project_id_input(project_id, "pause recording")?;
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
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<(), AppError> {
    let project_id = normalize_project_id_input(project_id, "resume recording")?;
    if !check_screen_recording_permission() {
        return Err(AppError::PermissionDenied(
            "Screen recording permission was revoked".to_string(),
        ));
    }

    let fallback_source = do_resume_recording(&state, &project_id)?;

    emit_with_log(
        &app,
        "recording-state-changed",
        serde_json::json!({
            "state": "recording",
            "projectId": project_id
        }),
    );
    if let Some(fallback_update) = fallback_source {
        emit_with_log(
            &app,
            "recording-source-fallback",
            serde_json::json!({
                "projectId": project_id,
                "sourceType": fallback_update.source_type,
                "sourceId": fallback_update.fallback_source.source_id,
                "sourceOrdinal": fallback_update.fallback_source.source_ordinal
            }),
        );
    }

    Ok(())
}

/// Open the recording widget window
#[tauri::command]
fn open_recording_widget(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
) -> Result<(), AppError> {
    if !has_active_recording_session(state.inner())? {
        return Err(AppError::Message(
            "No active recording session available for floating controls.".to_string(),
        ));
    }

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

fn has_active_recording_session(state: &SharedRecorderState) -> Result<bool, AppError> {
    let state_guard = state
        .lock()
        .map_err(|e| AppError::Lock(format!("Lock error: {}", e)))?;
    Ok(state_guard.sessions.values().any(|session| {
        matches!(
            session.state,
            RecorderRecordingState::Recording | RecorderRecordingState::Paused
        )
    }))
}

async fn resolve_project_json_path_async(project_dir: &Path) -> Result<PathBuf, AppError> {
    let primary_path = project_dir.join("project.json");
    match tokio::fs::metadata(&primary_path).await {
        Ok(metadata) if metadata.is_file() => {
            return Ok(primary_path);
        }
        Ok(_) => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
            return Err(AppError::Io(format!(
                "Failed to inspect project metadata path ({}): {}",
                primary_path.display(),
                error
            )));
        }
    }

    let mut entries = tokio::fs::read_dir(project_dir).await.map_err(|error| {
        AppError::Io(format!(
            "Failed to scan project directory for project.json ({}): {}",
            project_dir.display(),
            error
        ))
    })?;

    loop {
        let entry = entries.next_entry().await.map_err(|error| {
            AppError::Io(format!(
                "Failed to inspect project directory entry ({}): {}",
                project_dir.display(),
                error
            ))
        })?;
        let Some(entry) = entry else {
            break;
        };
        let file_type = entry.file_type().await.map_err(|error| {
            AppError::Io(format!(
                "Failed to inspect project directory entry type ({}): {}",
                project_dir.display(),
                error
            ))
        })?;
        if file_type.is_file()
            && entry
                .file_name()
                .to_string_lossy()
                .eq_ignore_ascii_case("project.json")
        {
            return Ok(entry.path());
        }
    }

    Err(AppError::Message(format!(
        "Project metadata file 'project.json' was not found in {}",
        project_dir.display()
    )))
}

fn resolve_project_json_path(project_dir: &Path) -> Result<PathBuf, AppError> {
    block_on_io(resolve_project_json_path_async(project_dir))?
}

fn open_project_editor_window(app: &AppHandle, project_id: &str) -> Result<(), AppError> {
    let recordings_dir = recordings_dir_from_state(app)?;
    let project_dir = recordings_dir.join(project_id);
    let project_file_path = resolve_project_json_path(&project_dir).map_err(|error| {
        AppError::Message(format!(
            "Project '{}' was not found or is invalid: {}",
            project_id, error
        ))
    })?;

    let title = {
        let mut resolved_title = None;
        match block_on_io(tokio::fs::read_to_string(&project_file_path)) {
            Ok(Ok(content)) => match serde_json::from_str::<Project>(&content) {
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
            Ok(Err(error)) => {
                eprintln!(
                    "Failed to read project metadata while resolving window title ({}): {}",
                    project_file_path.display(),
                    error
                );
            }
            Err(error) => {
                eprintln!(
                    "Failed to run async project metadata read while resolving window title ({}): {}",
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
    let route = build_editor_route(project_id);

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

fn build_editor_route(project_id: &str) -> String {
    let encoded_project_id: String =
        url::form_urlencoded::byte_serialize(project_id.as_bytes()).collect();
    format!("/editor/{}", encoded_project_id)
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

fn resolve_project_dir_from_payload(project_dir: &str, association_path: &Path) -> Option<PathBuf> {
    let mut resolved_path = match url::Url::parse(project_dir) {
        Ok(url) if url.scheme().eq_ignore_ascii_case("file") => match url.to_file_path() {
            Ok(file_path) => file_path,
            Err(_) => {
                eprintln!(
                    "Failed to decode file URL in .openrec payload ({}): {}",
                    association_path.display(),
                    project_dir
                );
                return None;
            }
        },
        Ok(url) => {
            eprintln!(
                "Unsupported URL scheme in .openrec projectDir payload ({}): {}",
                association_path.display(),
                url.scheme()
            );
            return None;
        }
        Err(_) => PathBuf::from(project_dir),
    };

    if resolved_path.is_relative() {
        if let Some(association_parent) = association_path.parent() {
            resolved_path = association_parent.join(resolved_path);
        }
    }

    Some(resolved_path)
}

async fn project_id_from_opened_path_async(path: &Path) -> Option<String> {
    let metadata = match tokio::fs::metadata(path).await {
        Ok(metadata) => Some(metadata),
        Err(error) if error.kind() == ErrorKind::NotFound => None,
        Err(error) => {
            eprintln!(
                "Failed to inspect opened path metadata ({}): {}",
                path.display(),
                error
            );
            None
        }
    };

    if metadata.as_ref().is_some_and(|value| value.is_dir()) {
        if let Err(error) = resolve_project_json_path_async(path).await {
            eprintln!(
                "Ignoring opened directory because project metadata could not be resolved ({}): {}",
                path.display(),
                error
            );
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
        if !metadata.as_ref().is_some_and(|value| value.is_file()) {
            eprintln!(
                "Ignoring opened project.json path because it is not a file: {}",
                path.display()
            );
            return None;
        }
        let parent_name = path.parent()?.file_name()?.to_string_lossy();
        return normalize_opened_project_id(&parent_name);
    }

    if path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("openrec"))
    {
        match tokio::fs::read_to_string(path).await {
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
                    let project_dir = json
                        .get("projectDir")
                        .or_else(|| json.get("project_dir"))
                        .or_else(|| json.get("projectPath"))
                        .or_else(|| json.get("project_path"))
                        .and_then(|value| value.as_str());
                    if let Some(project_dir) = project_dir {
                        let Some(project_dir_path) =
                            resolve_project_dir_from_payload(project_dir, path)
                        else {
                            let stem = path.file_stem()?.to_string_lossy();
                            return normalize_opened_project_id(&stem);
                        };
                        let project_dir_metadata =
                            match tokio::fs::metadata(&project_dir_path).await {
                                Ok(metadata) => Some(metadata),
                                Err(error) if error.kind() == ErrorKind::NotFound => None,
                                Err(error) => {
                                    eprintln!(
                                    "Failed to inspect .openrec projectDir payload path ({}): {}",
                                    project_dir_path.display(),
                                    error
                                );
                                    None
                                }
                            };
                        if project_dir_metadata
                            .as_ref()
                            .is_some_and(|value| value.is_dir())
                        {
                            if let Some(dir_name) = project_dir_path
                                .file_name()
                                .and_then(|value| value.to_str())
                            {
                                if let Some(normalized) = normalize_opened_project_id(dir_name) {
                                    return Some(normalized);
                                }
                            }
                        } else if project_dir_metadata
                            .as_ref()
                            .is_some_and(|value| value.is_file())
                            && project_dir_path
                                .file_name()
                                .and_then(|value| value.to_str())
                                .is_some_and(|value| value.eq_ignore_ascii_case("project.json"))
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

fn project_id_from_opened_path(path: &Path) -> Option<String> {
    match block_on_io(project_id_from_opened_path_async(path)) {
        Ok(project_id) => project_id,
        Err(error) => {
            eprintln!(
                "Failed to resolve project id from opened path via async I/O ({}): {}",
                path.display(),
                error
            );
            None
        }
    }
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
fn strip_wrapping_quotes(value: &str) -> &str {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let starts_with_double = trimmed.starts_with('"') && trimmed.ends_with('"');
        let starts_with_single = trimmed.starts_with('\'') && trimmed.ends_with('\'');
        if starts_with_double || starts_with_single {
            return &trimmed[1..trimmed.len() - 1];
        }
    }
    trimmed
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn parse_startup_opened_arg(arg: &str) -> Option<PathBuf> {
    let normalized_arg = strip_wrapping_quotes(arg);
    if normalized_arg.is_empty() || normalized_arg.starts_with('-') {
        return None;
    }
    if let Ok(url) = url::Url::parse(normalized_arg) {
        if url.scheme().eq_ignore_ascii_case("file") {
            if let Ok(path) = url.to_file_path() {
                return Some(path);
            }
            return None;
        }
        let looks_like_windows_drive = normalized_arg.len() >= 2
            && normalized_arg.as_bytes()[1] == b':'
            && url.scheme().len() == 1;
        if !looks_like_windows_drive {
            return None;
        }
    }
    Some(PathBuf::from(normalized_arg))
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn collect_startup_opened_paths() -> Vec<PathBuf> {
    std::env::args()
        .skip(1)
        .filter_map(|arg| parse_startup_opened_arg(&arg))
        .collect()
}

/// Open a project editor in a separate window
#[tauri::command]
fn open_project_window(app: AppHandle, project_id: String) -> Result<(), AppError> {
    let project_id = normalize_project_id_input(project_id, "open project window")?;
    open_project_editor_window(&app, &project_id)
}

/// Load a project by ID
#[tauri::command]
async fn load_project(
    state: tauri::State<'_, SharedRecorderState>,
    project_id: String,
) -> Result<Project, AppError> {
    let project_id = normalize_project_id_input(project_id, "load project")?;
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    project::load_project(&recordings_dir, &project_id).await
}

/// Save a project
#[tauri::command]
async fn save_project(
    app: AppHandle,
    state: tauri::State<'_, SharedRecorderState>,
    project: Project,
) -> Result<(), AppError> {
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    project::save_project(&recordings_dir, &project).await?;
    refresh_tray_menu(&app, &recordings_dir);
    Ok(())
}

/// List all projects
#[tauri::command]
async fn list_projects(
    state: tauri::State<'_, SharedRecorderState>,
) -> Result<Vec<Project>, AppError> {
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
    let project_id = normalize_project_id_input(project_id, "delete project")?;
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
    let project_id = normalize_project_id_input(project_id, "export project")?;
    let recordings_dir = recordings_dir_from_managed_state(&state)?;
    let project = project::load_project(&recordings_dir, &project_id).await?;

    validate_export_inputs(&project, &options).await?;

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

fn active_export_job_ids(export_jobs: &SharedExportJobs) -> Result<Vec<String>, AppError> {
    let job_entries = {
        let jobs = export_jobs
            .lock()
            .map_err(|e| AppError::Lock(format!("Failed to lock export jobs state: {}", e)))?;
        jobs.iter()
            .map(|(job_id, pid)| (job_id.clone(), *pid))
            .collect::<Vec<_>>()
    };

    let mut active_job_ids = Vec::new();
    let mut stale_job_ids = Vec::new();

    for (job_id, pid) in job_entries {
        match is_process_running(pid) {
            Ok(true) => active_job_ids.push(job_id),
            Ok(false) => stale_job_ids.push(job_id),
            Err(error) => {
                eprintln!(
                    "Failed to verify export process {} for job {}: {}. Keeping job as active.",
                    pid, job_id, error
                );
                active_job_ids.push(job_id);
            }
        }
    }

    if !stale_job_ids.is_empty() {
        let mut jobs = export_jobs
            .lock()
            .map_err(|e| AppError::Lock(format!("Failed to lock export jobs state: {}", e)))?;
        for stale_job_id in stale_job_ids {
            jobs.remove(&stale_job_id);
        }
    }

    active_job_ids.sort();
    Ok(active_job_ids)
}

#[cfg(test)]
fn active_export_job_ids_without_process_check(
    export_jobs: &SharedExportJobs,
) -> Result<Vec<String>, AppError> {
    let jobs = export_jobs
        .lock()
        .map_err(|e| AppError::Lock(format!("Failed to lock export jobs state: {}", e)))?;
    let mut job_ids = jobs.keys().cloned().collect::<Vec<_>>();
    job_ids.sort();
    Ok(job_ids)
}

#[tauri::command]
fn list_active_export_jobs(
    export_jobs: tauri::State<'_, SharedExportJobs>,
) -> Result<Vec<String>, AppError> {
    active_export_job_ids(export_jobs.inner())
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
    use super::{
        active_export_job_ids, active_export_job_ids_without_process_check, build_editor_route,
        clear_pending_finalization, get_pending_finalization, handle_ffmpeg_timeout,
        has_active_recording_session, has_pending_finalization, is_missing_process_error,
        is_process_running, normalize_opened_project_id, normalize_project_id_input,
        parse_ffmpeg_progress, parse_ffprobe_dimensions_output, parse_ffprobe_duration_output,
        project_id_from_opened_path, resolve_project_dir_from_payload, store_pending_finalization,
        AppError, RecorderRecordingState, RecorderState, RecordingOptions,
        SharedPendingFinalizations, SharedRecorderState, SourceType, StopRecordingResult,
        OPENREC_RELEASES_URL, OPENREC_UNSIGNED_INSTALL_GUIDE_URL,
    };
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    use super::{parse_startup_opened_arg, strip_wrapping_quotes};
    use crate::recording::{RecordingCodec, RecordingQualityPreset, RecordingSession};
    use std::collections::HashMap;
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};
    use std::time::Instant;
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
    fn ffmpeg_timeout_handler_invokes_termination_callback() {
        let mut captured_pid = 0_u32;
        let timeout_error = handle_ffmpeg_timeout(42, 12, |pid| {
            captured_pid = pid;
            Ok(())
        });
        let AppError::Message(message) = timeout_error else {
            panic!("ffmpeg timeout helper should return message errors");
        };
        assert_eq!(captured_pid, 42, "timed-out ffmpeg pid should be forwarded");
        assert_eq!(message, "ffmpeg command timed out after 12 seconds");
    }

    #[test]
    fn ffmpeg_timeout_handler_returns_timeout_error_when_termination_fails() {
        let timeout_error = handle_ffmpeg_timeout(77, 9, |_pid| {
            Err(AppError::Message("termination failed".to_string()))
        });
        let AppError::Message(message) = timeout_error else {
            panic!("ffmpeg timeout helper should return message errors");
        };
        assert_eq!(message, "ffmpeg command timed out after 9 seconds");
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
    fn detects_missing_process_error_messages() {
        assert!(is_missing_process_error("kill: (123) - No such process"));
        assert!(is_missing_process_error(
            "ERROR: The process \"123\" not found."
        ));
        assert!(is_missing_process_error(
            "Cannot find the process with PID 123"
        ));
        assert!(!is_missing_process_error("permission denied"));
    }

    #[test]
    fn exposes_manual_update_urls() {
        assert!(OPENREC_RELEASES_URL.starts_with("https://"));
        assert!(OPENREC_RELEASES_URL.contains("/releases"));
        assert!(OPENREC_UNSIGNED_INSTALL_GUIDE_URL.starts_with("https://"));
        assert!(OPENREC_UNSIGNED_INSTALL_GUIDE_URL.contains("UNSIGNED_MAC_INSTALL.md"));
    }

    #[test]
    fn parses_ffprobe_dimensions_output() {
        assert!(matches!(
            parse_ffprobe_dimensions_output("1920x1080"),
            Ok((1920, 1080))
        ));
        assert!(matches!(
            parse_ffprobe_dimensions_output(" 3840x2160 "),
            Ok((3840, 2160))
        ));
        assert!(parse_ffprobe_dimensions_output("0x1080").is_err());
        assert!(parse_ffprobe_dimensions_output("1920x0").is_err());
        assert!(parse_ffprobe_dimensions_output("1920x1080x24").is_err());
        assert!(parse_ffprobe_dimensions_output("invalid").is_err());
    }

    #[test]
    fn parses_ffprobe_duration_output() {
        assert!(
            matches!(parse_ffprobe_duration_output("12.5"), Ok(value) if (value - 12.5).abs() < f64::EPSILON)
        );
        assert!(parse_ffprobe_duration_output("0").is_err());
        assert!(parse_ffprobe_duration_output("-2.0").is_err());
        assert!(parse_ffprobe_duration_output("NaN").is_err());
        assert!(parse_ffprobe_duration_output("N/A").is_err());
        assert!(parse_ffprobe_duration_output("").is_err());
    }

    #[test]
    fn active_export_job_ids_returns_sorted_ids() {
        let export_jobs = Arc::new(Mutex::new(HashMap::from([
            ("job-c".to_string(), 3_u32),
            ("job-a".to_string(), 1_u32),
            ("job-b".to_string(), 2_u32),
        ])));
        let job_ids = active_export_job_ids_without_process_check(&export_jobs)
            .expect("active export ids should resolve");
        assert_eq!(
            job_ids,
            vec![
                "job-a".to_string(),
                "job-b".to_string(),
                "job-c".to_string()
            ]
        );
    }

    #[test]
    fn detects_running_process_by_pid() {
        let current_pid = std::process::id();
        assert!(
            is_process_running(current_pid).expect("process lookup should complete"),
            "current process id should be running"
        );
    }

    #[cfg(unix)]
    #[test]
    fn active_export_job_ids_prunes_stale_process_entries() {
        let mut child = std::process::Command::new("sh")
            .arg("-c")
            .arg("exit 0")
            .spawn()
            .expect("failed to spawn short-lived process for stale job test");
        let stale_pid = child.id();
        child
            .wait()
            .expect("failed to wait for short-lived process exit");

        let export_jobs = Arc::new(Mutex::new(HashMap::from([(
            "stale-job".to_string(),
            stale_pid,
        )])));

        let active_job_ids =
            active_export_job_ids(&export_jobs).expect("active export jobs should resolve");

        assert!(active_job_ids.is_empty(), "stale job should be pruned");
        let remaining_jobs = export_jobs
            .lock()
            .expect("failed to lock jobs after pruning")
            .len();
        assert_eq!(remaining_jobs, 0, "stale job entry should be removed");
    }

    #[cfg(unix)]
    #[test]
    fn active_export_job_ids_keeps_running_jobs_while_pruning_stale_jobs() {
        let mut child = std::process::Command::new("sh")
            .arg("-c")
            .arg("exit 0")
            .spawn()
            .expect("failed to spawn short-lived process for mixed-state job test");
        let stale_pid = child.id();
        child
            .wait()
            .expect("failed to wait for short-lived process exit");

        let running_pid = std::process::id();
        let export_jobs = Arc::new(Mutex::new(HashMap::from([
            ("running-job".to_string(), running_pid),
            ("stale-job".to_string(), stale_pid),
        ])));

        let active_job_ids =
            active_export_job_ids(&export_jobs).expect("active export jobs should resolve");
        assert_eq!(
            active_job_ids,
            vec!["running-job".to_string()],
            "only running jobs should remain active"
        );

        let jobs = export_jobs
            .lock()
            .expect("failed to lock jobs after mixed-state pruning");
        assert_eq!(jobs.len(), 1, "stale jobs should be pruned");
        assert_eq!(jobs.get("running-job"), Some(&running_pid));
    }

    #[test]
    fn has_active_recording_session_detects_recording_or_paused_sessions() {
        let recordings_dir = create_test_dir("active-session-detection");
        let state: SharedRecorderState = Arc::new(Mutex::new(RecorderState::new(recordings_dir)));

        assert!(
            !has_active_recording_session(&state).expect("session query should succeed"),
            "empty recorder state should not report active sessions"
        );

        {
            let mut guard = state
                .lock()
                .expect("failed to lock recorder state for session insertion");
            guard.sessions.insert(
                "active-project".to_string(),
                RecordingSession {
                    project_id: "active-project".to_string(),
                    options: RecordingOptions {
                        source_id: "display-1".to_string(),
                        source_type: SourceType::Display,
                        preferred_display_ordinal: Some(1),
                        capture_camera: false,
                        capture_microphone: false,
                        capture_system_audio: true,
                        quality_preset: RecordingQualityPreset::P1080P30,
                        codec: RecordingCodec::H264,
                    },
                    state: RecorderRecordingState::Paused,
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
                    screen_segments: vec![PathBuf::from("/tmp/screen.mp4")],
                    current_segment_path: PathBuf::from("/tmp/screen.mp4"),
                    active_duration_ms: 0,
                    last_resume_instant: Some(Instant::now()),
                    camera_offset_ms: None,
                    microphone_offset_ms: None,
                },
            );
        }

        assert!(
            has_active_recording_session(&state).expect("session query should succeed"),
            "paused session should report an active recording session"
        );
    }

    #[test]
    fn pending_finalization_state_round_trip() {
        let root = create_test_dir("pending-finalization-state");
        let project_dir = root.join("retry-project");
        std::fs::create_dir_all(&project_dir)
            .expect("failed to create pending finalization fixture directory");
        let screen_path = project_dir.join("screen.mp4");
        let segment_path = project_dir.join("screen_part1.mp4");
        let camera_path = project_dir.join("camera.webm");
        let microphone_path = project_dir.join("microphone.webm");
        std::fs::write(&screen_path, b"screen").expect("failed to write screen fixture");
        std::fs::write(&segment_path, b"segment").expect("failed to write segment fixture");
        std::fs::write(&camera_path, b"camera").expect("failed to write camera fixture");
        std::fs::write(&microphone_path, b"microphone")
            .expect("failed to write microphone fixture");

        let pending_finalizations: SharedPendingFinalizations =
            Arc::new(Mutex::new(HashMap::new()));
        let stop_result = StopRecordingResult {
            project_id: "retry-project".to_string(),
            screen_video_path: screen_path.clone(),
            screen_segment_paths: vec![screen_path, segment_path],
            camera_video_path: Some(camera_path),
            microphone_audio_path: Some(microphone_path),
            duration_seconds: 12.3,
            source_width: 1920,
            source_height: 1080,
            camera_offset_ms: Some(10),
            microphone_offset_ms: Some(20),
        };

        store_pending_finalization(&pending_finalizations, &stop_result)
            .expect("pending finalization should be storable");
        assert!(
            has_pending_finalization(&pending_finalizations, &stop_result.project_id)
                .expect("pending finalization presence query should succeed"),
            "pending finalization presence should be true after insert"
        );
        let stored = get_pending_finalization(&pending_finalizations, &stop_result.project_id)
            .expect("pending finalization should be retrievable");
        assert!(stored.is_some(), "pending finalization should be present");
        let stored = stored.expect("pending finalization should exist");
        assert_eq!(stored.project_id, stop_result.project_id);
        assert_eq!(stored.screen_segment_paths.len(), 2);

        clear_pending_finalization(&pending_finalizations, &stop_result.project_id)
            .expect("pending finalization should clear");
        assert!(
            !has_pending_finalization(&pending_finalizations, &stop_result.project_id)
                .expect("pending finalization presence query should succeed"),
            "pending finalization presence should be false after clear"
        );
        let cleared = get_pending_finalization(&pending_finalizations, &stop_result.project_id)
            .expect("pending finalization query should succeed");
        assert!(cleared.is_none(), "pending finalization should be cleared");

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn pending_finalization_context_is_cleared_when_artifacts_are_missing() {
        let root = create_test_dir("stale-pending-finalization");
        let missing_project_dir = root.join("missing-project");
        let missing_screen_path = missing_project_dir.join("screen.mp4");
        let _ = std::fs::remove_dir_all(&root);

        let pending_finalizations: SharedPendingFinalizations =
            Arc::new(Mutex::new(HashMap::new()));
        let stop_result = StopRecordingResult {
            project_id: "stale-retry-project".to_string(),
            screen_video_path: missing_screen_path.clone(),
            screen_segment_paths: vec![missing_screen_path],
            camera_video_path: None,
            microphone_audio_path: None,
            duration_seconds: 1.0,
            source_width: 1280,
            source_height: 720,
            camera_offset_ms: None,
            microphone_offset_ms: None,
        };

        store_pending_finalization(&pending_finalizations, &stop_result)
            .expect("pending finalization should store");
        let resolved = get_pending_finalization(&pending_finalizations, &stop_result.project_id)
            .expect("pending finalization query should succeed");
        assert!(
            resolved.is_none(),
            "stale pending finalization should be cleared automatically"
        );
        assert!(
            !has_pending_finalization(&pending_finalizations, &stop_result.project_id)
                .expect("pending finalization presence query should succeed"),
            "presence helper should report false after stale context cleanup"
        );
    }

    #[test]
    fn pending_finalization_context_is_cleared_when_segment_artifact_is_missing() {
        let root = create_test_dir("stale-pending-finalization-segment");
        let project_dir = root.join("project");
        std::fs::create_dir_all(&project_dir)
            .expect("failed to create stale segment fixture directory");
        let screen_path = project_dir.join("screen.mp4");
        std::fs::write(&screen_path, b"screen").expect("failed to write existing screen fixture");
        let missing_segment_path = project_dir.join("screen_part1.mp4");

        let pending_finalizations: SharedPendingFinalizations =
            Arc::new(Mutex::new(HashMap::new()));
        let stop_result = StopRecordingResult {
            project_id: "stale-segment-project".to_string(),
            screen_video_path: screen_path,
            screen_segment_paths: vec![missing_segment_path],
            camera_video_path: None,
            microphone_audio_path: None,
            duration_seconds: 1.0,
            source_width: 1280,
            source_height: 720,
            camera_offset_ms: None,
            microphone_offset_ms: None,
        };

        store_pending_finalization(&pending_finalizations, &stop_result)
            .expect("pending finalization should store");
        let resolved = get_pending_finalization(&pending_finalizations, &stop_result.project_id)
            .expect("pending finalization query should succeed");
        assert!(
            resolved.is_none(),
            "stale pending finalization should clear when segment is missing"
        );
        assert!(
            !has_pending_finalization(&pending_finalizations, &stop_result.project_id)
                .expect("pending finalization presence query should succeed"),
            "presence helper should report false after stale segment cleanup"
        );

        let _ = std::fs::remove_dir_all(root);
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
    fn normalizes_project_id_input() {
        assert_eq!(
            normalize_project_id_input("  project-123  ".to_string(), "test context")
                .expect("project id should normalize"),
            "project-123".to_string()
        );
    }

    #[test]
    fn rejects_empty_project_id_input() {
        let error = normalize_project_id_input("   ".to_string(), "test context")
            .expect_err("empty project id should fail");
        assert_eq!(
            error.to_string(),
            "Missing project id for test context".to_string()
        );
    }

    #[test]
    fn builds_percent_encoded_editor_route() {
        assert_eq!(
            build_editor_route("project with spaces/and/slashes"),
            "/editor/project+with+spaces%2Fand%2Fslashes"
        );
    }

    #[test]
    fn resolves_project_dir_from_file_url_payload() {
        let root = create_test_dir("resolve-project-dir-file-url");
        let file_url = url::Url::from_file_path(root.join("url-target"))
            .expect("failed to create file url")
            .to_string();
        let association_path = root.join("association.openrec");

        let resolved = resolve_project_dir_from_payload(&file_url, &association_path)
            .expect("expected payload path to resolve");
        assert_eq!(
            resolved.file_name().and_then(|value| value.to_str()),
            Some("url-target")
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_dir_from_localhost_file_url_payload() {
        let root = create_test_dir("resolve-project-dir-localhost-file-url");
        let file_url = url::Url::from_file_path(root.join("localhost-target"))
            .expect("failed to create file url");
        let localhost_url = format!("file://localhost{}", file_url.path());
        let association_path = root.join("association.openrec");

        let resolved = resolve_project_dir_from_payload(&localhost_url, &association_path)
            .expect("localhost file URL should resolve");
        assert_eq!(
            resolved.file_name().and_then(|value| value.to_str()),
            Some("localhost-target")
        );

        let remote_host_url = format!("file://example.com{}", file_url.path());
        assert_eq!(
            resolve_project_dir_from_payload(&remote_host_url, &association_path),
            None
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_dir_from_percent_encoded_file_url_payload() {
        let root = create_test_dir("resolve-project-dir-encoded-file-url");
        let target_dir = root.join("folder with spaces");
        let file_url = url::Url::from_file_path(&target_dir)
            .expect("failed to create encoded file url")
            .to_string();
        let association_path = root.join("association.openrec");

        let resolved = resolve_project_dir_from_payload(&file_url, &association_path)
            .expect("encoded file URL should resolve");
        assert_eq!(resolved, target_dir);

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_project_dir_payload_with_unsupported_url_scheme() {
        let root = create_test_dir("resolve-project-dir-unsupported-url");
        let association_path = root.join("association.openrec");

        let resolved =
            resolve_project_dir_from_payload("https://example.com/path", &association_path);
        assert_eq!(resolved, None);

        let _ = std::fs::remove_dir_all(root);
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn strips_wrapping_quotes_from_startup_arguments() {
        assert_eq!(
            strip_wrapping_quotes("\"/tmp/sample.openrec\""),
            "/tmp/sample.openrec"
        );
        assert_eq!(
            strip_wrapping_quotes("'/tmp/sample.openrec'"),
            "/tmp/sample.openrec"
        );
        assert_eq!(
            strip_wrapping_quotes("/tmp/sample.openrec"),
            "/tmp/sample.openrec"
        );
        assert_eq!(
            strip_wrapping_quotes("   \"/tmp/spaced.openrec\"   "),
            "/tmp/spaced.openrec"
        );
        assert_eq!(strip_wrapping_quotes("   "), "");
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn parses_startup_opened_arguments() {
        assert_eq!(parse_startup_opened_arg(""), None);
        assert_eq!(parse_startup_opened_arg("--flag"), None);
        assert_eq!(parse_startup_opened_arg("\"--flag\""), None);

        let parsed_path =
            parse_startup_opened_arg("\"/tmp/sample.openrec\"").expect("quoted path should parse");
        assert_eq!(parsed_path, PathBuf::from("/tmp/sample.openrec"));

        let parsed_url = parse_startup_opened_arg("file:///tmp/url-sample.openrec")
            .expect("file url should parse");
        assert_eq!(parsed_url, PathBuf::from("/tmp/url-sample.openrec"));

        assert_eq!(
            parse_startup_opened_arg("https://example.com/file.openrec"),
            None
        );

        let windows_drive_like = parse_startup_opened_arg("C:/tmp/sample.openrec")
            .expect("windows drive-like path should be preserved");
        assert_eq!(windows_drive_like, PathBuf::from("C:/tmp/sample.openrec"));
    }

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    #[test]
    fn parses_percent_encoded_startup_file_urls() {
        let encoded_spaces = parse_startup_opened_arg("file:///tmp/sample%20clip.openrec")
            .expect("percent-encoded spaces should parse");
        assert_eq!(encoded_spaces, PathBuf::from("/tmp/sample clip.openrec"));

        let encoded_unicode = parse_startup_opened_arg("file:///tmp/%E2%9C%93-check.openrec")
            .expect("percent-encoded unicode should parse");
        assert_eq!(encoded_unicode, PathBuf::from("/tmp/✓-check.openrec"));

        let uppercase_file_scheme = parse_startup_opened_arg("FILE:///tmp/Upper.openrec")
            .expect("uppercase file scheme should parse");
        assert_eq!(uppercase_file_scheme, PathBuf::from("/tmp/Upper.openrec"));

        let localhost_file_url = parse_startup_opened_arg("file://localhost/tmp/local.openrec")
            .expect("localhost file URL should parse");
        assert_eq!(localhost_file_url, PathBuf::from("/tmp/local.openrec"));

        assert_eq!(
            parse_startup_opened_arg("file://example.com/tmp/remote.openrec"),
            None
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
    fn resolves_project_id_from_project_directory_with_uppercase_project_file() {
        let root = create_test_dir("path-directory-uppercase-project-file");
        let project_dir = root.join("project-uppercase");
        std::fs::create_dir_all(&project_dir).expect("failed to create project directory");
        std::fs::write(project_dir.join("PROJECT.JSON"), "{}")
            .expect("failed to write uppercase project file");

        let resolved = project_id_from_opened_path(&project_dir);
        assert_eq!(resolved.as_deref(), Some("project-uppercase"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_uppercase_project_json_path() {
        let root = create_test_dir("path-uppercase-project-json");
        let project_dir = root.join("project-uppercase-file");
        std::fs::create_dir_all(&project_dir).expect("failed to create project directory");
        let project_json_path = project_dir.join("PROJECT.JSON");
        std::fs::write(&project_json_path, "{}").expect("failed to write project file");

        let resolved = project_id_from_opened_path(&project_json_path);
        assert_eq!(resolved.as_deref(), Some("project-uppercase-file"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn ignores_missing_project_json_path() {
        let root = create_test_dir("path-missing-project-json");
        let missing_project_file = root.join("missing-project").join("project.json");

        let resolved = project_id_from_opened_path(&missing_project_file);
        assert_eq!(resolved, None);

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
    fn resolves_project_id_from_openrec_project_dir_snake_case_field() {
        let root = create_test_dir("openrec-project-dir-snake-case");
        let project_dir = root.join("snake-case-fallback-project");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        let association_path = root.join("snake-case-fallback-association.openrec");
        let payload = serde_json::json!({
            "project_dir": project_dir.to_string_lossy().to_string()
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("snake-case-fallback-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_file_url_project_dir() {
        let root = create_test_dir("openrec-file-url-project-dir");
        let project_dir = root.join("file-url-project");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        let project_dir_url = url::Url::from_file_path(&project_dir)
            .expect("failed to build file url")
            .to_string();
        let association_path = root.join("file-url-association.openrec");
        let payload = serde_json::json!({
            "projectDir": project_dir_url
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("file-url-project"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_project_id_from_openrec_project_path_field() {
        let root = create_test_dir("openrec-project-path-field");
        let project_dir = root.join("project-path-fallback");
        std::fs::create_dir_all(&project_dir).expect("failed to create fallback project directory");
        let association_path = root.join("project-path-association.openrec");
        let payload = serde_json::json!({
            "projectPath": project_dir.to_string_lossy().to_string()
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("project-path-fallback"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn falls_back_to_association_stem_for_unsupported_project_dir_url_scheme() {
        let root = create_test_dir("openrec-unsupported-url-scheme");
        let association_path = root.join("unsupported-url-fallback.openrec");
        let payload = serde_json::json!({
            "projectDir": "https://example.com/projects/ignored-project"
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("unsupported-url-fallback"));

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
    fn falls_back_to_stem_when_openrec_project_dir_path_is_missing() {
        let root = create_test_dir("openrec-missing-project-dir-payload");
        let association_path = root.join("missing-dir-association.openrec");
        let missing_project_dir = root.join("does-not-exist-project");
        let payload = serde_json::json!({
            "projectDir": missing_project_dir.to_string_lossy().to_string()
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("missing-dir-association"));

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn falls_back_to_stem_when_openrec_project_json_path_is_missing() {
        let root = create_test_dir("openrec-missing-project-json-payload");
        let association_path = root.join("missing-json-association.openrec");
        let missing_project_json_path = root.join("missing-json-project").join("project.json");
        let payload = serde_json::json!({
            "projectDir": missing_project_json_path.to_string_lossy().to_string()
        });
        std::fs::write(&association_path, payload.to_string())
            .expect("failed to write association payload");

        let resolved = project_id_from_opened_path(&association_path);
        assert_eq!(resolved.as_deref(), Some("missing-json-association"));

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
    fn ignores_project_directory_when_project_json_name_is_directory() {
        let root = create_test_dir("openrec-project-json-directory-name");
        let project_dir = root.join("project-json-directory-name");
        std::fs::create_dir_all(project_dir.join("PROJECT.JSON"))
            .expect("failed to create directory named project.json");

        let resolved = project_id_from_opened_path(&project_dir);
        assert_eq!(resolved, None);

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn ignores_project_directory_when_lowercase_project_json_is_directory() {
        let root = create_test_dir("openrec-project-json-directory-name-lower");
        let project_dir = root.join("project-json-directory-name-lower");
        std::fs::create_dir_all(project_dir.join("project.json"))
            .expect("failed to create lowercase directory named project.json");

        let resolved = project_id_from_opened_path(&project_dir);
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
            let recorder_state = Arc::new(Mutex::new(RecorderState::new(app_data_dir.clone())));
            app.manage(recorder_state);
            let export_jobs: SharedExportJobs = Arc::new(Mutex::new(HashMap::new()));
            app.manage(export_jobs);
            let pending_finalizations: SharedPendingFinalizations =
                Arc::new(Mutex::new(HashMap::new()));
            app.manage(pending_finalizations);

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
                    APP_MENU_CHECK_UPDATES => {
                        if let Err(error) = open_external_url(OPENREC_RELEASES_URL) {
                            eprintln!("Failed to open releases URL: {}", error);
                        }
                    }
                    APP_MENU_UNSIGNED_INSTALL_GUIDE => {
                        if let Err(error) = open_external_url(OPENREC_UNSIGNED_INSTALL_GUIDE_URL) {
                            eprintln!("Failed to open unsigned install guide URL: {}", error);
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
            retry_recording_finalization,
            has_pending_recording_finalization,
            set_recording_media_offsets,
            get_recording_state,
            get_recording_snapshot,
            get_recording_source_status,
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
            list_active_export_jobs,
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
                    if let Some(pending_finalizations) =
                        app_handle.try_state::<SharedPendingFinalizations>()
                    {
                        match pending_finalizations.lock() {
                            Ok(mut guard) => guard.clear(),
                            Err(error) => {
                                eprintln!(
                                    "Failed to cleanup pending finalizations on exit: {}",
                                    error
                                );
                            }
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
