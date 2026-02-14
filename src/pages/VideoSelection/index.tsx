import { FolderOpen, Video } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
import { Button } from "@/components/ui/button";
import { ProjectCard } from "./ProjectCard";
import { useExportStore } from "../../stores";
import { VideoSelectionHeader } from "./components/VideoSelectionHeader";
import { BatchExportToolbar } from "./components/BatchExportToolbar";
import { useVideoSelectionState } from "./hooks/useVideoSelectionState";

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
  const {
    projects,
    isLoading,
    error,
    selectionMode,
    selectedProjectIds,
    cameFromEditor,
    batchOptions,
    setBatchOptions,
    isBatchExporting,
    stopBatchRequested,
    batchStatus,
    batchHistory,
    startBatchExport,
    stopBatchExport,
    handleSelectProject,
    handleRenameProject,
    handleDeleteProject,
    handleOpenProjectInNewWindow,
    toggleProjectSelection,
    handleBack,
    handleGoToRecorder,
    toggleSelectionMode,
  } = useVideoSelectionState();
  const activeExportCount = useExportStore((state) => state.activeExportCount);

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
      <VideoSelectionHeader
        cameFromEditor={cameFromEditor}
        isBatchExporting={isBatchExporting}
        selectionMode={selectionMode}
        activeExportCount={activeExportCount}
        onBack={handleBack}
        onGoToRecorder={handleGoToRecorder}
        onToggleSelectionMode={toggleSelectionMode}
      />

      <main className="relative z-10 flex flex-1 flex-col overflow-hidden p-4">
        {selectionMode && (
          <BatchExportToolbar
            selectedCount={selectedProjectIds.length}
            isBatchExporting={isBatchExporting}
            stopBatchRequested={stopBatchRequested}
            batchOptions={batchOptions}
            onBatchOptionsChange={setBatchOptions}
            onStartBatchExport={startBatchExport}
            onStopBatchExport={stopBatchExport}
          />
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
                  onDelete={handleDeleteProject}
                  onOpenInNewWindow={handleOpenProjectInNewWindow}
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
