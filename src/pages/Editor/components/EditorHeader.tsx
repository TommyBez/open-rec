import { memo, useEffect, useState } from "react";
import { ArrowLeft, Film, Download, FolderOpen, Keyboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditorHeaderProps {
  projectName: string;
  isDirty: boolean;
  onRename: (name: string) => void;
  hasCameraTrack: boolean;
  hasMicrophoneTrack: boolean;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
  audioSystemVolume: number;
  audioMicrophoneVolume: number;
  microphoneNoiseGate: boolean;
  colorBrightness: number;
  colorContrast: number;
  colorSaturation: number;
  onCameraOverlayPositionChange: (
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom"
  ) => void;
  onCameraOverlayScaleChange: (scale: number) => void;
  onCameraOverlayMarginChange: (margin: number) => void;
  onAudioSystemVolumeChange: (volume: number) => void;
  onAudioMicrophoneVolumeChange: (volume: number) => void;
  onMicrophoneNoiseGateChange: (enabled: boolean) => void;
  onColorBrightnessChange: (value: number) => void;
  onColorContrastChange: (value: number) => void;
  onColorSaturationChange: (value: number) => void;
  onBack: () => void;
  onExport: () => void;
  onOpenVideos: () => void;
  activeExportCount: number;
}

export const EditorHeader = memo(function EditorHeader({
  projectName,
  isDirty,
  onRename,
  hasCameraTrack,
  hasMicrophoneTrack,
  cameraOverlayPosition,
  cameraOverlayScale,
  cameraOverlayMargin,
  audioSystemVolume,
  audioMicrophoneVolume,
  microphoneNoiseGate,
  colorBrightness,
  colorContrast,
  colorSaturation,
  onCameraOverlayPositionChange,
  onCameraOverlayScaleChange,
  onCameraOverlayMarginChange,
  onAudioSystemVolumeChange,
  onAudioMicrophoneVolumeChange,
  onMicrophoneNoiseGateChange,
  onColorBrightnessChange,
  onColorContrastChange,
  onColorSaturationChange,
  onBack,
  onExport,
  onOpenVideos,
  activeExportCount,
}: EditorHeaderProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(projectName);

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(projectName);
    }
  }, [projectName, isRenaming]);

  const commitRename = () => {
    onRename(draftName);
    setIsRenaming(false);
  };
  const marginDisabled = cameraOverlayPosition === "custom";

  return (
    <header className="relative z-10 flex items-center justify-between border-b border-border/50 bg-card/30 px-4 py-3 backdrop-blur-sm animate-fade-up">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onBack}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Back to recorder</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <Film className="size-4 text-primary" strokeWidth={1.75} />
          </div>
          {isRenaming ? (
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitRename();
                }
                if (event.key === "Escape") {
                  setDraftName(projectName);
                  setIsRenaming(false);
                }
              }}
              autoFocus
              className="w-56 rounded-md border border-border/60 bg-background px-2 py-1 text-sm font-medium text-foreground/90 outline-none focus:border-primary/50"
            />
          ) : (
            <button
              onClick={() => setIsRenaming(true)}
              className="text-sm font-medium text-foreground/80 hover:text-foreground"
              title="Rename project"
            >
              {projectName}
            </button>
          )}
          {isDirty && (
            <span className="text-xl leading-none text-accent">•</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
            Br
            <input
              type="number"
              min={-1}
              max={1}
              step={0.05}
              value={colorBrightness.toFixed(2)}
              onChange={(event) =>
                onColorBrightnessChange(Number(event.target.value) || 0)
              }
              className="w-10 bg-transparent text-right text-xs outline-none"
              title="Brightness"
            />
          </label>
          <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
            Ct
            <input
              type="number"
              min={0.5}
              max={2}
              step={0.05}
              value={colorContrast.toFixed(2)}
              onChange={(event) =>
                onColorContrastChange(Number(event.target.value) || colorContrast)
              }
              className="w-10 bg-transparent text-right text-xs outline-none"
              title="Contrast"
            />
          </label>
          <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
            Sat
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={colorSaturation.toFixed(2)}
              onChange={(event) =>
                onColorSaturationChange(Number(event.target.value) || colorSaturation)
              }
              className="w-10 bg-transparent text-right text-xs outline-none"
              title="Saturation"
            />
          </label>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
            Sys
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              value={audioSystemVolume.toFixed(2)}
              onChange={(event) =>
                onAudioSystemVolumeChange(Number(event.target.value) || audioSystemVolume)
              }
              className="w-11 bg-transparent text-right text-xs outline-none"
              title="System audio volume"
            />
          </label>
          <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
            Mic
            <input
              type="number"
              min={0}
              max={2}
              step={0.05}
              disabled={!hasMicrophoneTrack}
              value={audioMicrophoneVolume.toFixed(2)}
              onChange={(event) =>
                onAudioMicrophoneVolumeChange(Number(event.target.value) || audioMicrophoneVolume)
              }
              className="w-11 bg-transparent text-right text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
              title="Microphone volume"
            />
          </label>
          <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
            Gate
            <input
              type="checkbox"
              checked={microphoneNoiseGate}
              disabled={!hasMicrophoneTrack}
              onChange={(event) => onMicrophoneNoiseGateChange(event.target.checked)}
              className="size-3.5 accent-primary disabled:cursor-not-allowed"
              title="Enable microphone noise gate"
            />
          </label>
        </div>
        {hasCameraTrack && (
          <div className="flex items-center gap-1.5">
            <select
              value={cameraOverlayPosition}
              onChange={(event) =>
                onCameraOverlayPositionChange(
                  event.target.value as
                    | "top-left"
                    | "top-right"
                    | "bottom-left"
                    | "bottom-right"
                    | "custom"
                )
              }
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80 outline-none focus:border-primary/50"
              title="Camera overlay position"
            >
              <option value="top-left">Cam TL</option>
              <option value="top-right">Cam TR</option>
              <option value="bottom-left">Cam BL</option>
              <option value="bottom-right">Cam BR</option>
              <option value="custom">Cam Drag</option>
            </select>
            <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
              Scale
              <input
                type="number"
                min={0.1}
                max={0.6}
                step={0.05}
                value={cameraOverlayScale.toFixed(2)}
                onChange={(event) =>
                  onCameraOverlayScaleChange(Number(event.target.value) || cameraOverlayScale)
                }
                className="w-11 bg-transparent text-right text-xs outline-none"
              />
            </label>
            <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
              Margin
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={cameraOverlayMargin}
                disabled={marginDisabled}
                onChange={(event) =>
                  onCameraOverlayMarginChange(Number(event.target.value) || cameraOverlayMargin)
                }
                className="w-10 bg-transparent text-right text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onOpenVideos}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="My Recordings"
            >
              <FolderOpen className="size-5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>My Recordings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="size-4.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-0.5 text-xs">
              <p>J/K/L transport · ←/→ frame step</p>
              <p>1/2/3/4 tools · A/B/T/⇧A annotations</p>
              <p>⌥ + arrows nudge selected annotation</p>
              <p>⌘S save · ⌘D duplicate annotation</p>
            </div>
          </TooltipContent>
        </Tooltip>
        <Button 
          onClick={onExport}
          className="gap-2 bg-primary font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
        >
          <Download className="size-4" strokeWidth={1.75} />
          Export
        </Button>
        {activeExportCount > 0 && (
          <div className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            {activeExportCount} exporting
          </div>
        )}
      </div>
    </header>
  );
});
