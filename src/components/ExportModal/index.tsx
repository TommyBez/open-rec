import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Project, ExportOptions as ExportOptionsType } from "../../types/project";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  calculateEstimatedSize,
  calculateEstimatedTime,
  detectActivePreset,
  formatDuration,
} from "./exportModalUtils";
import { useExportJob } from "./useExportJob";
import { ExportOptionsPanel } from "./ExportOptionsPanel";
import { ExportEstimateBadges } from "./ExportEstimateBadges";
import { ExportProgressCard } from "./ExportProgressCard";
import { ExportCompleteCard } from "./ExportCompleteCard";
import { ExportErrorCard } from "./ExportErrorCard";
import { ExportDialogActions } from "./ExportDialogActions";

interface ExportModalProps {
  project: Project;
  editedDuration?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveProject?: () => Promise<void>;
}

export function ExportModal({ project, editedDuration, open, onOpenChange, onSaveProject }: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptionsType>({
    format: "mp4",
    frameRate: 30,
    compression: "social",
    resolution: "1080p",
  });

  const displayDuration = editedDuration ?? project.duration;
  const activePreset = detectActivePreset(options);
  const isAudioOnlyFormat = options.format === "mp3" || options.format === "wav";
  const usesCompression = options.format === "mp4" || options.format === "mp3";
  const {
    exportStatus,
    progress,
    currentTime,
    error,
    outputPath,
    jobId,
    resetState,
    cleanupListeners,
    handleExport,
    handleCancelExport,
  } = useExportJob({
    projectId: project.id,
    displayDuration,
    options,
    onSaveProject,
  });

  useEffect(() => {
    if (open) resetState();
  }, [open, resetState]);

  const estimatedSize = calculateEstimatedSize(displayDuration, options);
  const estimatedTime = calculateEstimatedTime(displayDuration, options);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) cleanupListeners();
    onOpenChange(nextOpen);
  }

  function handleClose() {
    cleanupListeners();
    onOpenChange(false);
  }

  function formatResolution(): string {
    return `${project.resolution.width}×${project.resolution.height}`;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>Export</DialogTitle>
        </DialogHeader>

        <ExportOptionsPanel
          options={options}
          setOptions={setOptions}
          activePreset={activePreset}
          isAudioOnlyFormat={isAudioOnlyFormat}
          usesCompression={usesCompression}
        />

        <DialogFooter className="flex-col gap-4 sm:flex-col">
          {exportStatus === "idle" && (
            <ExportEstimateBadges
              durationLabel={formatDuration(displayDuration)}
              resolutionLabel={formatResolution()}
              estimatedSize={estimatedSize}
              estimatedTime={estimatedTime}
            />
          )}

          <AnimatePresence>
            {exportStatus === "exporting" && (
              <ExportProgressCard
                progress={progress}
                currentTime={currentTime}
                displayDuration={displayDuration}
                formatLabel={options.format}
                resolutionLabel={isAudioOnlyFormat ? undefined : options.resolution}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {exportStatus === "complete" && <ExportCompleteCard outputPath={outputPath} />}
          </AnimatePresence>

          <AnimatePresence>
            {exportStatus === "error" && <ExportErrorCard error={error} />}
          </AnimatePresence>

          <ExportDialogActions
            exportStatus={exportStatus}
            jobId={jobId}
            onClose={handleClose}
            onRetry={handleExport}
            onCancelExport={handleCancelExport}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
