import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ZoomIn, Film, Timer } from "lucide-react";
import type { Segment, ZoomEffect, SpeedEffect, Annotation } from "../../types/project";
import { cn } from "@/lib/utils";
import { useTimelineDisplayMetrics } from "./hooks/useTimelineDisplayMetrics";
import { useRangeTrackDrag } from "./hooks/useRangeTrackDrag";

interface TimelineProps {
  duration: number;
  currentTime: number;
  segments: Segment[];
  zoom: ZoomEffect[];
  speed?: SpeedEffect[];
  annotations?: Annotation[];
  screenWaveform?: number[];
  microphoneWaveform?: number[];
  onSeek: (time: number) => void;
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  selectedZoomId: string | null;
  onSelectZoom: (zoomId: string | null) => void;
  onUpdateZoom?: (zoomId: string, updates: Partial<ZoomEffect>) => void;
  selectedSpeedId: string | null;
  onSelectSpeed: (speedId: string | null) => void;
  onUpdateSpeed?: (speedId: string, updates: Partial<SpeedEffect>) => void;
  selectedAnnotationId: string | null;
  onSelectAnnotation: (annotationId: string | null) => void;
  onUpdateAnnotation?: (annotationId: string, updates: Partial<Annotation>) => void;
}

export function Timeline({
  duration,
  currentTime,
  segments,
  zoom,
  speed = [],
  annotations = [],
  screenWaveform = [],
  microphoneWaveform = [],
  onSeek,
  selectedTool,
  selectedSegmentId,
  onSelectSegment,
  selectedZoomId,
  onSelectZoom,
  onUpdateZoom,
  selectedSpeedId,
  onSelectSpeed,
  onUpdateSpeed,
  selectedAnnotationId,
  onSelectAnnotation,
  onUpdateAnnotation,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    segmentDisplayInfo,
    timelineDuration,
    sourceToDisplayTime,
    displayToSourceTime,
    getSnappedDisplayTime,
    markers,
  } = useTimelineDisplayMetrics(segments, duration);

  const buildWaveformBars = useCallback(
    (waveform: number[]) => {
      if (waveform.length === 0 || timelineDuration <= 0 || duration <= 0) {
        return [];
      }
      const bars = Math.min(180, waveform.length);
      return new Array(bars).fill(0).map((_, index) => {
        const ratio = bars > 1 ? index / (bars - 1) : 0;
        const displayTime = ratio * timelineDuration;
        const sourceTime = displayToSourceTime(displayTime);
        const sourceRatio = Math.max(0, Math.min(1, sourceTime / duration));
        const sampleIndex = Math.min(
          waveform.length - 1,
          Math.floor(sourceRatio * (waveform.length - 1))
        );
        return {
          id: `${index}-${sampleIndex}`,
          leftPercent: ratio * 100,
          amplitude: waveform[sampleIndex] ?? 0,
        };
      });
    },
    [displayToSourceTime, duration, timelineDuration]
  );

  const screenWaveformBars = useMemo(
    () => buildWaveformBars(screenWaveform),
    [buildWaveformBars, screenWaveform]
  );
  const microphoneWaveformBars = useMemo(
    () => buildWaveformBars(microphoneWaveform),
    [buildWaveformBars, microphoneWaveform]
  );

  const zoomDrag = useRangeTrackDrag({
    items: zoom,
    timelineRef,
    timelineDuration,
    duration,
    minDuration: 0.5,
    sourceToDisplayTime,
    displayToSourceTime,
    getSnappedDisplayTime,
    onCommit: onUpdateZoom,
    onDraggedSelectionReset: () => onSelectZoom(null),
  });

  const speedDrag = useRangeTrackDrag({
    items: speed,
    timelineRef,
    timelineDuration,
    duration,
    minDuration: 0.5,
    sourceToDisplayTime,
    displayToSourceTime,
    getSnappedDisplayTime,
    onCommit: onUpdateSpeed,
    onDraggedSelectionReset: () => onSelectSpeed(null),
  });

  const annotationDrag = useRangeTrackDrag({
    items: annotations,
    timelineRef,
    timelineDuration,
    duration,
    minDuration: 0.1,
    sourceToDisplayTime,
    displayToSourceTime,
    getSnappedDisplayTime,
    onCommit: onUpdateAnnotation,
    onDraggedSelectionReset: () => onSelectAnnotation(null),
  });

  function handleTimelineClick(e: React.MouseEvent) {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    // Calculate display time from click position
    const rawDisplayTime = percentage * timelineDuration;
    const displayTime = getSnappedDisplayTime(rawDisplayTime);
    
    // Convert display time to source time for seeking/cutting
    const sourceTime = displayToSourceTime(displayTime);
    
    onSeek(sourceTime);
    // Deselect all when clicking on timeline background
    onSelectSegment(null);
    onSelectZoom(null);
    onSelectSpeed(null);
    onSelectAnnotation(null);
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    handleTimelineClick(e);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isDragging) {
      handleTimelineClick(e);
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleSegmentClick(e: React.MouseEvent, segmentId: string) {
    // If any tool is selected, let the click propagate to perform the action
    if (selectedTool !== null) {
      return; // Don't stop propagation, let timeline handle the action
    }
    e.stopPropagation();
    // Selection mode: toggle selection - clicking the same segment deselects it
    onSelectSegment(selectedSegmentId === segmentId ? null : segmentId);
  }

  function handleSegmentMouseDown(e: React.MouseEvent) {
    // If any tool is selected, let the mousedown propagate to perform the action
    if (selectedTool !== null) {
      return; // Don't stop propagation
    }
    e.stopPropagation();
  }

  const handleZoomClick = useCallback(
    (event: React.MouseEvent, zoomId: string) =>
      zoomDrag.handleItemClick(event, zoomId, onSelectZoom),
    [onSelectZoom, zoomDrag]
  );
  const handleSpeedClick = useCallback(
    (event: React.MouseEvent, speedId: string) =>
      speedDrag.handleItemClick(event, speedId, onSelectSpeed),
    [onSelectSpeed, speedDrag]
  );
  const handleAnnotationClick = useCallback(
    (event: React.MouseEvent, annotationId: string) =>
      annotationDrag.handleItemClick(event, annotationId, (id) => {
        onSelectAnnotation(selectedAnnotationId === id ? null : id);
      }),
    [annotationDrag, onSelectAnnotation, selectedAnnotationId]
  );

  useEffect(() => {
    function handleGlobalMouseUp() {
      setIsDragging(false);
      zoomDrag.handleGlobalMouseUp();
      speedDrag.handleGlobalMouseUp();
      annotationDrag.handleGlobalMouseUp();
    }
    
    function handleGlobalMouseMove(e: MouseEvent) {
      zoomDrag.handleGlobalMouseMove(e);
      speedDrag.handleGlobalMouseMove(e);
      annotationDrag.handleGlobalMouseMove(e);
    }
    
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [
    annotationDrag.handleGlobalMouseMove,
    annotationDrag.handleGlobalMouseUp,
    speedDrag.handleGlobalMouseMove,
    speedDrag.handleGlobalMouseUp,
    zoomDrag.handleGlobalMouseMove,
    zoomDrag.handleGlobalMouseUp,
  ]);

  // Convert source time to display time for playhead position
  const displayTime = sourceToDisplayTime(currentTime);
  const playheadPosition = timelineDuration > 0 ? (displayTime / timelineDuration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 border-t border-border/50 bg-card/30 px-4 pb-4 pt-3 backdrop-blur-sm">
      {/* Time markers - aligned with track content (w-16 label + gap-2 = 72px) */}
      <div className="relative mb-1 ml-[72px] h-5">
        {markers.map((marker) => (
          <div
            key={marker.time}
            className="absolute -translate-x-1/2"
            style={{ left: `${(marker.time / timelineDuration) * 100}%` }}
          >
            <span className="font-mono text-[10px] text-muted-foreground/50">{marker.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline tracks - two column layout */}
      <div className="flex gap-2">
        {/* Labels column */}
        <div className="flex w-16 shrink-0 flex-col gap-2">
          <TrackLabel icon={<Film className="size-3.5" strokeWidth={1.75} />} label="Clips" />
          <TrackLabel icon={<ZoomIn className="size-3.5" strokeWidth={1.75} />} label="Zoom" />
          <TrackLabel icon={<Timer className="size-3.5" strokeWidth={1.75} />} label="Speed" />
          {annotations.length > 0 && <TrackLabel icon={<Timer className="size-3.5" strokeWidth={1.75} />} label="Annot" />}
          {screenWaveformBars.length > 0 && <TrackLabel icon={<Film className="size-3.5" strokeWidth={1.75} />} label="Sys Aud" />}
          {microphoneWaveformBars.length > 0 && <TrackLabel icon={<Film className="size-3.5" strokeWidth={1.75} />} label="Mic Aud" />}
        </div>

        {/* Content column - this is the interactive area */}
        <div
          ref={timelineRef}
          className={cn(
            "relative flex flex-1 flex-col gap-2",
            selectedTool ? "cursor-crosshair" : "cursor-pointer"
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          {/* Clip track */}
          <div className="relative h-10 w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 to-primary/5">
            {segments.filter((s) => s.enabled).map((segment) => {
              const isSelected = selectedSegmentId === segment.id;
              const displayInfo = segmentDisplayInfo.get(segment.id);
              if (!displayInfo) return null;
              
              // Use clamped duration (ensures segment doesn't exceed video bounds)
              const segmentDuration = displayInfo.clampedEnd - displayInfo.clampedStart;
              
              // Determine cursor and title based on selected tool
              const cursorClass = selectedTool ? "cursor-crosshair" : "cursor-pointer";
              const titleText = selectedTool === "cut" 
                ? "Click to cut here" 
                : selectedTool === "zoom"
                ? "Click to add zoom effect"
                : selectedTool === "speed"
                ? "Click to add speed effect"
                : selectedTool === "annotation"
                ? "Click to add annotation"
                : "Click to select segment";
              
              return (
                <div
                  key={segment.id}
                  className={cn(
                    "group/segment absolute flex h-full items-center justify-between overflow-hidden rounded-md px-3 transition-all",
                    "bg-gradient-to-r from-primary/80 to-primary/60 border border-primary/30",
                    isSelected && "ring-2 ring-white ring-offset-1 ring-offset-background",
                    cursorClass
                  )}
                  style={{
                    left: `${(displayInfo.displayStart / timelineDuration) * 100}%`,
                    width: `${(segmentDuration / timelineDuration) * 100}%`,
                  }}
                  onMouseDown={handleSegmentMouseDown}
                  onClick={(e) => handleSegmentClick(e, segment.id)}
                  title={titleText}
                >
                  <span className="min-w-0 truncate text-[11px] font-medium text-primary-foreground">Clip</span>
                  <span className="min-w-0 shrink-0 font-mono text-[10px] text-primary-foreground/70">
                    {Math.round(segmentDuration)}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Zoom track */}
          <div className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/30">
            {zoom.length > 0 ? (
              zoom.map((effect) => {
                const isDraggingThis = zoomDrag.draggingId === effect.id;
                
                // Use local override for the element being dragged (smooth visual feedback)
                const effectTimes = isDraggingThis && zoomDrag.localOverride
                  ? { startTime: zoomDrag.localOverride.startTime, endTime: zoomDrag.localOverride.endTime }
                  : { startTime: effect.startTime, endTime: effect.endTime };
                
                // Convert zoom effect times to display positions
                const displayStart = sourceToDisplayTime(effectTimes.startTime);
                const displayEnd = sourceToDisplayTime(effectTimes.endTime);
                const isSelected = selectedZoomId === effect.id;
                
                return (
                  <div
                    key={effect.id}
                    className={cn(
                      "group/zoom absolute flex h-full items-center justify-between overflow-hidden rounded-md border px-3 select-none",
                      "bg-gradient-to-r from-violet-600/80 to-violet-700/60",
                      // Only apply transitions when NOT dragging for instant visual feedback
                      !isDraggingThis && "transition-all",
                      isSelected 
                        ? "border-white ring-2 ring-white ring-offset-1 ring-offset-background" 
                        : "border-violet-500/30",
                      isDraggingThis && "opacity-90"
                    )}
                    style={{
                      left: `${(displayStart / timelineDuration) * 100}%`,
                      width: `${((displayEnd - displayStart) / timelineDuration) * 100}%`,
                      // Use transform for GPU-accelerated positioning during drag
                      willChange: isDraggingThis ? 'left, width' : 'auto',
                    }}
                    onClick={(e) => handleZoomClick(e, effect.id)}
                  >
                    {/* Left resize handle */}
                    <div
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(e) => zoomDrag.handleItemMouseDown(e, effect.id, "resize-start")}
                    />
                    
                    {/* Center drag area */}
                    <div
                      className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => zoomDrag.handleItemMouseDown(e, effect.id, "move")}
                    />
                    
                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(e) => zoomDrag.handleItemMouseDown(e, effect.id, "resize-end")}
                    />
                    
                    {/* Content (non-interactive, pointer-events-none) */}
                    <span className="pointer-events-none min-w-0 truncate text-[11px] font-medium text-white">Zoom</span>
                    <span className="pointer-events-none min-w-0 shrink-0 font-mono text-[10px] text-white/70">{effect.scale}x</span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
                <span>No zoom effects</span>
              </div>
            )}
          </div>

          {annotations.length > 0 && (
            <div className="relative h-10 w-full overflow-hidden rounded-lg bg-amber-500/10">
              {annotations.map((annotation) => {
                const isDraggingThis = annotationDrag.draggingId === annotation.id;
                const mode = annotation.mode ?? "outline";
                const annotationTimes =
                  isDraggingThis && annotationDrag.localOverride
                    ? {
                        startTime: annotationDrag.localOverride.startTime,
                        endTime: annotationDrag.localOverride.endTime,
                      }
                    : {
                        startTime: annotation.startTime,
                        endTime: annotation.endTime,
                      };
                const displayStart = sourceToDisplayTime(annotationTimes.startTime);
                const displayEnd = sourceToDisplayTime(annotationTimes.endTime);
                const width = Math.max(0.4, displayEnd - displayStart);
                const isSelected = selectedAnnotationId === annotation.id;
                return (
                  <div
                    key={annotation.id}
                    className={cn(
                      "group/annotation absolute flex h-full items-center justify-between overflow-hidden rounded-md border px-2 text-left text-[11px] font-medium text-amber-50 select-none",
                      mode === "blur"
                        ? "bg-gradient-to-r from-slate-500/90 to-slate-600/80"
                        : mode === "text"
                        ? "bg-gradient-to-r from-indigo-500/90 to-violet-600/80"
                        : mode === "arrow"
                        ? "bg-gradient-to-r from-rose-500/90 to-red-600/80"
                        : "bg-gradient-to-r from-amber-500/90 to-amber-600/80",
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
                    onClick={(event) => handleAnnotationClick(event, annotation.id)}
                    title="Annotation range (drag to move)"
                  >
                    <div
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(event) =>
                        annotationDrag.handleItemMouseDown(event, annotation.id, "resize-start")
                      }
                    />
                    <div
                      className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
                      onMouseDown={(event) =>
                        annotationDrag.handleItemMouseDown(event, annotation.id, "move")
                      }
                    />
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(event) =>
                        annotationDrag.handleItemMouseDown(event, annotation.id, "resize-end")
                      }
                    />
                    <span className="pointer-events-none">
                      {mode === "blur"
                        ? "Blur"
                        : mode === "text"
                        ? "Text"
                        : mode === "arrow"
                        ? "Arrow"
                        : "Box"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Speed track */}
          <div className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/30">
            {speed.length > 0 ? (
              speed.map((effect) => {
                const isDraggingThis = speedDrag.draggingId === effect.id;
                
                // Use local override for the element being dragged (smooth visual feedback)
                const effectTimes = isDraggingThis && speedDrag.localOverride
                  ? { startTime: speedDrag.localOverride.startTime, endTime: speedDrag.localOverride.endTime }
                  : { startTime: effect.startTime, endTime: effect.endTime };
                
                // Convert speed effect times to display positions
                const displayStart = sourceToDisplayTime(effectTimes.startTime);
                const displayEnd = sourceToDisplayTime(effectTimes.endTime);
                const isSelected = selectedSpeedId === effect.id;
                
                return (
                  <div
                    key={effect.id}
                    className={cn(
                      "group/speed absolute flex h-full items-center justify-between overflow-hidden rounded-md border px-3 select-none",
                      "bg-gradient-to-r from-accent/80 to-accent/60",
                      // Only apply transitions when NOT dragging for instant visual feedback
                      !isDraggingThis && "transition-all",
                      isSelected 
                        ? "border-white ring-2 ring-white ring-offset-1 ring-offset-background" 
                        : "border-accent/30",
                      isDraggingThis && "opacity-90"
                    )}
                    style={{
                      left: `${(displayStart / timelineDuration) * 100}%`,
                      width: `${((displayEnd - displayStart) / timelineDuration) * 100}%`,
                      // Use transform for GPU-accelerated positioning during drag
                      willChange: isDraggingThis ? 'left, width' : 'auto',
                    }}
                    onClick={(e) => handleSpeedClick(e, effect.id)}
                  >
                    {/* Left resize handle */}
                    <div
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(e) => speedDrag.handleItemMouseDown(e, effect.id, "resize-start")}
                    />
                    
                    {/* Center drag area */}
                    <div
                      className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => speedDrag.handleItemMouseDown(e, effect.id, "move")}
                    />
                    
                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(e) => speedDrag.handleItemMouseDown(e, effect.id, "resize-end")}
                    />
                    
                    {/* Content (non-interactive, pointer-events-none) */}
                    <span className="pointer-events-none min-w-0 truncate text-[11px] font-medium text-accent-foreground">Speed</span>
                    <span className="pointer-events-none min-w-0 shrink-0 font-mono text-[10px] text-accent-foreground/70">{effect.speed}x</span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
                <span>No speed effects</span>
              </div>
            )}
          </div>

          {screenWaveformBars.length > 0 && (
            <WaveformTrack
              bars={screenWaveformBars}
              barClassName="bg-sky-400/70"
              trackClassName="bg-sky-500/10"
            />
          )}

          {microphoneWaveformBars.length > 0 && (
            <WaveformTrack
              bars={microphoneWaveformBars}
              barClassName="bg-emerald-400/70"
              trackClassName="bg-emerald-500/10"
            />
          )}

          {/* Playhead */}
          <div
            className="pointer-events-none absolute inset-y-0 z-10"
            style={{ left: `${playheadPosition}%` }}
          >
            {/* Playhead head - triangle */}
            <div 
              className="absolute -top-1 left-1/2 size-3 -translate-x-1/2 bg-primary shadow-[0_0_8px_oklch(0.62_0.24_25_/_0.6)]" 
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)' }}
            />
            {/* Playhead line */}
            <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary shadow-[0_0_6px_oklch(0.62_0.24_25_/_0.5)]" />
          </div>
        </div>
      </div>

    </div>
  );
}

/* ============================================
   Sub-component: Track Label
   ============================================ */

function TrackLabel({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex h-10 items-center gap-1.5 text-muted-foreground/60">
      {icon}
      <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}

function WaveformTrack({
  bars,
  barClassName,
  trackClassName,
}: {
  bars: Array<{ id: string; leftPercent: number; amplitude: number }>;
  barClassName: string;
  trackClassName: string;
}) {
  return (
    <div className={cn("relative h-10 w-full overflow-hidden rounded-lg", trackClassName)}>
      {bars.map((bar) => {
        const heightPercent = Math.max(8, Math.min(100, bar.amplitude * 100));
        return (
          <div
            key={bar.id}
            className={cn("absolute bottom-0 w-[0.9%] rounded-full opacity-90", barClassName)}
            style={{
              left: `${bar.leftPercent}%`,
              height: `${heightPercent}%`,
            }}
          />
        );
      })}
    </div>
  );
}
