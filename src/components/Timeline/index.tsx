import { useRef, useEffect, useState, useMemo } from "react";
import { Scissors, ZoomIn, Gauge, Trash2, Plus, Minus, Film, Timer } from "lucide-react";
import type { Segment, ZoomEffect, SpeedEffect } from "../../types/project";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TimelineProps {
  duration: number;
  currentTime: number;
  segments: Segment[];
  zoom: ZoomEffect[];
  speed?: SpeedEffect[];
  onSeek: (time: number) => void;
  selectedTool: "cut" | "zoom" | "speed";
  onToolChange: (tool: "cut" | "zoom" | "speed") => void;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  onDeleteZoom?: (zoomId: string) => void;
}

const toolConfig = {
  cut: { icon: Scissors, label: "Cut" },
  zoom: { icon: ZoomIn, label: "Zoom" },
  speed: { icon: Gauge, label: "Speed" },
} as const;

export function Timeline({
  duration,
  currentTime,
  segments,
  zoom,
  speed = [],
  onSeek,
  selectedTool,
  onToolChange,
  selectedSegmentId,
  onSelectSegment,
  onDeleteZoom,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate display positions for segments (shifted left to fill gaps)
  const { segmentDisplayInfo, editedDuration, sourceToDisplayTime, displayToSourceTime } = useMemo(() => {
    // Sort segments by start time
    const sortedSegments = [...segments]
      .filter((s) => s.enabled)
      .sort((a, b) => a.startTime - b.startTime);
    
    // Calculate display positions (contiguous, no gaps)
    // Clamp segment times to video duration to handle invalid data
    let displayOffset = 0;
    const displayInfo = new Map<string, { displayStart: number; displayEnd: number; segment: Segment; clampedStart: number; clampedEnd: number }>();
    
    for (const seg of sortedSegments) {
      // Clamp segment times to valid range [0, duration]
      const clampedStart = Math.max(0, Math.min(seg.startTime, duration));
      const clampedEnd = Math.max(0, Math.min(seg.endTime, duration));
      const segDuration = Math.max(0, clampedEnd - clampedStart);
      
      if (segDuration > 0) {
        displayInfo.set(seg.id, {
          displayStart: displayOffset,
          displayEnd: displayOffset + segDuration,
          segment: seg,
          clampedStart,
          clampedEnd,
        });
        displayOffset += segDuration;
      }
    }
    
    // Total edited duration (use video duration if no valid segments)
    const totalEditedDuration = displayOffset > 0 ? displayOffset : duration;
    
    // Function to convert source time to display time
    const sourceToDisplay = (sourceTime: number): number => {
      let displayTime = 0;
      for (const seg of sortedSegments) {
        const info = displayInfo.get(seg.id);
        if (!info) continue;
        
        if (sourceTime >= info.clampedStart && sourceTime <= info.clampedEnd) {
          // Time is within this segment
          return info.displayStart + (sourceTime - info.clampedStart);
        } else if (sourceTime > info.clampedEnd) {
          // Time is after this segment, accumulate its duration
          displayTime = info.displayEnd;
        }
      }
      return displayTime;
    };
    
    // Function to convert display time back to source time
    const displayToSource = (displayTime: number): number => {
      for (const seg of sortedSegments) {
        const info = displayInfo.get(seg.id);
        if (!info) continue;
        
        if (displayTime >= info.displayStart && displayTime <= info.displayEnd) {
          // Display time is within this segment's display range
          const offsetInSegment = displayTime - info.displayStart;
          return info.clampedStart + offsetInSegment;
        }
      }
      // If beyond all segments, return the end of the last segment (clamped to duration)
      if (sortedSegments.length > 0) {
        const lastSeg = sortedSegments[sortedSegments.length - 1];
        const lastInfo = displayInfo.get(lastSeg.id);
        if (lastInfo) return lastInfo.clampedEnd;
      }
      return Math.min(displayTime, duration); // Fallback, clamped to duration
    };
    
    return {
      segmentDisplayInfo: displayInfo,
      editedDuration: totalEditedDuration,
      sourceToDisplayTime: sourceToDisplay,
      displayToSourceTime: displayToSource,
    };
  }, [segments, duration]);

  // Use edited duration for timeline display
  const timelineDuration = editedDuration;

  // Generate time markers based on edited duration
  const markers: { time: number; label: string }[] = [];
  const interval = timelineDuration > 300 ? 60 : timelineDuration > 60 ? 30 : 10;
  for (let t = 0; t <= timelineDuration; t += interval) {
    const mins = Math.floor(t / 60);
    const secs = t % 60;
    markers.push({
      time: t,
      label: `${mins}:${secs.toString().padStart(2, "0")}`,
    });
  }

  function handleTimelineClick(e: React.MouseEvent) {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    
    // Calculate display time from click position
    const displayTime = percentage * timelineDuration;
    
    // Convert display time to source time for seeking/cutting
    const sourceTime = displayToSourceTime(displayTime);
    
    onSeek(sourceTime);
    // Deselect segment when clicking on timeline background
    onSelectSegment(null);
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
    // If cut tool is selected, let the click propagate to perform the cut
    if (selectedTool === "cut") {
      return; // Don't stop propagation, let timeline handle the cut
    }
    e.stopPropagation();
    // Toggle selection - clicking the same segment deselects it
    onSelectSegment(selectedSegmentId === segmentId ? null : segmentId);
  }

  function handleSegmentMouseDown(e: React.MouseEvent) {
    // If cut tool is selected, let the mousedown propagate to perform the cut
    if (selectedTool === "cut") {
      return; // Don't stop propagation
    }
    e.stopPropagation();
  }

  function handleZoomDelete(e: React.MouseEvent, zoomId: string) {
    e.stopPropagation();
    if (onDeleteZoom) {
      onDeleteZoom(zoomId);
    }
  }

  useEffect(() => {
    function handleGlobalMouseUp() {
      setIsDragging(false);
    }
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

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
        </div>

        {/* Content column - this is the interactive area */}
        <div
          ref={timelineRef}
          className="relative flex flex-1 cursor-pointer flex-col gap-2"
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
              
              return (
                <div
                  key={segment.id}
                  className={cn(
                    "group/segment absolute flex h-full cursor-pointer items-center justify-between rounded-md px-3 transition-all",
                    "bg-gradient-to-r from-primary/80 to-primary/60 border border-primary/30",
                    isSelected && "ring-2 ring-white ring-offset-1 ring-offset-background",
                    selectedTool === "cut" && "cursor-crosshair"
                  )}
                  style={{
                    left: `${(displayInfo.displayStart / timelineDuration) * 100}%`,
                    width: `${(segmentDuration / timelineDuration) * 100}%`,
                  }}
                  onMouseDown={handleSegmentMouseDown}
                  onClick={(e) => handleSegmentClick(e, segment.id)}
                  title={selectedTool === "cut" ? "Click to cut here" : "Click to select segment"}
                >
                  <span className="text-[11px] font-medium text-primary-foreground">Clip</span>
                  <span className="font-mono text-[10px] text-primary-foreground/70">
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
                // Convert zoom effect times to display positions
                const displayStart = sourceToDisplayTime(effect.startTime);
                const displayEnd = sourceToDisplayTime(effect.endTime);
                return (
                  <div
                    key={effect.id}
                    className="group/zoom absolute flex h-full cursor-grab items-center justify-between rounded-md border border-violet-500/30 bg-gradient-to-r from-violet-600/80 to-violet-700/60 px-3"
                    style={{
                      left: `${(displayStart / timelineDuration) * 100}%`,
                      width: `${((displayEnd - displayStart) / timelineDuration) * 100}%`,
                    }}
                  >
                    <span className="text-[11px] font-medium text-white">Zoom</span>
                    <span className="font-mono text-[10px] text-white/70">{effect.scale}x</span>
                    <button
                      className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded opacity-0 transition-opacity hover:bg-white/10 group-hover/zoom:opacity-100"
                      onClick={(e) => handleZoomDelete(e, effect.id)}
                    >
                      <Trash2 className="size-3 text-white/70" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
                <span>No zoom effects</span>
              </div>
            )}
          </div>

          {/* Speed track */}
          <div className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/30">
            {speed.length > 0 ? (
              speed.map((effect) => {
                // Convert speed effect times to display positions
                const displayStart = sourceToDisplayTime(effect.startTime);
                const displayEnd = sourceToDisplayTime(effect.endTime);
                return (
                  <div
                    key={effect.id}
                    className="absolute flex h-full cursor-grab items-center justify-between rounded-md border border-accent/30 bg-gradient-to-r from-accent/80 to-accent/60 px-3"
                    style={{
                      left: `${(displayStart / timelineDuration) * 100}%`,
                      width: `${((displayEnd - displayStart) / timelineDuration) * 100}%`,
                    }}
                  >
                    <span className="text-[11px] font-medium text-accent-foreground">Speed</span>
                    <span className="font-mono text-[10px] text-accent-foreground/70">{effect.speed}x</span>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
                <span>No speed effects</span>
              </div>
            )}
          </div>

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

      {/* Timeline toolbar */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex gap-1">
          {(Object.keys(toolConfig) as Array<keyof typeof toolConfig>).map((tool) => {
            const { icon: Icon, label } = toolConfig[tool];
            return (
              <Tooltip key={tool}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onToolChange(tool)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                      selectedTool === tool
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" strokeWidth={1.75} />
                    {label}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {label} tool
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Minus className="size-4" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="min-w-[45px] text-center text-xs text-muted-foreground/60">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setScale(Math.min(4, scale + 0.25))}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Plus className="size-4" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
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
