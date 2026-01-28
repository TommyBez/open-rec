import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { ArrowLeft, Film, Clock, Calendar, Video, FolderOpen } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Project } from "../../types/project";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ProjectCard({
  project,
  onSelect,
  index,
}: {
  project: Project;
  onSelect: (project: Project) => void;
  index: number;
}) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const thumbnailSrc = project.screenVideoPath
    ? convertFileSrc(project.screenVideoPath)
    : "";

  return (
    <button
      onClick={() => onSelect(project)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm",
        "transition-all duration-200 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "animate-fade-up"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
        {thumbnailSrc && !thumbnailError ? (
          <video
            src={thumbnailSrc}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setThumbnailError(true)}
            preload="metadata"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="size-10 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
        )}
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
          <Clock className="size-3" strokeWidth={2} />
          {formatDuration(project.duration)}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition-all duration-200 group-hover:bg-primary/10 group-hover:opacity-100">
          <div className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
            <Film className="size-4" strokeWidth={2} />
            Open
          </div>
        </div>
      </div>

      {/* Info area */}
      <div className="flex flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {project.name}
        </h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3" strokeWidth={2} />
          {formatDate(project.createdAt)}
        </div>
        <div className="text-xs text-muted-foreground/60">
          {project.resolution.width} × {project.resolution.height}
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onRecord }: { onRecord: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center animate-fade-up">
      <div className="flex size-20 items-center justify-center rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm">
        <FolderOpen className="size-8 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          No Recordings Yet
        </h2>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          Start by recording your screen. Your videos will appear here.
        </p>
      </div>
      <Button
        size="lg"
        onClick={onRecord}
        className="mt-2 gap-2 bg-primary px-8 font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/25"
      >
        <Video className="size-4" strokeWidth={2} />
        Record Now
      </Button>
    </div>
  );
}

export function VideoSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine where we came from for the back button
  const cameFromEditor = location.state?.from === "editor";
  const previousProjectId = location.state?.projectId;

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<Project[]>("list_projects");
      setProjects(result);
    } catch (err) {
      console.error("Failed to load projects:", err);
      setError(String(err));
      // Use empty array on error
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSelectProject(project: Project) {
    navigate(`/editor/${project.id}`);
  }

  function handleBack() {
    if (cameFromEditor && previousProjectId) {
      navigate(`/editor/${previousProjectId}`);
    } else {
      navigate("/recorder");
    }
  }

  function handleGoToRecorder() {
    navigate("/recorder");
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
        <header className="relative z-10 mb-6 animate-fade-up">
          <BrandLogo />
        </header>
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading recordings...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background">
      {/* Atmospheric background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-border/50 bg-card/30 px-4 py-3 backdrop-blur-sm animate-fade-up">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleBack}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {cameFromEditor ? "Back to editor" : "Back to recorder"}
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
              <FolderOpen className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <span className="text-sm font-medium text-foreground/80">My Recordings</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToRecorder}
          className="gap-2"
        >
          <Video className="size-4" strokeWidth={1.75} />
          New Recording
        </Button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden p-4">
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive animate-fade-up">
            {error}
          </div>
        )}

        {projects.length === 0 ? (
          <EmptyState onRecord={handleGoToRecorder} />
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={handleSelectProject}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
