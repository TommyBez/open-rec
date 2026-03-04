import { FolderOpen } from "lucide-react";
import { BrandLogo } from "../../../components/BrandLogo";
import { StatusIndicator } from "../../../components/StatusIndicator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RecorderHeaderProps {
  ready: boolean;
  onOpenVideos: () => void;
}

export function RecorderHeader({ ready, onOpenVideos }: RecorderHeaderProps) {
  return (
    <header className="relative z-10 mb-6 flex items-center justify-between animate-fade-up">
      <BrandLogo />
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
        <StatusIndicator ready={ready} />
      </div>
    </header>
  );
}
