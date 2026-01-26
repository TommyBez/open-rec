import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import {
  ArrowLeft,
  SkipBack,
  SkipForward,
  Play,
  Pause,
  Scissors,
  ZoomIn,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Timeline } from "../../components/Timeline";
import { ExportModal } from "../../components/ExportModal";
import { useProject } from "../../hooks/useProject";
import { Project } from "../../types/project";

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
      <div className="flex h-full items-center justify-center bg-[#1a1a1a] text-white">
        <span>Loading project...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#1a1a1a] text-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#333] bg-[#252525] px-4 py-3">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/recorder")}
              >
                <ArrowLeft className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back to recorder</TooltipContent>
          </Tooltip>
          <span className="text-sm text-[#999]">{project.name}</span>
          {isDirty && <span className="text-xl leading-none text-amber-500">•</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowExportModal(true)}>
            Export
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex min-h-0 flex-1">
        {/* Video Preview */}
        <div className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                className="max-h-full max-w-full"
              />
            ) : (
              <div className="flex min-h-[300px] w-full flex-col items-center justify-center bg-gradient-to-br from-[#1a1a1a] to-[#2a2a2a] text-[#666]">
                <span className="text-base">Video Preview</span>
                <span className="mt-2 text-xs text-[#555]">
                  {project.resolution.width}×{project.resolution.height}
                </span>
              </div>
            )}
          </div>
          
          {/* Playback Controls */}
          <div className="flex items-center justify-between rounded-lg bg-[#252525] p-2">
            <span className="min-w-[140px] font-mono text-[13px] text-[#999]">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={skipBackward}>
                    <SkipBack className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Skip back 5s</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="secondary" size="icon" onClick={togglePlay}>
                    {isPlaying ? (
                      <Pause className="size-5" />
                    ) : (
                      <Play className="size-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={skipForward}>
                    <SkipForward className="size-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Skip forward 5s</TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedTool === "cut" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setSelectedTool("cut")}
                  >
                    <Scissors className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Cut tool (click on timeline to cut)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleAddZoom}>
                    <ZoomIn className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add zoom effect at current time</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleAddSpeed}>
                    <Gauge className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add speed effect at current time</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
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
      {project && (
        <ExportModal
          project={project}
          open={showExportModal}
          onOpenChange={setShowExportModal}
        />
      )}
    </div>
  );
}

// Re-export types for backwards compatibility
export type { Project, Segment, ZoomEffect, SpeedEffect } from "../../types/project";
