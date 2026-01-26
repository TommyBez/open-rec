import { useRef, useEffect, useState } from "react";
import { Scissors, ZoomIn, Gauge, Trash2, Plus, Minus } from "lucide-react";
import { Segment, ZoomEffect, SpeedEffect } from "../../types/project";
import { Button } from "@/components/ui/button";
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
    <div className="flex flex-col gap-1 border-t border-[#333] bg-[#1e1e1e] px-4 pb-4 pt-2">
      {/* Time markers */}
      <div className="relative mb-1 h-6">
        {markers.map((marker) => (
          <div
            key={marker.time}
            className="absolute -translate-x-1/2"
            style={{ left: `${(marker.time / duration) * 100}%` }}
          >
            <span className="font-mono text-[11px] text-[#666]">{marker.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline tracks */}
      <div
        ref={timelineRef}
        className="relative flex min-h-[100px] cursor-pointer flex-col gap-2"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Clip track */}
        <div className="relative h-10 overflow-hidden rounded-md bg-gradient-to-r from-[#1e4a6e] to-[#1e5a7e]">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={cn(
                "absolute flex h-full cursor-grab items-center justify-between rounded px-3 transition-opacity active:cursor-grabbing",
                "bg-gradient-to-r from-blue-500 to-blue-600",
                !segment.enabled && "opacity-40"
              )}
              style={{
                left: `${(segment.startTime / duration) * 100}%`,
                width: `${((segment.endTime - segment.startTime) / duration) * 100}%`,
              }}
              onClick={(e) => handleSegmentClick(e, segment.id)}
              title={segment.enabled ? "Click to disable segment" : "Click to enable segment"}
            >
              <span className="text-xs font-medium text-white">Clip</span>
              <span className="font-mono text-[11px] text-white/70">
                {Math.round(segment.endTime - segment.startTime)}s
              </span>
            </div>
          ))}
        </div>

        {/* Zoom track */}
        <div className="relative h-10 overflow-hidden rounded-md bg-[#2a2a2a]">
          {zoom.length > 0 ? (
            zoom.map((effect) => (
              <div
                key={effect.id}
                className="group/zoom absolute flex h-full cursor-grab items-center justify-between rounded bg-gradient-to-r from-violet-600 to-violet-800 px-3"
                style={{
                  left: `${(effect.startTime / duration) * 100}%`,
                  width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
                }}
              >
                <span className="text-xs font-medium text-white">Zoom</span>
                <span className="font-mono text-[11px] text-white/70">{effect.scale}x</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover/zoom:opacity-100"
                  onClick={(e) => handleZoomDelete(e, effect.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[#555]">
              <span>Zoom</span>
            </div>
          )}
        </div>

        {/* Speed track */}
        <div className="relative h-10 overflow-hidden rounded-md bg-[#2a2a2a]">
          {speed.length > 0 ? (
            speed.map((effect) => (
              <div
                key={effect.id}
                className="absolute flex h-full cursor-grab items-center justify-between rounded bg-gradient-to-r from-amber-500 to-amber-600 px-3"
                style={{
                  left: `${(effect.startTime / duration) * 100}%`,
                  width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
                }}
              >
                <span className="text-xs font-medium text-white">Speed</span>
                <span className="font-mono text-[11px] text-white/70">{effect.speed}x</span>
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[#555]">
              <span>Speed</span>
            </div>
          )}
        </div>

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-0.5"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rounded-sm bg-red-500 [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]" />
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-red-500" />
        </div>
      </div>

      {/* Timeline toolbar */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-1">
          {(Object.keys(toolConfig) as Array<keyof typeof toolConfig>).map((tool) => {
            const { icon: Icon, label } = toolConfig[tool];
            return (
              <Tooltip key={tool}>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedTool === tool ? "default" : "secondary"}
                    size="sm"
                    onClick={() => onToolChange(tool)}
                    className={cn(
                      "gap-1.5",
                      selectedTool !== tool && "bg-[#333] text-[#aaa] hover:bg-[#444] hover:text-white"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {label} tool
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => setScale(Math.max(0.5, scale - 0.25))}
                className="bg-[#333] text-[#aaa] hover:bg-[#444] hover:text-white"
              >
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="text-muted-foreground min-w-[40px] text-center text-xs">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                onClick={() => setScale(Math.min(4, scale + 0.25))}
                className="bg-[#333] text-[#aaa] hover:bg-[#444] hover:text-white"
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
