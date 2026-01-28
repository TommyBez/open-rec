import { memo, ReactNode } from "react";
import SkipBack from "lucide-react/dist/esm/icons/skip-back";
import SkipForward from "lucide-react/dist/esm/icons/skip-forward";
import Play from "lucide-react/dist/esm/icons/play";
import Pause from "lucide-react/dist/esm/icons/pause";
import Scissors from "lucide-react/dist/esm/icons/scissors";
import ZoomIn from "lucide-react/dist/esm/icons/zoom-in";
import Gauge from "lucide-react/dist/esm/icons/gauge";
import Undo2 from "lucide-react/dist/esm/icons/undo-2";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToolButton } from "../../../components/ToolButton";
import { cn } from "@/lib/utils";

// Hoisted outside component to avoid recreation
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

interface PlaybackControlsProps {
  currentTime: number;
  editedDuration: number;
  isPlaying: boolean;
  canUndo: boolean;
  canDelete: boolean;
  canDeleteZoom: boolean;
  canDeleteSpeed: boolean;
  canDeleteSegment: boolean;
  selectedTool: string | null;
  onTogglePlay: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onToggleTool: (tool: "cut" | "zoom" | "speed") => void;
}

export const PlaybackControls = memo(function PlaybackControls({
  currentTime,
  editedDuration,
  isPlaying,
  canUndo,
  canDelete,
  canDeleteZoom,
  canDeleteSpeed,
  canDeleteSegment,
  selectedTool,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  onUndo,
  onDelete,
  onToggleTool,
}: PlaybackControlsProps) {
  return (
    <div className="studio-panel flex items-center justify-between rounded-xl px-4 py-3 animate-fade-up-delay-2">
      {/* Timecode + Undo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="min-w-[140px] font-mono text-sm text-muted-foreground">
            {formatTime(currentTime)}
          </span>
          <span className="text-muted-foreground/40">/</span>
          <span className="font-mono text-sm text-muted-foreground/60">
            {formatTime(editedDuration)}
          </span>
        </div>
        {/* Undo button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onUndo}
              disabled={!canUndo}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors",
                canUndo 
                  ? "text-muted-foreground hover:bg-muted hover:text-foreground" 
                  : "text-muted-foreground/30 cursor-not-allowed"
              )}
            >
              <Undo2 className="size-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onSkipBackward}
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SkipBack className="size-5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Skip back 5s</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onTogglePlay}
              className={cn(
                "flex size-12 items-center justify-center rounded-xl transition-all",
                isPlaying 
                  ? "bg-primary/15 text-primary" 
                  : "bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
              )}
            >
              {isPlaying ? (
                <Pause className="size-5" strokeWidth={1.75} />
              ) : (
                <Play className="size-5 ml-0.5" strokeWidth={1.75} />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{isPlaying ? "Pause" : "Play"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={onSkipForward}
              className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SkipForward className="size-5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Skip forward 5s</TooltipContent>
        </Tooltip>
      </div>

      {/* Tool Buttons */}
      <div className="flex items-center gap-1">
        <ToolButton
          active={selectedTool === "cut"}
          onClick={() => onToggleTool("cut")}
          icon={<Scissors className="size-4" strokeWidth={1.75} />}
          tooltip={selectedTool === "cut" ? "Deactivate cut tool" : "Cut tool (click on timeline)"}
        />
        <ToolButton
          active={selectedTool === "zoom"}
          onClick={() => onToggleTool("zoom")}
          icon={<ZoomIn className="size-4" strokeWidth={1.75} />}
          tooltip={selectedTool === "zoom" ? "Deactivate zoom tool" : "Zoom tool (click on timeline)"}
        />
        <ToolButton
          active={selectedTool === "speed"}
          onClick={() => onToggleTool("speed")}
          icon={<Gauge className="size-4" strokeWidth={1.75} />}
          tooltip={selectedTool === "speed" ? "Deactivate speed tool" : "Speed tool (click on timeline)"}
        />
        
        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-border/50" />
        
        {/* Delete selected item */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onDelete}
              disabled={!canDelete}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg transition-all",
                canDelete
                  ? "text-destructive hover:bg-destructive/10"
                  : "text-muted-foreground/30 cursor-not-allowed"
              )}
            >
              <Trash2 className="size-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {canDeleteZoom 
              ? "Delete selected zoom" 
              : canDeleteSpeed
              ? "Delete selected speed"
              : canDeleteSegment 
              ? "Delete selected segment" 
              : "Select an item to delete"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});
