use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::error::AppError;
const PROJECT_ASSOCIATION_EXTENSION: &str = "openrec";

/// Project metadata and edit decision list
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub screen_video_path: String,
    pub camera_video_path: Option<String>,
    pub microphone_audio_path: Option<String>,
    pub camera_offset_ms: Option<i64>,
    pub microphone_offset_ms: Option<i64>,
    pub duration: f64,
    pub resolution: Resolution,
    pub edits: EditDecisionList,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resolution {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct EditDecisionList {
    pub segments: Vec<Segment>,
    pub zoom: Vec<ZoomEffect>,
    pub speed: Vec<SpeedEffect>,
    #[serde(default)]
    pub annotations: Vec<Annotation>,
    #[serde(default)]
    pub camera_overlay: CameraOverlaySettings,
    #[serde(default)]
    pub audio_mix: AudioMixSettings,
    #[serde(default)]
    pub color_correction: ColorCorrectionSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CameraOverlaySettings {
    pub position: CameraOverlayPosition,
    pub margin: u32,
    pub scale: f64,
    #[serde(default = "default_camera_overlay_custom_x")]
    pub custom_x: f64,
    #[serde(default = "default_camera_overlay_custom_y")]
    pub custom_y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMixSettings {
    #[serde(default = "default_system_volume")]
    pub system_volume: f64,
    #[serde(default = "default_microphone_volume")]
    pub microphone_volume: f64,
    #[serde(default = "default_microphone_noise_gate")]
    pub microphone_noise_gate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColorCorrectionSettings {
    #[serde(default = "default_brightness")]
    pub brightness: f64,
    #[serde(default = "default_contrast")]
    pub contrast: f64,
    #[serde(default = "default_saturation")]
    pub saturation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CameraOverlayPosition {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Custom,
}

fn default_camera_overlay_custom_x() -> f64 {
    1.0
}

fn default_camera_overlay_custom_y() -> f64 {
    1.0
}

fn default_system_volume() -> f64 {
    1.0
}

fn default_microphone_volume() -> f64 {
    1.0
}

fn default_microphone_noise_gate() -> bool {
    false
}

fn default_brightness() -> f64 {
    0.0
}

fn default_contrast() -> f64 {
    1.0
}

fn default_saturation() -> f64 {
    1.0
}

impl Default for CameraOverlaySettings {
    fn default() -> Self {
        Self {
            position: CameraOverlayPosition::BottomRight,
            margin: 20,
            scale: 0.25,
            custom_x: default_camera_overlay_custom_x(),
            custom_y: default_camera_overlay_custom_y(),
        }
    }
}

impl Default for AudioMixSettings {
    fn default() -> Self {
        Self {
            system_volume: default_system_volume(),
            microphone_volume: default_microphone_volume(),
            microphone_noise_gate: default_microphone_noise_gate(),
        }
    }
}

impl Default for ColorCorrectionSettings {
    fn default() -> Self {
        Self {
            brightness: default_brightness(),
            contrast: default_contrast(),
            saturation: default_saturation(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoomEffect {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub scale: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedEffect {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub speed: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Annotation {
    pub id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub color: String,
    pub opacity: f64,
    pub thickness: u32,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub mode: AnnotationMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AnnotationMode {
    Outline,
    Blur,
    Text,
    Arrow,
}

impl Default for AnnotationMode {
    fn default() -> Self {
        Self::Outline
    }
}

impl Project {
    /// Create a new project from recording paths
    pub fn new(
        id: String,
        screen_video_path: PathBuf,
        camera_video_path: Option<PathBuf>,
        microphone_audio_path: Option<PathBuf>,
        duration: f64,
        width: u32,
        height: u32,
        camera_offset_ms: Option<i64>,
        microphone_offset_ms: Option<i64>,
    ) -> Self {
        let segment_id = uuid::Uuid::new_v4().to_string();
        Self {
            id: id.clone(),
            name: format!("Recording {}", &id[..8]),
            created_at: Utc::now(),
            screen_video_path: screen_video_path.to_string_lossy().to_string(),
            camera_video_path: camera_video_path.map(|p| p.to_string_lossy().to_string()),
            microphone_audio_path: microphone_audio_path.map(|p| p.to_string_lossy().to_string()),
            camera_offset_ms,
            microphone_offset_ms,
            duration,
            resolution: Resolution { width, height },
            edits: EditDecisionList {
                segments: vec![Segment {
                    id: segment_id,
                    start_time: 0.0,
                    end_time: duration,
                    enabled: true,
                }],
                zoom: vec![],
                speed: vec![],
                annotations: vec![],
                camera_overlay: CameraOverlaySettings::default(),
                audio_mix: AudioMixSettings::default(),
                color_correction: ColorCorrectionSettings::default(),
            },
        }
    }

    /// Load a project from its JSON file
    pub async fn load(project_dir: &PathBuf) -> Result<Self, AppError> {
        let project_file = project_dir.join("project.json");
        let content = tokio::fs::read_to_string(&project_file)
            .await
            .map_err(|e| AppError::Io(format!("Failed to read project file: {}", e)))?;
        serde_json::from_str(&content)
            .map_err(|e| AppError::Message(format!("Failed to parse project file: {}", e)))
    }

    /// Save the project to its JSON file
    pub async fn save(&self, project_dir: &PathBuf) -> Result<(), AppError> {
        let project_file = project_dir.join("project.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| AppError::Message(format!("Failed to serialize project: {}", e)))?;
        tokio::fs::write(&project_file, content)
            .await
            .map_err(|e| AppError::Io(format!("Failed to write project file: {}", e)))
    }
}

/// Load project by ID
pub async fn load_project(recordings_dir: &PathBuf, project_id: &str) -> Result<Project, AppError> {
    let project_dir = recordings_dir.join(project_id);
    if tokio::fs::metadata(&project_dir).await.is_err() {
        return Err(AppError::Message("Project not found".to_string()));
    }
    Project::load(&project_dir).await
}

/// Save project
pub async fn save_project(recordings_dir: &PathBuf, project: &Project) -> Result<(), AppError> {
    let project_dir = recordings_dir.join(&project.id);
    tokio::fs::create_dir_all(&project_dir)
        .await
        .map_err(|e| AppError::Io(format!("Failed to create project directory: {}", e)))?;
    project.save(&project_dir).await?;

    let association_path =
        recordings_dir.join(format!("{}.{}", &project.id, PROJECT_ASSOCIATION_EXTENSION));
    let association_payload = serde_json::json!({
        "projectId": project.id,
        "projectDir": project_dir.to_string_lossy().to_string()
    });
    let association_content = serde_json::to_string_pretty(&association_payload).map_err(|e| {
        AppError::Message(format!("Failed to serialize project association: {}", e))
    })?;
    tokio::fs::write(&association_path, association_content)
        .await
        .map_err(|e| AppError::Io(format!("Failed to write project association file: {}", e)))
}

/// List all projects
pub async fn list_projects(recordings_dir: &PathBuf) -> Result<Vec<Project>, AppError> {
    let mut projects = Vec::new();

    if tokio::fs::metadata(recordings_dir).await.is_err() {
        return Ok(projects);
    }

    let mut entries = tokio::fs::read_dir(recordings_dir)
        .await
        .map_err(|e| AppError::Io(format!("Failed to read recordings directory: {}", e)))?;

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| AppError::Io(format!("Failed to read recordings directory entry: {}", e)))?
    {
        let path = entry.path();
        let entry_is_directory = match entry.file_type().await {
            Ok(kind) => kind.is_dir(),
            Err(error) => {
                eprintln!(
                    "Failed to resolve recordings entry type for {}: {}",
                    path.display(),
                    error
                );
                false
            }
        };
        if entry_is_directory {
            match Project::load(&path).await {
                Ok(project) => projects.push(project),
                Err(error) => {
                    eprintln!(
                        "Failed to load project from {} while listing: {}",
                        path.display(),
                        error
                    );
                }
            }
        }
    }

    // Sort by creation date, newest first
    projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(projects)
}

/// Delete project by ID (directory + files)
pub async fn delete_project(recordings_dir: &PathBuf, project_id: &str) -> Result<(), AppError> {
    let project_dir = recordings_dir.join(project_id);
    if tokio::fs::metadata(&project_dir).await.is_ok() {
        tokio::fs::remove_dir_all(&project_dir)
            .await
            .map_err(|e| AppError::Io(format!("Failed to delete project directory: {}", e)))?;
    }

    let association_path =
        recordings_dir.join(format!("{}.{}", project_id, PROJECT_ASSOCIATION_EXTENSION));
    match tokio::fs::remove_file(&association_path).await {
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => {
            return Err(AppError::Io(format!(
                "Failed to delete project association file: {}",
                error
            )));
        }
    }

    Ok(())
}
