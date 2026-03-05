import { Gauge, Scissors, Square, Trash2, ZoomIn } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToolButton } from "../../../../components/ToolButton";
import { cn } from "@/lib/utils";

interface ToolSectionProps {
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  annotationMode: "outline" | "blur" | "text" | "arrow";
  canDelete: boolean;
  canDeleteZoom: boolean;
  canDeleteSpeed: boolean;
  canDeleteSegment: boolean;
  canDeleteAnnotation: boolean;
  onToggleTool: (tool: "cut" | "zoom" | "speed" | "annotation") => void;
  onDelete: () => void;
}

export function ToolSection({
  selectedTool,
  annotationMode,
  canDelete,
  canDeleteZoom,
  canDeleteSpeed,
  canDeleteSegment,
  canDeleteAnnotation,
  onToggleTool,
  onDelete,
}: ToolSectionProps) {
  return (
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
      <div className="mx-1 h-5 w-px bg-border/50" />
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
                  : "cursor-not-allowed text-muted-foreground/30"
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
  );
}
