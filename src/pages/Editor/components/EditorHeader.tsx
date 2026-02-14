import { memo, useEffect, useState } from "react";
import { ArrowLeft, Film, Download, FolderOpen } from "lucide-react";
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
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
  onCameraOverlayPositionChange: (
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right"
  ) => void;
  onCameraOverlayScaleChange: (scale: number) => void;
  onCameraOverlayMarginChange: (margin: number) => void;
  onBack: () => void;
  onExport: () => void;
  onOpenVideos: () => void;
}

export const EditorHeader = memo(function EditorHeader({
  projectName,
  isDirty,
  onRename,
  hasCameraTrack,
  cameraOverlayPosition,
  cameraOverlayScale,
  cameraOverlayMargin,
  onCameraOverlayPositionChange,
  onCameraOverlayScaleChange,
  onCameraOverlayMarginChange,
  onBack,
  onExport,
  onOpenVideos,
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
                )
              }
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80 outline-none focus:border-primary/50"
              title="Camera overlay position"
            >
              <option value="top-left">Cam TL</option>
              <option value="top-right">Cam TR</option>
              <option value="bottom-left">Cam BL</option>
              <option value="bottom-right">Cam BR</option>
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
                onChange={(event) =>
                  onCameraOverlayMarginChange(Number(event.target.value) || cameraOverlayMargin)
                }
                className="w-10 bg-transparent text-right text-xs outline-none"
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
        <Button 
          onClick={onExport}
          className="gap-2 bg-primary font-medium text-primary-foreground shadow-lg transition-all hover:bg-primary/90"
        >
          <Download className="size-4" strokeWidth={1.75} />
          Export
        </Button>
      </div>
    </header>
  );
});
