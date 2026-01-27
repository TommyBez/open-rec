import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Film,
  Download,
  Undo2,
  Trash2,
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
import { cn } from "@/lib/utils";

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const {
    project,
    setProject,
    isDirty,
    saveProject,
    canUndo,
    undo,
    cutAt,
    deleteSegment,
    addZoom,
    deleteZoom,
    addSpeed,
  } = useProject(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState<"cut" | "zoom" | "speed">("cut");
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
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

  // Get enabled segments sorted by start time, with clamped times and display positions
  const { enabledSegments, editedDuration, sourceToEditedTime } = useMemo(() => {
    if (!project) return { enabledSegments: [], editedDuration: 0, sourceToEditedTime: () => 0 };
    
    const sorted = project.edits.segments
      .filter((s) => s.enabled)
      .sort((a, b) => a.startTime - b.startTime);
    
    // Calculate edited duration and time mapping (clamp to video duration)
    let editedOffset = 0;
    const segmentInfo: Array<{ seg: typeof sorted[0]; clampedStart: number; clampedEnd: number; editedStart: number }> = [];
    
    for (const seg of sorted) {
      const clampedStart = Math.max(0, Math.min(seg.startTime, duration));
      const clampedEnd = Math.max(0, Math.min(seg.endTime, duration));
      const segDuration = Math.max(0, clampedEnd - clampedStart);
      
      if (segDuration > 0) {
        segmentInfo.push({
          seg,
          clampedStart,
          clampedEnd,
          editedStart: editedOffset,
        });
        editedOffset += segDuration;
      }
    }
    
    // Function to convert source video time to edited timeline time
    const sourceToEdited = (sourceTime: number): number => {
      for (const info of segmentInfo) {
        if (sourceTime >= info.clampedStart && sourceTime <= info.clampedEnd) {
          return info.editedStart + (sourceTime - info.clampedStart);
        }
      }
      // If after all segments, return total edited duration
      return editedOffset;
    };
    
    return {
      enabledSegments: sorted,
      editedDuration: editedOffset || duration,
      sourceToEditedTime: sourceToEdited,
    };
  }, [project, duration]);

  // Check if a time is within any enabled segment
  const isTimeInSegment = useCallback((time: number) => {
    return enabledSegments.some(
      (seg) => time >= seg.startTime && time < seg.endTime
    );
  }, [enabledSegments]);

  // Find the next segment start time after a given time
  const findNextSegmentStart = useCallback((time: number) => {
    for (const seg of enabledSegments) {
      if (seg.startTime > time) {
        return seg.startTime;
      }
    }
    return null; // No more segments
  }, [enabledSegments]);

  // Video time update handler
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      const actualDuration = video.duration;
      setDuration(actualDuration);
      
      // Sync project duration and clamp segments if actual video duration differs
      if (project && Math.abs(project.duration - actualDuration) > 0.1) {
        // Update project with correct duration and clamp segment times
        setProject({
          ...project,
          duration: actualDuration,
          edits: {
            ...project.edits,
            segments: project.edits.segments.map(seg => ({
              ...seg,
              startTime: Math.max(0, Math.min(seg.startTime, actualDuration)),
              endTime: Math.max(0, Math.min(seg.endTime, actualDuration)),
            })).filter(seg => seg.endTime > seg.startTime), // Remove zero-duration segments
          },
        });
      }
    };
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

  // Segment-aware playback: skip gaps between segments
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying || enabledSegments.length === 0) return;

    const checkAndSkip = () => {
      const time = video.currentTime;
      
      // Check if we're in a gap (not within any enabled segment)
      if (!isTimeInSegment(time)) {
        const nextStart = findNextSegmentStart(time);
        if (nextStart !== null) {
          // Skip to the next segment
          video.currentTime = nextStart;
        } else {
          // No more segments, stop playback
          video.pause();
          setIsPlaying(false);
        }
      }
    };

    // Check frequently during playback
    const interval = setInterval(checkAndSkip, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, enabledSegments, isTimeInSegment, findNextSegmentStart]);

  // Auto-save when project changes
  useEffect(() => {
    if (isDirty && project) {
      const timeout = setTimeout(() => {
        saveProject().catch(console.error);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isDirty, project, saveProject]);

  // Keyboard shortcut for undo (⌘Z / Ctrl+Z)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) {
          undo();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, undo]);

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
      // If starting playback from a gap, jump to the next segment first
      if (!isTimeInSegment(video.currentTime)) {
        const nextStart = findNextSegmentStart(video.currentTime);
        if (nextStart !== null) {
          video.currentTime = nextStart;
        } else if (enabledSegments.length > 0) {
          // No segments ahead, go to start of first segment
          video.currentTime = enabledSegments[0].startTime;
        }
      }
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

  function handleDeleteSelectedSegment() {
    if (selectedSegmentId && project && project.edits.segments.length > 1) {
      deleteSegment(selectedSegmentId);
      setSelectedSegmentId(null);
    }
  }

  // Check if we can delete the selected segment
  const canDeleteSegment = selectedSegmentId !== null && project && project.edits.segments.length > 1;

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }

  // Loading state with studio aesthetic
  if (isLoading || !project) {
    return (
      <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background text-foreground">
      {/* Atmospheric background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/50 bg-card/30 px-4 py-3 backdrop-blur-sm animate-fade-up">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/recorder")}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Back to recorder</TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
              <Film className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium text-foreground/80">{project.name}</span>
            {isDirty && (
              <span className="text-xl leading-none text-accent">•</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setShowExportModal(true)}
            className="gap-2 bg-primary font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
          >
            <Download className="size-4" strokeWidth={1.75} />
            Export
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* Video Preview */}
        <div className="flex flex-1 flex-col gap-4 p-4 animate-fade-up-delay-1">
          <div className="studio-panel flex flex-1 items-center justify-center overflow-hidden rounded-xl">
            {videoSrc ? (
              <video
                ref={videoRef}
                src={videoSrc}
                className="max-h-full max-w-full rounded-lg"
              />
            ) : (
              <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-card/50">
                  <Film className="size-7 text-muted-foreground/50" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <span className="text-sm">Video Preview</span>
                  <p className="mt-1 text-xs text-muted-foreground/60">
                    {project.resolution.width}×{project.resolution.height}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Playback Controls */}
          <div className="studio-panel flex items-center justify-between rounded-xl px-4 py-3 animate-fade-up-delay-2">
            {/* Timecode + Undo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="min-w-[140px] font-mono text-sm text-muted-foreground">
                  {formatTime(sourceToEditedTime(currentTime))}
                </span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-mono text-sm text-muted-foreground/60">
                  {formatTime(editedDuration)}
                </span>
              </div>
              {/* Undo button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={undo}
                    disabled={!canUndo}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg transition-colors",
                      canUndo 
                        ? "text-muted-foreground hover:bg-muted hover:text-foreground" 
                        : "text-muted-foreground/30 cursor-not-allowed"
                    )}
                  >
                    <Undo2 className="size-4" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Undo (⌘Z)</TooltipContent>
              </Tooltip>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={skipBackward}
                    className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <SkipBack className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Skip back 5s</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={togglePlay}
                    className={cn(
                      "flex size-12 items-center justify-center rounded-xl transition-all",
                      isPlaying 
                        ? "bg-primary/15 text-primary" 
                        : "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
                    )}
                  >
                    {isPlaying ? (
                      <Pause className="size-5" strokeWidth={1.75} />
                    ) : (
                      <Play className="size-5 ml-0.5" strokeWidth={1.75} />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    onClick={skipForward}
                    className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <SkipForward className="size-5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Skip forward 5s</TooltipContent>
              </Tooltip>
            </div>

            {/* Tool Buttons */}
            <div className="flex items-center gap-1">
              <ToolButton
                active={selectedTool === "cut"}
                onClick={() => setSelectedTool("cut")}
                icon={<Scissors className="size-4" strokeWidth={1.75} />}
                tooltip="Cut tool (click on timeline)"
              />
              <ToolButton
                active={false}
                onClick={handleAddZoom}
                icon={<ZoomIn className="size-4" strokeWidth={1.75} />}
                tooltip="Add zoom effect"
              />
              <ToolButton
                active={false}
                onClick={handleAddSpeed}
                icon={<Gauge className="size-4" strokeWidth={1.75} />}
                tooltip="Add speed effect"
              />
              
              {/* Separator */}
              <div className="mx-1 h-5 w-px bg-border/50" />
              
              {/* Delete selected segment */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDeleteSelectedSegment}
                    disabled={!canDeleteSegment}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg transition-all",
                      canDeleteSegment
                        ? "text-destructive hover:bg-destructive/10"
                        : "text-muted-foreground/30 cursor-not-allowed"
                    )}
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {canDeleteSegment ? "Delete selected segment" : "Select a segment to delete"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative z-10 animate-fade-up-delay-3">
        <Timeline
          duration={duration}
          currentTime={currentTime}
          segments={project.edits.segments}
          zoom={project.edits.zoom}
          speed={project.edits.speed}
          onSeek={handleTimelineClick}
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={setSelectedSegmentId}
          onDeleteZoom={deleteZoom}
        />
      </div>

      {/* Export Modal */}
      {project && (
        <ExportModal
          project={project}
          editedDuration={editedDuration}
          open={showExportModal}
          onOpenChange={setShowExportModal}
          onSaveProject={saveProject}
        />
      )}
    </div>
  );
}

/* ============================================
   Sub-components for the Studio Aesthetic
   ============================================ */

function ToolButton({
  active,
  onClick,
  icon,
  tooltip,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex size-9 items-center justify-center rounded-lg transition-all",
            active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

// Re-export types for backwards compatibility
export type { Project, Segment, ZoomEffect, SpeedEffect } from "../../types/project";
