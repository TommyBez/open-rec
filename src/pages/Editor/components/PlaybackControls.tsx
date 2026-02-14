import { memo } from "react";
import {SkipBack, Pause, Play, SkipForward, Scissors, ZoomIn, Gauge, Trash2, Undo2, Redo2, Square} from "lucide-react";
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
  canRedo: boolean;
  canDelete: boolean;
  canDeleteZoom: boolean;
  canDeleteSpeed: boolean;
  canDeleteSegment: boolean;
  canDeleteAnnotation: boolean;
  annotationMode: "outline" | "blur" | "text" | "arrow";
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  onTogglePlay: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onToggleTool: (tool: "cut" | "zoom" | "speed" | "annotation") => void;
}

export const PlaybackControls = memo(function PlaybackControls({
  currentTime,
  editedDuration,
  isPlaying,
  canUndo,
  canRedo,
  canDelete,
  canDeleteZoom,
  canDeleteSpeed,
  canDeleteSegment,
  canDeleteAnnotation,
  annotationMode,
  selectedTool,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  onUndo,
  onRedo,
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
            <span>
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
            </span>
          </TooltipTrigger>
          <TooltipContent>Undo (⌘Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <button 
                onClick={onRedo}
                disabled={!canRedo}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  canRedo 
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground" 
                    : "text-muted-foreground/30 cursor-not-allowed"
                )}
              >
                <Redo2 className="size-4" strokeWidth={1.75} />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Redo (⇧⌘Z)</TooltipContent>
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
          <TooltipContent>Skip back 5s (or J)</TooltipContent>
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
          <TooltipContent>{isPlaying ? "Pause (K)" : "Play (K/L)"}</TooltipContent>
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
          tooltip={selectedTool === "cut" ? "Deactivate cut tool (1)" : "Cut tool (1, click on timeline)"}
        />
        <ToolButton
          active={selectedTool === "zoom"}
          onClick={() => onToggleTool("zoom")}
          icon={<ZoomIn className="size-4" strokeWidth={1.75} />}
          tooltip={selectedTool === "zoom" ? "Deactivate zoom tool (2)" : "Zoom tool (2, click on timeline)"}
        />
        <ToolButton
          active={selectedTool === "speed"}
          onClick={() => onToggleTool("speed")}
          icon={<Gauge className="size-4" strokeWidth={1.75} />}
          tooltip={selectedTool === "speed" ? "Deactivate speed tool (3)" : "Speed tool (3, click on timeline)"}
        />
        <ToolButton
          active={selectedTool === "annotation"}
          onClick={() => onToggleTool("annotation")}
          icon={<Square className="size-4" strokeWidth={1.75} />}
          tooltip={
            selectedTool === "annotation"
              ? "Deactivate annotation tool (4)"
              : `Annotation tool (4, ${annotationMode}). Quick add: A/Shift+A/B/T`
          }
        />
        
        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-border/50" />
        
        {/* Delete selected item */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
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
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {canDeleteZoom 
              ? "Delete selected zoom (Delete/Backspace)" 
              : canDeleteSpeed
              ? "Delete selected speed (Delete/Backspace)"
              : canDeleteAnnotation
              ? "Delete selected annotation (Delete/Backspace)"
              : canDeleteSegment 
              ? "Delete selected segment (Delete/Backspace)" 
              : "Select an item to delete (Delete/Backspace)"}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});
