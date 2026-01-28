import { memo } from "react";
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
  onBack: () => void;
  onExport: () => void;
  onOpenVideos: () => void;
}

export const EditorHeader = memo(function EditorHeader({
  projectName,
  isDirty,
  onBack,
  onExport,
  onOpenVideos,
}: EditorHeaderProps) {
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
          <span className="text-sm font-medium text-foreground/80">{projectName}</span>
          {isDirty && (
            <span className="text-xl leading-none text-accent">•</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
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
