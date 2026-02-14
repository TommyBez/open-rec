import { cn } from "@/lib/utils";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { ZoomEffect } from "../../../types/project";

interface ZoomTrackProps {
  zoom: ZoomEffect[];
  selectedZoomId: string | null;
  timelineDuration: number;
  sourceToDisplayTime: (sourceTime: number) => number;
  draggingId: string | null;
  localOverride: { id: string; startTime: number; endTime: number } | null;
  onZoomClick: (event: ReactMouseEvent, zoomId: string) => void;
  onZoomMouseDown: (
    event: ReactMouseEvent,
    zoomId: string,
    mode: "move" | "resize-start" | "resize-end"
  ) => void;
}

export function ZoomTrack({
  zoom,
  selectedZoomId,
  timelineDuration,
  sourceToDisplayTime,
  draggingId,
  localOverride,
  onZoomClick,
  onZoomMouseDown,
}: ZoomTrackProps) {
  if (zoom.length === 0) {
    return (
      <div className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/30">
        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
          <span>No zoom effects</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/30">
      {zoom.map((effect) => {
        const isDraggingThis = draggingId === effect.id;
        const effectTimes =
          isDraggingThis && localOverride
            ? { startTime: localOverride.startTime, endTime: localOverride.endTime }
            : { startTime: effect.startTime, endTime: effect.endTime };
        const displayStart = sourceToDisplayTime(effectTimes.startTime);
        const displayEnd = sourceToDisplayTime(effectTimes.endTime);
        const isSelected = selectedZoomId === effect.id;

        return (
          <div
            key={effect.id}
            className={cn(
              "group/zoom absolute flex h-full select-none items-center justify-between overflow-hidden rounded-md border bg-gradient-to-r from-violet-600/80 to-violet-700/60 px-3",
              !isDraggingThis && "transition-all",
              isSelected
                ? "border-white ring-2 ring-white ring-offset-1 ring-offset-background"
                : "border-violet-500/30",
              isDraggingThis && "opacity-90"
            )}
            style={{
              left: `${(displayStart / timelineDuration) * 100}%`,
              width: `${((displayEnd - displayStart) / timelineDuration) * 100}%`,
              willChange: isDraggingThis ? "left, width" : "auto",
            }}
            onClick={(event) => onZoomClick(event, effect.id)}
          >
            <div
              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
              onMouseDown={(event) => onZoomMouseDown(event, effect.id, "resize-start")}
            />
            <div
              className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
              onMouseDown={(event) => onZoomMouseDown(event, effect.id, "move")}
            />
            <div
              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
              onMouseDown={(event) => onZoomMouseDown(event, effect.id, "resize-end")}
            />
            <span className="pointer-events-none min-w-0 truncate text-[11px] font-medium text-white">
              Zoom
            </span>
            <span className="pointer-events-none min-w-0 shrink-0 font-mono text-[10px] text-white/70">
              {effect.scale}x
            </span>
          </div>
        );
      })}
    </div>
  );
}
