import { useRef, useEffect, useState } from "react";
import { Scissors, ZoomIn, Gauge, Trash2, Plus, Minus, Film, Sparkles, Timer } from "lucide-react";
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
  onToggleSegment?: (segmentId: string) => void;
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
  onToggleSegment,
  onDeleteZoom,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Generate time markers
  const markers: { time: number; label: string }[] = [];
  const interval = duration > 300 ? 60 : duration > 60 ? 30 : 10;
  for (let t = 0; t <= duration; t += interval) {
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
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(Math.max(0, Math.min(duration, newTime)));
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
    e.stopPropagation();
    if (onToggleSegment) {
      onToggleSegment(segmentId);
    }
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

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 border-t border-border/50 bg-card/30 px-4 pb-4 pt-3 backdrop-blur-sm">
      {/* Time markers */}
      <div className="relative mb-1 h-5">
        {markers.map((marker) => (
          <div
            key={marker.time}
            className="absolute -translate-x-1/2"
            style={{ left: `${(marker.time / duration) * 100}%` }}
          >
            <span className="font-mono text-[10px] text-muted-foreground/50">{marker.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline tracks */}
      <div
        ref={timelineRef}
        className="relative flex min-h-[120px] cursor-pointer flex-col gap-2"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Clip track */}
        <TrackRow label="Clips" icon={<Film className="size-3.5" strokeWidth={1.75} />}>
          <div className="relative h-full w-full overflow-hidden rounded-lg bg-gradient-to-r from-primary/10 to-primary/5">
            {segments.map((segment) => (
              <div
                key={segment.id}
                className={cn(
                  "absolute flex h-full cursor-grab items-center justify-between rounded-md px-3 transition-all active:cursor-grabbing",
                  "bg-gradient-to-r from-primary/80 to-primary/60 border border-primary/30",
                  !segment.enabled && "opacity-40"
                )}
                style={{
                  left: `${(segment.startTime / duration) * 100}%`,
                  width: `${((segment.endTime - segment.startTime) / duration) * 100}%`,
                }}
                onClick={(e) => handleSegmentClick(e, segment.id)}
                title={segment.enabled ? "Click to disable segment" : "Click to enable segment"}
              >
                <span className="text-[11px] font-medium text-primary-foreground">Clip</span>
                <span className="font-mono text-[10px] text-primary-foreground/70">
                  {Math.round(segment.endTime - segment.startTime)}s
                </span>
              </div>
            ))}
          </div>
        </TrackRow>

        {/* Zoom track */}
        <TrackRow label="Zoom" icon={<Sparkles className="size-3.5" strokeWidth={1.75} />}>
          <div className="relative h-full w-full overflow-hidden rounded-lg bg-muted/30">
            {zoom.length > 0 ? (
              zoom.map((effect) => (
                <div
                  key={effect.id}
                  className="group/zoom absolute flex h-full cursor-grab items-center justify-between rounded-md border border-violet-500/30 bg-gradient-to-r from-violet-600/80 to-violet-700/60 px-3"
                  style={{
                    left: `${(effect.startTime / duration) * 100}%`,
                    width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
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
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
                <span>No zoom effects</span>
              </div>
            )}
          </div>
        </TrackRow>

        {/* Speed track */}
        <TrackRow label="Speed" icon={<Timer className="size-3.5" strokeWidth={1.75} />}>
          <div className="relative h-full w-full overflow-hidden rounded-lg bg-muted/30">
            {speed.length > 0 ? (
              speed.map((effect) => (
                <div
                  key={effect.id}
                  className="absolute flex h-full cursor-grab items-center justify-between rounded-md border border-accent/30 bg-gradient-to-r from-accent/80 to-accent/60 px-3"
                  style={{
                    left: `${(effect.startTime / duration) * 100}%`,
                    width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
                  }}
                >
                  <span className="text-[11px] font-medium text-accent-foreground">Speed</span>
                  <span className="font-mono text-[10px] text-accent-foreground/70">{effect.speed}x</span>
                </div>
              ))
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground/40">
                <span>No speed effects</span>
              </div>
            )}
          </div>
        </TrackRow>

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
   Sub-component: Track Row
   ============================================ */

function TrackRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-10 items-stretch gap-2">
      {/* Track label */}
      <div className="flex w-16 shrink-0 items-center gap-1.5 text-muted-foreground/60">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      {/* Track content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
