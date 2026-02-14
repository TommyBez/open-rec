import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft, Video, FolderOpen } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Project } from "../../types/project";
import { ProjectCard } from "./ProjectCard";

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

  // Resize window to full screen on mount
  useEffect(() => {
    async function resizeWindow() {
      try {
        const window = getCurrentWindow();
        await window.setSize(new LogicalSize(1200, 800));
        await window.center();
      } catch (error) {
        console.error("Failed to resize window:", error);
      }
    }
    resizeWindow();
  }, []);

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
