import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Clapperboard, Monitor, Package, Timer } from "lucide-react";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = ExportOptionsType["format"];
type FrameRate = ExportOptionsType["frameRate"];
type Compression = ExportOptionsType["compression"];
type Resolution = ExportOptionsType["resolution"];

export function ExportModal({ project, open, onOpenChange }: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptionsType>({
    format: "mp4",
    frameRate: 30,
    compression: "social",
    resolution: "1080p",
  });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Calculate estimated file size and time
  const estimatedSize = calculateEstimatedSize(project.duration, options);
  const estimatedTime = calculateEstimatedTime(project.duration, options);

  async function handleExport() {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      // Listen for progress updates
      const unlisten = await listen<number>("export-progress", (event) => {
        setProgress(event.payload);
      });

      await invoke("export_project", {
        projectId: project.id,
        options: {
          format: options.format,
          frameRate: options.frameRate,
          compression: options.compression,
          resolution: options.resolution,
        },
      });

      unlisten();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
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
          {/* Info badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <Clapperboard className="size-3" />
              {formatDuration(project.duration)}
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

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {isExporting ? (
            <div className="flex w-full items-center gap-3">
              <Progress value={progress} className="flex-1" />
              <span className="text-muted-foreground min-w-[40px] text-sm font-medium">
                {Math.round(progress)}%
              </span>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleExport}>Export</Button>
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
