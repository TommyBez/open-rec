import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface FocusPointControlProps {
  resolution: { width: number; height: number };
  isDraggingPad: boolean;
  handlePosX: number;
  handlePosY: number;
  draftX: number;
  draftY: number;
  onResetFocus: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: () => void;
  padRef: RefObject<HTMLDivElement | null>;
}

export function FocusPointControl({
  resolution,
  isDraggingPad,
  handlePosX,
  handlePosY,
  draftX,
  draftY,
  onResetFocus,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  padRef,
}: FocusPointControlProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Focus Point
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onResetFocus}
              className={cn(
                "flex size-6 items-center justify-center rounded-md transition-colors",
                draftX === 0 && draftY === 0
                  ? "cursor-not-allowed text-muted-foreground/30"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              disabled={draftX === 0 && draftY === 0}
            >
              <RotateCcw className="size-3.5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Reset to center</TooltipContent>
        </Tooltip>
      </div>

      <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/30">
        <AspectRatio ratio={resolution.width / resolution.height}>
          <div
            ref={padRef}
            className={cn(
              "relative size-full cursor-crosshair select-none",
              isDraggingPad && "cursor-grabbing"
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/30" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border/30" />
              <div className="absolute left-1/3 top-0 h-full w-px bg-border/15" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-border/15" />
              <div className="absolute left-0 top-1/3 h-px w-full bg-border/15" />
              <div className="absolute left-0 top-2/3 h-px w-full bg-border/15" />
            </div>
            <div
              className={cn(
                "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-400 bg-violet-500 shadow-lg transition-shadow",
                isDraggingPad ? "ring-4 ring-violet-400/30" : "hover:ring-2 hover:ring-violet-400/20"
              )}
              style={{ left: `${handlePosX * 100}%`, top: `${handlePosY * 100}%` }}
            />
          </div>
        </AspectRatio>
      </div>

      <div className="flex justify-between font-mono text-[10px] text-muted-foreground/50">
        <span>x: {Math.round(draftX)}px</span>
        <span>y: {Math.round(draftY)}px</span>
      </div>
    </div>
  );
}
