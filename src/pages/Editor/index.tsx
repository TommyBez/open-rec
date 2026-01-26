import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Button } from "../../components/Button";
import { Timeline } from "../../components/Timeline";
import { ExportModal } from "../../components/ExportModal";
import { useProject } from "../../hooks/useProject";
import { Project } from "../../types/project";
import "./styles.css";

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    project,
    setProject,
    isDirty,
    saveProject,
    cutAt,
    toggleSegment,
    addZoom,
    deleteZoom,
    addSpeed,
    setGlobalSpeed,
  } = useProject(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<"cut" | "zoom" | "speed">("cut");
  const [isLoading, setIsLoading] = useState(true);

  // Convert filesystem path to asset URL for video playback
  const videoSrc = useMemo(() => {
    if (!project?.screenVideoPath) return "";
    return convertFileSrc(project.screenVideoPath);
  }, [project?.screenVideoPath]);

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  // Video time update handler
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, [project]);

  // Auto-save when project changes
  useEffect(() => {
    if (isDirty && project) {
      const timeout = setTimeout(() => {
        saveProject().catch(console.error);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isDirty, project, saveProject]);

  async function loadProject(id: string) {
    setIsLoading(true);
    try {
      const result = await invoke<Project>("load_project", { projectId: id });
      setProject(result);
      setDuration(result.duration);
    } catch (error) {
      console.error("Failed to load project:", error);
      // Use mock data for development
      const mockProject: Project = {
        id: id,
        name: `Recording ${id.slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        screenVideoPath: "",
        duration: 274.8,
        resolution: { width: 1920, height: 1080 },
        edits: {
          segments: [{ id: crypto.randomUUID(), startTime: 0, endTime: 274.8, enabled: true }],
          zoom: [],
          speed: [],
        },
      };
      setProject(mockProject);
      setDuration(mockProject.duration);
    } finally {
      setIsLoading(false);
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  }

  function seek(time: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }

  function skipBackward() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 5);
  }

  function skipForward() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(duration, video.currentTime + 5);
  }

  function handleTimelineClick(time: number) {
    if (selectedTool === "cut" && project) {
      cutAt(time);
    } else {
      seek(time);
    }
  }

  function handleAddZoom() {
    if (!project) return;
    const start = currentTime;
    const end = Math.min(currentTime + 5, duration);
    addZoom(start, end, 1.5);
  }

  function handleAddSpeed() {
    if (!project) return;
    const start = currentTime;
    const end = Math.min(currentTime + 5, duration);
    addSpeed(start, end, 2.0);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }

  if (isLoading || !project) {
    return (
      <div className="editor-loading">
        <span>Loading project...</span>
      </div>
    );
  }

  return (
    <div className="editor-page">
      {/* Header */}
      <header className="editor-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate("/recorder")}>
            ←
          </button>
          <span className="project-name">{project.name}</span>
          {isDirty && <span className="unsaved-indicator">•</span>}
        </div>
        <div className="header-center">
          <select className="aspect-ratio-select">
            <option value="auto">Auto</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
            <option value="4:3">4:3</option>
          </select>
          <button className="crop-btn">Crop</button>
        </div>
        <div className="header-right">
          <button className="presets-btn">Presets</button>
          <Button variant="primary" onClick={() => setShowExportModal(true)}>
            Export
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="editor-main">
        {/* Video Preview */}
        <div className="preview-section">
          <div className="video-container">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                className="preview-video"
              />
            ) : (
              <div className="video-placeholder">
                <span>Video Preview</span>
                <span className="placeholder-info">
                  {project.resolution.width}×{project.resolution.height}
                </span>
              </div>
            )}
          </div>
          
          {/* Playback Controls */}
          <div className="playback-controls">
            <span className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <div className="playback-buttons">
              <button className="control-btn" onClick={skipBackward}>⏮</button>
              <button className="control-btn play-btn" onClick={togglePlay}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button className="control-btn" onClick={skipForward}>⏭</button>
            </div>
            <div className="edit-buttons">
              <button 
                className={`control-btn ${selectedTool === "cut" ? "active" : ""}`}
                onClick={() => setSelectedTool("cut")}
                title="Cut tool (click on timeline to cut)"
              >
                ✂
              </button>
              <button 
                className="control-btn"
                onClick={handleAddZoom}
                title="Add zoom effect at current time"
              >
                🔍
              </button>
              <button 
                className="control-btn"
                onClick={handleAddSpeed}
                title="Add speed effect at current time"
              >
                ⚡
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="editor-sidebar">
          <div className="sidebar-tabs">
            <button className="sidebar-tab active">🖼</button>
            <button className="sidebar-tab">📹</button>
            <button className="sidebar-tab">🔊</button>
            <button className="sidebar-tab">✨</button>
          </div>
          
          <div className="sidebar-content">
            <div className="sidebar-section">
              <h3>Background Image</h3>
              <div className="bg-type-options">
                <button className="bg-option active">Wallpaper</button>
                <button className="bg-option">Image</button>
                <button className="bg-option">Color</button>
                <button className="bg-option">Gradient</button>
              </div>
              <div className="bg-presets">
                <button className="preset-tag active">macOS</button>
                <button className="preset-tag">Dark</button>
                <button className="preset-tag">Blue</button>
                <button className="preset-tag">Purple</button>
                <button className="preset-tag">Orange</button>
              </div>
              <div className="bg-thumbnails">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="bg-thumbnail" />
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <h3>Background Blur</h3>
              <input type="range" className="slider" min="0" max="100" defaultValue="0" />
            </div>

            <div className="sidebar-section">
              <h3>Padding</h3>
              <input type="range" className="slider" min="0" max="100" defaultValue="0" />
            </div>

            <div className="sidebar-section">
              <h3>Rounded Corners</h3>
              <input type="range" className="slider" min="0" max="50" defaultValue="0" />
            </div>

            <div className="sidebar-section">
              <h3>Playback Speed</h3>
              <div className="speed-options">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                  <button
                    key={speed}
                    className="speed-btn"
                    onClick={() => setGlobalSpeed(speed)}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Timeline */}
      <Timeline
        duration={duration}
        currentTime={currentTime}
        segments={project.edits.segments}
        zoom={project.edits.zoom}
        speed={project.edits.speed}
        onSeek={handleTimelineClick}
        selectedTool={selectedTool}
        onToolChange={setSelectedTool}
        onToggleSegment={toggleSegment}
        onDeleteZoom={deleteZoom}
      />

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          project={project}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}

// Re-export types for backwards compatibility
export type { Project, Segment, ZoomEffect, SpeedEffect } from "../../types/project";
