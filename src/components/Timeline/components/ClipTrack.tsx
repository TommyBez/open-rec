import { cn } from "@/lib/utils";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Segment } from "../../../types/project";
import type { SegmentDisplayInfo } from "../hooks/useTimelineDisplayMetrics";

interface ClipTrackProps {
  segments: Segment[];
  selectedSegmentId: string | null;
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  timelineDuration: number;
  segmentDisplayInfo: Map<string, SegmentDisplayInfo>;
  onSegmentMouseDown: (event: ReactMouseEvent) => void;
  onSegmentClick: (event: ReactMouseEvent, segmentId: string) => void;
}

function getSegmentTitle(selectedTool: ClipTrackProps["selectedTool"]): string {
  if (selectedTool === "cut") return "Click to cut here";
  if (selectedTool === "zoom") return "Click to add zoom effect";
  if (selectedTool === "speed") return "Click to add speed effect";
  if (selectedTool === "annotation") return "Click to add annotation";
  return "Click to select segment";
}

export function ClipTrack({
  segments,
  selectedSegmentId,
  selectedTool,
  timelineDuration,
  segmentDisplayInfo,
  onSegmentMouseDown,
  onSegmentClick,
}: ClipTrackProps) {
  return (
    <div className="relative h-10 w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 to-primary/5">
      {segments
        .filter((segment) => segment.enabled)
        .map((segment) => {
          const isSelected = selectedSegmentId === segment.id;
          const displayInfo = segmentDisplayInfo.get(segment.id);
          if (!displayInfo) return null;
          const segmentDuration = displayInfo.clampedEnd - displayInfo.clampedStart;
          const cursorClass = selectedTool ? "cursor-crosshair" : "cursor-pointer";

          return (
            <div
              key={segment.id}
              className={cn(
                "group/segment absolute flex h-full items-center justify-between overflow-hidden rounded-md border border-primary/30 bg-gradient-to-r from-primary/80 to-primary/60 px-3 transition-all",
                isSelected && "ring-2 ring-white ring-offset-1 ring-offset-background",
                cursorClass
              )}
              style={{
                left: `${(displayInfo.displayStart / timelineDuration) * 100}%`,
                width: `${(segmentDuration / timelineDuration) * 100}%`,
              }}
              onMouseDown={onSegmentMouseDown}
              onClick={(event) => onSegmentClick(event, segment.id)}
              title={getSegmentTitle(selectedTool)}
            >
              <span className="min-w-0 truncate text-[11px] font-medium text-primary-foreground">
                Clip
              </span>
              <span className="min-w-0 shrink-0 font-mono text-[10px] text-primary-foreground/70">
                {Math.round(segmentDuration)}s
              </span>
            </div>
          );
        })}
    </div>
  );
}
