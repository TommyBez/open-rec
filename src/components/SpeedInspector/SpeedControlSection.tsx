import { RotateCcw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SpeedControlSectionProps {
  speed: number;
  isSlowMotion: boolean;
  isFastForward: boolean;
  onSpeedChange: (values: number[]) => void;
  onSpeedCommit: (values: number[]) => void;
  onResetSpeed: () => void;
}

export function SpeedControlSection({
  speed,
  isSlowMotion,
  isFastForward,
  onSpeedChange,
  onSpeedCommit,
  onResetSpeed,
}: SpeedControlSectionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Playback Speed
        </label>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-mono text-xs",
              isSlowMotion && "text-blue-400",
              isFastForward && "text-orange-400",
              !isSlowMotion && !isFastForward && "text-foreground/70"
            )}
          >
            {speed.toFixed(2)}x
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onResetSpeed}
                className={cn(
                  "flex size-6 items-center justify-center rounded-md transition-colors",
                  speed === 1
                    ? "cursor-not-allowed text-muted-foreground/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                disabled={speed === 1}
              >
                <RotateCcw className="size-3.5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Reset to 1x</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <Slider
        value={[speed]}
        min={0.25}
        max={4}
        step={0.05}
        onValueChange={onSpeedChange}
        onValueCommit={onSpeedCommit}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground/50">
        <span>0.25x</span>
        <span>1x</span>
        <span>4x</span>
      </div>
    </div>
  );
}
