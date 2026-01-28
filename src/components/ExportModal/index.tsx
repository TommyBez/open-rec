import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Clapperboard, Monitor, Package, Timer, Loader2, CheckCircle2, XCircle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
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

  // Use edited duration if provided, otherwise fall back to project duration
  const displayDuration = editedDuration ?? project.duration;

  // Clean up listeners when modal closes or component unmounts
  useEffect(() => {
    return () => {
      unlistenRefs.current.forEach(unlisten => unlisten());
      unlistenRefs.current = [];
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setExportStatus("idle");
      setProgress(0);
      setCurrentTime(0);
      setError(null);
      setOutputPath(null);
    }
  }, [open]);

  // Calculate estimated file size and time based on edited duration
  const estimatedSize = calculateEstimatedSize(displayDuration, options);
  const estimatedTime = calculateEstimatedTime(displayDuration, options);

  async function handleExport() {
    setExportStatus("exporting");
    setProgress(0);
    setCurrentTime(0);
    setError(null);
    setOutputPath(null);

    // Clean up any existing listeners
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];

    try {
      // Save project first to ensure latest changes are persisted
      if (onSaveProject) {
        await onSaveProject();
      }

      // Listen for progress updates (current time in seconds from ffmpeg)
      const unlistenProgress = await listen<number>("export-progress", (event) => {
        const currentTimeSeconds = event.payload;
        setCurrentTime(currentTimeSeconds);
        // Calculate progress percentage based on edited duration
        const percentage = Math.min((currentTimeSeconds / displayDuration) * 100, 99);
        setProgress(percentage);
      });
      unlistenRefs.current.push(unlistenProgress);

      // Listen for export completion
      const unlistenComplete = await listen<string>("export-complete", (event) => {
        setProgress(100);
        setExportStatus("complete");
        setOutputPath(event.payload);
      });
      unlistenRefs.current.push(unlistenComplete);

      // Listen for export errors
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

  function handleClose() {
    // Clean up listeners
    unlistenRefs.current.forEach(unlisten => unlisten());
    unlistenRefs.current = [];
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          {/* Info badges - hide during/after export */}
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

          {/* Export Progress Widget */}
          {exportStatus === "exporting" && (
            <div className="flex w-full flex-col gap-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">Exporting video...</span>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {Math.round(progress)}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {formatDuration(currentTime)} / {formatDuration(displayDuration)}
                </span>
                <span>
                  {options.format.toUpperCase()} • {options.resolution}
                </span>
              </div>
            </div>
          )}

          {/* Export Complete Widget */}
          {exportStatus === "complete" && (
            <div className="flex w-full flex-col gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-500" />
                <span className="text-sm font-medium">Export complete!</span>
              </div>
              {outputPath && (
                <p className="text-xs text-muted-foreground truncate" title={outputPath}>
                  Saved to: {outputPath}
                </p>
              )}
            </div>
          )}

          {/* Export Error Widget */}
          {exportStatus === "error" && (
            <div className="flex w-full flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-destructive" />
                <span className="text-sm font-medium">Export failed</span>
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
            </div>
          )}

          {/* Action buttons */}
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
