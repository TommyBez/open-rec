import { cn } from "@/lib/utils";

interface SpeedEffectSummaryProps {
  speed: number;
  isSlowMotion: boolean;
  isFastForward: boolean;
}

export function SpeedEffectSummary({
  speed,
  isSlowMotion,
  isFastForward,
}: SpeedEffectSummaryProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Effect</span>
        <span
          className={cn(
            "font-medium",
            isSlowMotion && "text-blue-400",
            isFastForward && "text-orange-400",
            !isSlowMotion && !isFastForward && "text-muted-foreground"
          )}
        >
          {isSlowMotion ? "Slow Motion" : isFastForward ? "Fast Forward" : "Normal"}
        </span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Duration change</span>
        <span className="font-mono text-foreground/70">
          {speed !== 0 ? `${(100 / speed).toFixed(0)}%` : "—"}
        </span>
      </div>
    </div>
  );
}
