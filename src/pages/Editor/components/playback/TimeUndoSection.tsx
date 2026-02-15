import { Redo2, Undo2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

interface TimeUndoSectionProps {
  currentTime: number;
  editedDuration: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function TimeUndoSection({
  currentTime,
  editedDuration,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: TimeUndoSectionProps) {
  return (
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
                  : "cursor-not-allowed text-muted-foreground/30"
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
                  : "cursor-not-allowed text-muted-foreground/30"
              )}
            >
              <Redo2 className="size-4" strokeWidth={1.75} />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Redo (⇧⌘Z)</TooltipContent>
      </Tooltip>
    </div>
  );
}
