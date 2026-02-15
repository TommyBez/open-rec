import { X, ZoomIn } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ZoomInspectorHeaderProps {
  onClose: () => void;
}

export function ZoomInspectorHeader({ onClose }: ZoomInspectorHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-md bg-violet-600/20">
          <ZoomIn className="size-3.5 text-violet-400" strokeWidth={2} />
        </div>
        <span className="text-sm font-medium text-foreground/80">Zoom Effect</span>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Close inspector</TooltipContent>
      </Tooltip>
    </div>
  );
}
