import { Download, FolderOpen, Keyboard, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActiveExportBadge } from "@/components/ActiveExportBadge";

interface HeaderActionsProps {
  onOpenVideos: () => void;
  onOpenInNewWindow: () => void;
  onExport: () => void;
  activeExportCount: number;
}

export function HeaderActions({
  onOpenVideos,
  onOpenInNewWindow,
  onExport,
  activeExportCount,
}: HeaderActionsProps) {
  return (
    <>
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
            onClick={onOpenInNewWindow}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Open in new window"
          >
            <SquareArrowOutUpRight className="size-4.5" strokeWidth={1.75} />
          </button>
        </TooltipTrigger>
        <TooltipContent>Open in new window (⌘⇧N)</TooltipContent>
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
            <p>⌘⇧N open window</p>
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
      <ActiveExportBadge activeExportCount={activeExportCount} />
    </>
  );
}
