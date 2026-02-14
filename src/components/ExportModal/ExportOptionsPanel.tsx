import type { Dispatch, SetStateAction } from "react";
import type { ExportOptions as ExportOptionsType } from "../../types/project";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { getPresetOptions } from "./exportModalUtils";

type ExportFormat = ExportOptionsType["format"];
type FrameRate = ExportOptionsType["frameRate"];
type Compression = ExportOptionsType["compression"];
type Resolution = ExportOptionsType["resolution"];

interface ExportOptionsPanelProps {
  options: ExportOptionsType;
  setOptions: Dispatch<SetStateAction<ExportOptionsType>>;
  activePreset: "youtube-4k" | "web-discord" | "prores-master" | "custom";
  isAudioOnlyFormat: boolean;
  usesCompression: boolean;
}

export function ExportOptionsPanel({
  options,
  setOptions,
  activePreset,
  isAudioOnlyFormat,
  usesCompression,
}: ExportOptionsPanelProps) {
  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex flex-col gap-2.5">
        <Label className="text-muted-foreground text-xs">Preset</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={activePreset === "youtube-4k" ? "default" : "outline"}
            size="sm"
            onClick={() => setOptions(getPresetOptions("youtube-4k"))}
          >
            YouTube 4K
          </Button>
          <Button
            variant={activePreset === "web-discord" ? "default" : "outline"}
            size="sm"
            onClick={() => setOptions(getPresetOptions("web-discord"))}
          >
            Web (Discord/Slack)
          </Button>
          <Button
            variant={activePreset === "prores-master" ? "default" : "outline"}
            size="sm"
            onClick={() => setOptions(getPresetOptions("prores-master"))}
          >
            ProRes Master
          </Button>
          {activePreset === "custom" && (
            <Badge variant="secondary" className="px-2.5 py-1 text-[10px] uppercase tracking-wider">
              Custom
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-6">
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
            {(["mp4", "mov", "gif", "mp3", "wav"] as ExportFormat[]).map((format) => (
              <ToggleGroupItem key={format} value={format} className="px-4">
                {format.toUpperCase()}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-1 flex-col gap-2.5">
          <Label className="text-muted-foreground text-xs">Frame rate</Label>
          <Select
            value={String(options.frameRate)}
            disabled={isAudioOnlyFormat}
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

      <div className="flex flex-col gap-2.5">
        <Label className="text-muted-foreground text-xs">Compression</Label>
        <div className={!usesCompression ? "pointer-events-none opacity-60" : ""}>
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
        {!usesCompression && (
          <p className="text-[11px] text-muted-foreground">
            Compression settings are not used for {options.format.toUpperCase()} exports.
          </p>
        )}
      </div>

      {!isAudioOnlyFormat ? (
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
      ) : (
        <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Audio-only export selected: video tracks will be skipped.
        </div>
      )}
    </div>
  );
}
