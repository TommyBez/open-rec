import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TransportSectionProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
}

export function TransportSection({
  isPlaying,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
}: TransportSectionProps) {
  return (
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
              <Play className="ml-0.5 size-5" strokeWidth={1.75} />
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
  );
}
