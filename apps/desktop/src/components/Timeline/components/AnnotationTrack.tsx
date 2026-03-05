import { cn } from "@/lib/utils";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Annotation } from "../../../types/project";

interface AnnotationTrackProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  timelineDuration: number;
  sourceToDisplayTime: (sourceTime: number) => number;
  draggingId: string | null;
  localOverride: { id: string; startTime: number; endTime: number } | null;
  onAnnotationClick: (event: ReactMouseEvent, annotationId: string) => void;
  onAnnotationMouseDown: (
    event: ReactMouseEvent,
    annotationId: string,
    mode: "move" | "resize-start" | "resize-end"
  ) => void;
}

function getAnnotationLabel(mode: Annotation["mode"]) {
  if (mode === "blur") return "Blur";
  if (mode === "text") return "Text";
  if (mode === "arrow") return "Arrow";
  return "Box";
}

function getAnnotationClass(mode: Annotation["mode"]) {
  if (mode === "blur") return "bg-gradient-to-r from-slate-500/90 to-slate-600/80";
  if (mode === "text") return "bg-gradient-to-r from-indigo-500/90 to-violet-600/80";
  if (mode === "arrow") return "bg-gradient-to-r from-rose-500/90 to-red-600/80";
  return "bg-gradient-to-r from-amber-500/90 to-amber-600/80";
}

export function AnnotationTrack({
  annotations,
  selectedAnnotationId,
  timelineDuration,
  sourceToDisplayTime,
  draggingId,
  localOverride,
  onAnnotationClick,
  onAnnotationMouseDown,
}: AnnotationTrackProps) {
  if (annotations.length === 0) return null;

  return (
    <div className="relative h-10 w-full overflow-hidden rounded-lg bg-amber-500/10">
      {annotations.map((annotation) => {
        const isDraggingThis = draggingId === annotation.id;
        const annotationTimes =
          isDraggingThis && localOverride
            ? { startTime: localOverride.startTime, endTime: localOverride.endTime }
            : { startTime: annotation.startTime, endTime: annotation.endTime };
        const displayStart = sourceToDisplayTime(annotationTimes.startTime);
        const displayEnd = sourceToDisplayTime(annotationTimes.endTime);
        const width = Math.max(0.4, displayEnd - displayStart);
        const isSelected = selectedAnnotationId === annotation.id;
        const mode = annotation.mode ?? "outline";

        return (
          <div
            key={annotation.id}
            className={cn(
              "group/annotation absolute flex h-full select-none items-center justify-between overflow-hidden rounded-md border px-2 text-left text-[11px] font-medium text-amber-50",
              getAnnotationClass(mode),
              !isDraggingThis && "transition-all",
              isSelected
                ? "border-white ring-2 ring-white ring-offset-1 ring-offset-background"
                : "border-amber-300/30",
              isDraggingThis && "opacity-90"
            )}
            style={{
              left: `${(displayStart / timelineDuration) * 100}%`,
              width: `${(width / timelineDuration) * 100}%`,
              willChange: isDraggingThis ? "left, width" : "auto",
            }}
            onClick={(event) => onAnnotationClick(event, annotation.id)}
            title="Annotation range (drag to move)"
          >
            <div
              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
              onMouseDown={(event) => onAnnotationMouseDown(event, annotation.id, "resize-start")}
            />
            <div
              className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
              onMouseDown={(event) => onAnnotationMouseDown(event, annotation.id, "move")}
            />
            <div
              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
              onMouseDown={(event) => onAnnotationMouseDown(event, annotation.id, "resize-end")}
            />
            <span className="pointer-events-none">{getAnnotationLabel(mode)}</span>
          </div>
        );
      })}
    </div>
  );
}
