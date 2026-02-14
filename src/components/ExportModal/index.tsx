import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Project, ExportOptions as ExportOptionsType } from "../../types/project";
import { Button } from "@/components/ui/button";
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
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="studio-panel flex w-full flex-col gap-4 rounded-xl p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <motion.span
                      className="relative flex size-2.5"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                    >
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
                    </motion.span>
                    <span className="text-sm font-medium text-foreground/80">Encoding</span>
                  </div>
                  <motion.span
                    key={Math.round(progress)}
                    initial={{ opacity: 0.5, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="font-mono text-2xl font-semibold tracking-tight text-foreground"
                  >
                    {Math.round(progress)}
                    <span className="text-base text-foreground/50">%</span>
                  </motion.span>
                </div>

                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-accent glow-amber"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                      backgroundSize: "200% 100%",
                    }}
                    animate={{
                      backgroundPosition: ["200% 0%", "-200% 0%"],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatDuration(currentTime)}
                    <span className="text-muted-foreground/50"> / </span>
                    {formatDuration(displayDuration)}
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {options.format}{isAudioOnlyFormat ? "" : ` • ${options.resolution}`}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/80">
                  You can close this dialog and continue editing while export runs in background.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {exportStatus === "complete" && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="flex w-full flex-col gap-3 rounded-xl border border-chart-3/20 bg-chart-3/10 p-5 shadow-lg"
              >
                <div className="flex items-center gap-2.5">
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <CheckCircle2 className="size-5 text-chart-3" />
                  </motion.div>
                  <span className="text-sm font-medium text-foreground">Export complete</span>
                </div>
                {outputPath && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="truncate font-mono text-xs text-muted-foreground"
                    title={outputPath}
                  >
                    {outputPath}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {exportStatus === "error" && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="flex w-full flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-5 shadow-lg"
              >
                <div className="flex items-center gap-2.5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <XCircle className="size-5 text-destructive" />
                  </motion.div>
                  <span className="text-sm font-medium text-foreground">Export failed</span>
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs text-destructive/80"
                  >
                    {error}
                  </motion.p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {exportStatus === "idle" && (
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleExport}>Export</Button>
            </div>
          )}

          {exportStatus === "exporting" && (
            <div className="flex w-full justify-end">
              <Button variant="outline" onClick={handleCancelExport} disabled={!jobId}>
                Cancel
              </Button>
            </div>
          )}

          {(exportStatus === "complete" || exportStatus === "error") && (
            <div className="flex w-full justify-end gap-2">
              {exportStatus === "error" && (
                <Button variant="outline" onClick={handleExport}>
                  Retry
                </Button>
              )}
              <Button onClick={handleClose}>
                {exportStatus === "complete" ? "Done" : "Close"}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
