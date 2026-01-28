import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { motion, AnimatePresence } from "motion/react";
import { Clapperboard, Monitor, Package, Timer, CheckCircle2, XCircle } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface ExportModalProps {
  project: Project;
  editedDuration?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveProject?: () => Promise<void>;
}

type ExportFormat = ExportOptionsType["format"];
type FrameRate = ExportOptionsType["frameRate"];
type Compression = ExportOptionsType["compression"];
type Resolution = ExportOptionsType["resolution"];

type ExportStatus = "idle" | "exporting" | "complete" | "error";

export function ExportModal({ project, editedDuration, open, onOpenChange, onSaveProject }: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptionsType>({
    format: "mp4",
    frameRate: 30,
    compression: "social",
    resolution: "1080p",
  });
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  const displayDuration = editedDuration ?? project.duration;

  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, []);

  useEffect(() => {
    if (open) {
      setExportStatus("idle");
      setProgress(0);
      setCurrentTime(0);
      setError(null);
      setOutputPath(null);
    }
  }, [open]);

  const estimatedSize = calculateEstimatedSize(displayDuration, options);
  const estimatedTime = calculateEstimatedTime(displayDuration, options);

  async function handleExport() {
    setExportStatus("exporting");
    setProgress(0);
    setCurrentTime(0);
    setError(null);
    setOutputPath(null);

    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];

    try {
      if (onSaveProject) {
        await onSaveProject();
      }

      const unlistenProgress = await listen<number>("export-progress", (event) => {
        const currentTimeSeconds = event.payload;
        setCurrentTime(currentTimeSeconds);
        const percentage = Math.min((currentTimeSeconds / displayDuration) * 100, 99);
        setProgress(percentage);
      });
      unlistenRefs.current.push(unlistenProgress);

      const unlistenComplete = await listen<string>("export-complete", (event) => {
        setProgress(100);
        setExportStatus("complete");
        setOutputPath(event.payload);
      });
      unlistenRefs.current.push(unlistenComplete);

      const unlistenError = await listen<string>("export-error", (event) => {
        setExportStatus("error");
        setError(event.payload);
      });
      unlistenRefs.current.push(unlistenError);

      await invoke("export_project", {
        projectId: project.id,
        options: {
          format: options.format,
          frameRate: options.frameRate,
          compression: options.compression,
          resolution: options.resolution,
        },
      });
    } catch (err) {
      setExportStatus("error");
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  function cleanupListeners() {
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      if (exportStatus === "exporting") {
        return;
      }
      cleanupListeners();
    }
    onOpenChange(nextOpen);
  }

  function handleClose() {
    cleanupListeners();
    onOpenChange(false);
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

        <div className="flex flex-col gap-5 py-4">
          {/* Format and Frame Rate Row */}
          <div className="flex gap-6">
            {/* Format */}
            <div className="flex flex-1 flex-col gap-2.5">
              <Label className="text-muted-foreground text-xs">Format</Label>
              <ToggleGroup
                type="single"
                value={options.format}
                onValueChange={(value) => {
                  if (value) setOptions({ ...options, format: value as ExportFormat });
                }}
                variant="outline"
              >
                {(["mp4", "gif"] as ExportFormat[]).map((format) => (
                  <ToggleGroupItem key={format} value={format} className="px-4">
                    {format.toUpperCase()}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {/* Frame Rate */}
            <div className="flex flex-1 flex-col gap-2.5">
              <Label className="text-muted-foreground text-xs">Frame rate</Label>
              <Select
                value={String(options.frameRate)}
                onValueChange={(value) =>
                  setOptions({ ...options, frameRate: Number(value) as FrameRate })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 FPS</SelectItem>
                  <SelectItem value="30">30 FPS</SelectItem>
                  <SelectItem value="60">60 FPS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Compression */}
          <div className="flex flex-col gap-2.5">
            <Label className="text-muted-foreground text-xs">Compression</Label>
            <ToggleGroup
              type="single"
              value={options.compression}
              onValueChange={(value) => {
                if (value) setOptions({ ...options, compression: value as Compression });
              }}
              variant="outline"
            >
              {(["minimal", "social", "web", "potato"] as Compression[]).map((comp) => (
                <ToggleGroupItem key={comp} value={comp} className="px-4">
                  {comp.charAt(0).toUpperCase() + comp.slice(1)}
                  {comp === "social" && " Media"}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-2.5">
            <Label className="text-muted-foreground text-xs">Resolution</Label>
            <ToggleGroup
              type="single"
              value={options.resolution}
              onValueChange={(value) => {
                if (value) setOptions({ ...options, resolution: value as Resolution });
              }}
              variant="outline"
            >
              {(["720p", "1080p", "4k"] as Resolution[]).map((res) => (
                <ToggleGroupItem key={res} value={res} className="px-4">
                  {res}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <DialogFooter className="flex-col gap-4 sm:flex-col">
          {exportStatus === "idle" && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1.5">
                <Clapperboard className="size-3" />
                {formatDuration(displayDuration)}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Monitor className="size-3" />
                {formatResolution()}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Package className="size-3" />
                {estimatedSize}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Timer className="size-3" />
                ~{estimatedTime}
              </Badge>
            </div>
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
                    {options.format} • {options.resolution}
                  </span>
                </div>
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
              <Button variant="outline" onClick={handleClose} disabled>
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

function calculateEstimatedSize(duration: number, options: ExportOptionsType): string {
  // Rough estimates based on compression preset
  const bitrates: Record<Compression, number> = {
    minimal: 20, // Mbps
    social: 8,
    web: 4,
    potato: 1.5,
  };

  const bitrate = bitrates[options.compression];
  const sizeMB = (duration * bitrate) / 8;

  if (sizeMB >= 1000) {
    return `${(sizeMB / 1000).toFixed(2)} GB`;
  }
  return `${sizeMB.toFixed(2)} MB`;
}

function calculateEstimatedTime(duration: number, options: ExportOptionsType): string {
  // Rough estimate: export time is roughly 0.5-2x the video duration
  const multipliers: Record<Resolution, number> = {
    "720p": 0.3,
    "1080p": 0.5,
    "4k": 1.5,
  };

  const seconds = Math.ceil(duration * multipliers[options.resolution]);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}s`;
}
