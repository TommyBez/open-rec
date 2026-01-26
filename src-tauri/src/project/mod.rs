use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Project metadata and edit decision list
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub screen_video_path: String,
    pub camera_video_path: Option<String>,
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

impl Project {
    /// Create a new project from recording paths
    pub fn new(
        id: String,
        screen_video_path: PathBuf,
        camera_video_path: Option<PathBuf>,
        duration: f64,
        width: u32,
        height: u32,
    ) -> Self {
        let segment_id = uuid::Uuid::new_v4().to_string();
        Self {
            id: id.clone(),
            name: format!("Recording {}", &id[..8]),
            created_at: Utc::now(),
            screen_video_path: screen_video_path.to_string_lossy().to_string(),
            camera_video_path: camera_video_path.map(|p| p.to_string_lossy().to_string()),
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
            },
        }
    }

    /// Load a project from its JSON file
    pub fn load(project_dir: &PathBuf) -> Result<Self, String> {
        let project_file = project_dir.join("project.json");
        let content = std::fs::read_to_string(&project_file)
            .map_err(|e| format!("Failed to read project file: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse project file: {}", e))
    }

    /// Save the project to its JSON file
    pub fn save(&self, project_dir: &PathBuf) -> Result<(), String> {
        let project_file = project_dir.join("project.json");
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize project: {}", e))?;
        std::fs::write(&project_file, content)
            .map_err(|e| format!("Failed to write project file: {}", e))
    }
}

/// Load project by ID
pub fn load_project(recordings_dir: &PathBuf, project_id: &str) -> Result<Project, String> {
    let project_dir = recordings_dir.join(project_id);
    if !project_dir.exists() {
        return Err("Project not found".to_string());
    }
    Project::load(&project_dir)
}

/// Save project
pub fn save_project(recordings_dir: &PathBuf, project: &Project) -> Result<(), String> {
    let project_dir = recordings_dir.join(&project.id);
    std::fs::create_dir_all(&project_dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;
    project.save(&project_dir)
}

/// List all projects
pub fn list_projects(recordings_dir: &PathBuf) -> Result<Vec<Project>, String> {
    let mut projects = Vec::new();
    
    if !recordings_dir.exists() {
        return Ok(projects);
    }
    
    let entries = std::fs::read_dir(recordings_dir)
        .map_err(|e| format!("Failed to read recordings directory: {}", e))?;
    
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Ok(project) = Project::load(&path) {
                projects.push(project);
            }
        }
    }
    
    // Sort by creation date, newest first
    projects.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    
    Ok(projects)
}
