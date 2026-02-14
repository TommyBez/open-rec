import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
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
import { ExportOptions, Project } from "../../types/project";
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
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [currentBatchJobId, setCurrentBatchJobId] = useState<string | null>(null);
  const [stopBatchRequested, setStopBatchRequested] = useState(false);
  const stopBatchRequestedRef = useRef(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [batchHistory, setBatchHistory] = useState<string[]>([]);
  const [batchOptions, setBatchOptions] = useState<ExportOptions>({
    format: "mp4",
    frameRate: 30,
    compression: "social",
    resolution: "1080p",
  });

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
    if (selectionMode) {
      toggleProjectSelection(project.id);
      return;
    }
    navigate(`/editor/${project.id}`);
  }

  function toggleProjectSelection(projectId: string) {
    setSelectedProjectIds((previous) =>
      previous.includes(projectId)
        ? previous.filter((id) => id !== projectId)
        : [...previous, projectId]
    );
  }

  async function handleRenameProject(projectId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) return;

    const target = projects.find((project) => project.id === projectId);
    if (!target || target.name === trimmed) return;

    const updatedProject = { ...target, name: trimmed };
    setProjects((prev) =>
      prev.map((project) => (project.id === projectId ? updatedProject : project))
    );

    try {
      await invoke("save_project", { project: updatedProject });
    } catch (err) {
      console.error("Failed to rename project:", err);
      setProjects((prev) =>
        prev.map((project) => (project.id === projectId ? target : project))
      );
    }
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

  async function waitForExportResult(jobId: string): Promise<{ ok: boolean; message: string }> {
    return new Promise(async (resolve) => {
      const unlisteners: UnlistenFn[] = [];
      const cleanup = () => {
        unlisteners.forEach((unlisten) => unlisten());
      };

      const onComplete = await listen<{ jobId: string; outputPath: string }>(
        "export-complete",
        (event) => {
          if (event.payload.jobId !== jobId) return;
          cleanup();
          resolve({ ok: true, message: event.payload.outputPath });
        }
      );
      const onError = await listen<{ jobId: string; message: string }>(
        "export-error",
        (event) => {
          if (event.payload.jobId !== jobId) return;
          cleanup();
          resolve({ ok: false, message: event.payload.message });
        }
      );
      const onCancelled = await listen<{ jobId: string }>("export-cancelled", (event) => {
        if (event.payload.jobId !== jobId) return;
        cleanup();
        resolve({ ok: false, message: "Export cancelled" });
      });

      unlisteners.push(onComplete, onError, onCancelled);
    });
  }

  async function handleBatchExport() {
    if (selectedProjectIds.length === 0 || isBatchExporting) return;
    setIsBatchExporting(true);
    setStopBatchRequested(false);
    stopBatchRequestedRef.current = false;
    setBatchHistory([]);
    setBatchStatus(`Preparing batch export (0/${selectedProjectIds.length})...`);

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < selectedProjectIds.length; i++) {
      if (stopBatchRequestedRef.current) {
        break;
      }
      const projectId = selectedProjectIds[i];
      const projectName =
        projects.find((project) => project.id === projectId)?.name ?? `Project ${i + 1}`;
      setBatchStatus(`Exporting ${i + 1}/${selectedProjectIds.length}: ${projectName}`);
      try {
        const started = await invoke<{ jobId: string }>("export_project", {
          projectId,
          options: batchOptions,
        });
        setCurrentBatchJobId(started.jobId);
        const result = await waitForExportResult(started.jobId);
        setCurrentBatchJobId(null);
        if (result.ok) {
          completed += 1;
          setBatchHistory((history) => [...history, `✓ ${projectName}`]);
        } else {
          failed += 1;
          setBatchHistory((history) => [...history, `✗ ${projectName} (${result.message})`]);
        }
      } catch (err) {
        failed += 1;
        setBatchHistory((history) => [...history, `✗ ${projectName} (failed to start)`]);
        console.error("Batch export failed for project:", projectId, err);
      }
    }

    if (stopBatchRequestedRef.current) {
      setBatchStatus(`Batch export stopped: ${completed} succeeded, ${failed} failed.`);
    } else {
      setBatchStatus(`Batch export finished: ${completed} succeeded, ${failed} failed.`);
    }
    setStopBatchRequested(false);
    setCurrentBatchJobId(null);
    setIsBatchExporting(false);
  }

  async function handleStopBatchExport() {
    setStopBatchRequested(true);
    stopBatchRequestedRef.current = true;
    if (!currentBatchJobId) return;
    try {
      await invoke("cancel_export", { jobId: currentBatchJobId });
    } catch (error) {
      console.error("Failed to stop current batch export job:", error);
    }
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
          disabled={isBatchExporting}
          className="gap-2"
        >
          <Video className="size-4" strokeWidth={1.75} />
          New Recording
        </Button>
        <Button
          variant={selectionMode ? "default" : "outline"}
          size="sm"
          disabled={isBatchExporting}
          onClick={() => {
            setSelectionMode((active) => {
              const next = !active;
              if (!next) {
                setSelectedProjectIds([]);
              }
              return next;
            });
          }}
        >
          {selectionMode ? "Done Selecting" : "Batch Export"}
        </Button>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-1 flex-col overflow-hidden p-4">
        {selectionMode && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">
              Selected: {selectedProjectIds.length}
            </span>
            <select
              value={batchOptions.format}
              onChange={(event) =>
                setBatchOptions((previous) => ({
                  ...previous,
                  format: event.target.value as ExportOptions["format"],
                }))
              }
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
            >
              <option value="mp4">MP4</option>
              <option value="mov">MOV</option>
              <option value="gif">GIF</option>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
            </select>
            <select
              value={batchOptions.resolution}
              disabled={batchOptions.format === "mp3" || batchOptions.format === "wav"}
              onChange={(event) =>
                setBatchOptions((previous) => ({
                  ...previous,
                  resolution: event.target.value as ExportOptions["resolution"],
                }))
              }
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs disabled:opacity-50"
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
            <Button
              size="sm"
              disabled={selectedProjectIds.length === 0 || isBatchExporting}
              onClick={handleBatchExport}
            >
              {isBatchExporting ? "Exporting..." : "Export Selected"}
            </Button>
            {isBatchExporting && (
              <Button
                size="sm"
                variant="outline"
                disabled={stopBatchRequested}
                onClick={handleStopBatchExport}
              >
                {stopBatchRequested ? "Stopping..." : "Stop Queue"}
              </Button>
            )}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive animate-fade-up">
            {error}
          </div>
        )}
        {batchStatus && (
          <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {batchStatus}
          </div>
        )}
        {batchHistory.length > 0 && (
          <div className="mb-3 max-h-24 overflow-auto rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
            {batchHistory.map((entry, index) => (
              <div key={`${entry}-${index}`}>{entry}</div>
            ))}
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
                  onRename={handleRenameProject}
                  selectionMode={selectionMode}
                  selected={selectedProjectIds.includes(project.id)}
                  onToggleSelect={toggleProjectSelection}
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
