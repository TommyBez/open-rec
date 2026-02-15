import { ArrowLeft, FolderOpen, Video } from "lucide-react";
import { ActiveExportBadge } from "@/components/ActiveExportBadge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VideoSelectionHeaderProps {
  cameFromEditor: boolean;
  isBatchExporting: boolean;
  selectionMode: boolean;
  activeExportCount: number;
  onBack: () => void;
  onGoToRecorder: () => void;
  onToggleSelectionMode: () => void;
}

export function VideoSelectionHeader({
  cameFromEditor,
  isBatchExporting,
  selectionMode,
  activeExportCount,
  onBack,
  onGoToRecorder,
  onToggleSelectionMode,
}: VideoSelectionHeaderProps) {
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
          <TooltipContent>{cameFromEditor ? "Back to editor" : "Back to recorder"}</TooltipContent>
        </Tooltip>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <FolderOpen className="size-4 text-primary" strokeWidth={1.75} />
          </div>
          <span className="text-sm font-medium text-foreground/80">My Recordings</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onGoToRecorder}
          disabled={isBatchExporting}
          className="gap-2"
        >
          <Video className="size-4" strokeWidth={1.75} />
          New Recording
        </Button>
        <Button
          variant={selectionMode ? "default" : "outline"}
          size="sm"
          disabled={isBatchExporting}
          onClick={onToggleSelectionMode}
        >
          {selectionMode ? "Done Selecting" : "Batch Export"}
        </Button>
        <ActiveExportBadge activeExportCount={activeExportCount} />
      </div>
    </header>
  );
}
