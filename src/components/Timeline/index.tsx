import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { ZoomIn, Film, Timer } from "lucide-react";
import type { Segment, ZoomEffect, SpeedEffect } from "../../types/project";
import { cn } from "@/lib/utils";

interface TimelineProps {
  duration: number;
  currentTime: number;
  segments: Segment[];
  zoom: ZoomEffect[];
  speed?: SpeedEffect[];
  onSeek: (time: number) => void;
  selectedTool: "cut" | "zoom" | "speed" | null;
  selectedSegmentId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  selectedZoomId: string | null;
  onSelectZoom: (zoomId: string | null) => void;
  onUpdateZoom?: (zoomId: string, updates: Partial<ZoomEffect>) => void;
  selectedSpeedId: string | null;
  onSelectSpeed: (speedId: string | null) => void;
  onUpdateSpeed?: (speedId: string, updates: Partial<SpeedEffect>) => void;
}

type DragMode = "move" | "resize-start" | "resize-end" | null;

export function Timeline({
  duration,
  currentTime,
  segments,
  zoom,
  speed = [],
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
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Zoom drag state
  const [zoomDragMode, setZoomDragMode] = useState<DragMode>(null);
  const [draggingZoomId, setDraggingZoomId] = useState<string | null>(null);
  const zoomDragStartRef = useRef<{ x: number; startTime: number; endTime: number } | null>(null);
  const zoomHasDraggedRef = useRef(false);
  
  // Speed drag state
  const [speedDragMode, setSpeedDragMode] = useState<DragMode>(null);
  const [draggingSpeedId, setDraggingSpeedId] = useState<string | null>(null);
  const speedDragStartRef = useRef<{ x: number; startTime: number; endTime: number } | null>(null);
  const speedHasDraggedRef = useRef(false);
  
  // Optimistic local state for smooth dragging (avoids parent re-renders during drag)
  const [localZoomOverride, setLocalZoomOverride] = useState<{ id: string; startTime: number; endTime: number } | null>(null);
  const [localSpeedOverride, setLocalSpeedOverride] = useState<{ id: string; startTime: number; endTime: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

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
    // Deselect all when clicking on timeline background
    onSelectSegment(null);
    onSelectZoom(null);
    onSelectSpeed(null);
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

  // Zoom segment click handler (selection)
  function handleZoomClick(e: React.MouseEvent, zoomId: string) {
    e.stopPropagation();
    // Only select if we didn't just drag (dragging deselects on end)
    if (zoomHasDraggedRef.current) {
      zoomHasDraggedRef.current = false;
      return;
    }
    // Select the zoom
    onSelectZoom(zoomId);
    // Deselect segment and speed when selecting zoom
    onSelectSegment(null);
    onSelectSpeed(null);
  }

  // Zoom segment mouse down for drag/resize
  function handleZoomMouseDown(e: React.MouseEvent, zoomId: string, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    
    const zoomEffect = zoom.find(z => z.id === zoomId);
    if (!zoomEffect || !timelineRef.current) return;
    
    zoomHasDraggedRef.current = false; // Reset drag flag
    setDraggingZoomId(zoomId);
    setZoomDragMode(mode);
    zoomDragStartRef.current = {
      x: e.clientX,
      startTime: zoomEffect.startTime,
      endTime: zoomEffect.endTime,
    };
  }

  // Speed segment click handler (selection)
  function handleSpeedClick(e: React.MouseEvent, speedId: string) {
    e.stopPropagation();
    // Only select if we didn't just drag (dragging deselects on end)
    if (speedHasDraggedRef.current) {
      speedHasDraggedRef.current = false;
      return;
    }
    // Select the speed
    onSelectSpeed(speedId);
    // Deselect segment and zoom when selecting speed
    onSelectSegment(null);
    onSelectZoom(null);
  }

  // Speed segment mouse down for drag/resize
  function handleSpeedMouseDown(e: React.MouseEvent, speedId: string, mode: DragMode) {
    e.stopPropagation();
    e.preventDefault();
    
    const speedEffect = speed.find(s => s.id === speedId);
    if (!speedEffect || !timelineRef.current) return;
    
    speedHasDraggedRef.current = false; // Reset drag flag
    setDraggingSpeedId(speedId);
    setSpeedDragMode(mode);
    speedDragStartRef.current = {
      x: e.clientX,
      startTime: speedEffect.startTime,
      endTime: speedEffect.endTime,
    };
  }

  // Handle zoom drag/resize move - uses RAF and local state for smooth dragging
  const handleZoomDragMove = useCallback((e: MouseEvent) => {
    if (!draggingZoomId || !zoomDragMode || !zoomDragStartRef.current || !timelineRef.current) return;
    
    // Cancel any pending RAF to avoid stacking
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    const clientX = e.clientX;
    
    rafIdRef.current = requestAnimationFrame(() => {
      if (!zoomDragStartRef.current || !timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const deltaX = clientX - zoomDragStartRef.current.x;
      
      // Mark that we actually dragged (mouse moved significantly)
      if (Math.abs(deltaX) > 2) {
        zoomHasDraggedRef.current = true;
      }
      
      // Convert deltaX to display time delta
      const deltaDisplayTime = (deltaX / rect.width) * timelineDuration;
      
      const { startTime: origStart, endTime: origEnd } = zoomDragStartRef.current;
      const sourceDuration = origEnd - origStart; // Preserve source duration for move
      const minDuration = 0.5; // Minimum 0.5 seconds in source time
      
      // Convert original source times to display positions
      const origDisplayStart = sourceToDisplayTime(origStart);
      const origDisplayEnd = sourceToDisplayTime(origEnd);
      
      let newStart: number;
      let newEnd: number;
      
      switch (zoomDragMode) {
        case "move": {
          // Calculate new display start position
          let newDisplayStart = origDisplayStart + deltaDisplayTime;
          
          // Clamp display position to timeline bounds
          newDisplayStart = Math.max(0, Math.min(timelineDuration, newDisplayStart));
          
          // Convert display position back to source time
          newStart = displayToSourceTime(newDisplayStart);
          
          // Preserve source duration and clamp to video bounds
          newEnd = newStart + sourceDuration;
          if (newEnd > duration) {
            newEnd = duration;
            newStart = Math.max(0, newEnd - sourceDuration);
          }
          break;
        }
        case "resize-start": {
          // Calculate new display start position
          let newDisplayStart = origDisplayStart + deltaDisplayTime;
          
          // Clamp to valid display range (can't go past end edge minus some margin)
          newDisplayStart = Math.max(0, newDisplayStart);
          
          // Convert back to source time
          newStart = displayToSourceTime(newDisplayStart);
          newEnd = origEnd;
          
          // Apply minimum duration constraint in source-time space
          if (newEnd - newStart < minDuration) {
            newStart = newEnd - minDuration;
          }
          
          // Final clamp to source bounds
          newStart = Math.max(0, newStart);
          break;
        }
        case "resize-end": {
          // Calculate new display end position
          let newDisplayEnd = origDisplayEnd + deltaDisplayTime;
          
          // Clamp to valid display range
          newDisplayEnd = Math.min(timelineDuration, newDisplayEnd);
          
          // Convert back to source time
          newStart = origStart;
          newEnd = displayToSourceTime(newDisplayEnd);
          
          // Apply minimum duration constraint in source-time space
          if (newEnd - newStart < minDuration) {
            newEnd = newStart + minDuration;
          }
          
          // Final clamp to source bounds
          newEnd = Math.min(duration, newEnd);
          break;
        }
        default:
          newStart = origStart;
          newEnd = origEnd;
      }
      
      // Update local state for immediate visual feedback (no parent re-render)
      setLocalZoomOverride({ id: draggingZoomId, startTime: newStart, endTime: newEnd });
    });
  }, [draggingZoomId, zoomDragMode, timelineDuration, duration, sourceToDisplayTime, displayToSourceTime]);

  // Handle speed drag/resize move - uses RAF and local state for smooth dragging
  const handleSpeedDragMove = useCallback((e: MouseEvent) => {
    if (!draggingSpeedId || !speedDragMode || !speedDragStartRef.current || !timelineRef.current) return;
    
    // Cancel any pending RAF to avoid stacking
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    
    const clientX = e.clientX;
    
    rafIdRef.current = requestAnimationFrame(() => {
      if (!speedDragStartRef.current || !timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const deltaX = clientX - speedDragStartRef.current.x;
      
      // Mark that we actually dragged (mouse moved significantly)
      if (Math.abs(deltaX) > 2) {
        speedHasDraggedRef.current = true;
      }
      
      // Convert deltaX to display time delta
      const deltaDisplayTime = (deltaX / rect.width) * timelineDuration;
      
      const { startTime: origStart, endTime: origEnd } = speedDragStartRef.current;
      const sourceDuration = origEnd - origStart; // Preserve source duration for move
      const minDuration = 0.5; // Minimum 0.5 seconds in source time
      
      // Convert original source times to display positions
      const origDisplayStart = sourceToDisplayTime(origStart);
      const origDisplayEnd = sourceToDisplayTime(origEnd);
      
      let newStart: number;
      let newEnd: number;
      
      switch (speedDragMode) {
        case "move": {
          // Calculate new display start position
          let newDisplayStart = origDisplayStart + deltaDisplayTime;
          
          // Clamp display position to timeline bounds
          newDisplayStart = Math.max(0, Math.min(timelineDuration, newDisplayStart));
          
          // Convert display position back to source time
          newStart = displayToSourceTime(newDisplayStart);
          
          // Preserve source duration and clamp to video bounds
          newEnd = newStart + sourceDuration;
          if (newEnd > duration) {
            newEnd = duration;
            newStart = Math.max(0, newEnd - sourceDuration);
          }
          break;
        }
        case "resize-start": {
          // Calculate new display start position
          let newDisplayStart = origDisplayStart + deltaDisplayTime;
          
          // Clamp to valid display range (can't go past end edge minus some margin)
          newDisplayStart = Math.max(0, newDisplayStart);
          
          // Convert back to source time
          newStart = displayToSourceTime(newDisplayStart);
          newEnd = origEnd;
          
          // Apply minimum duration constraint in source-time space
          if (newEnd - newStart < minDuration) {
            newStart = newEnd - minDuration;
          }
          
          // Final clamp to source bounds
          newStart = Math.max(0, newStart);
          break;
        }
        case "resize-end": {
          // Calculate new display end position
          let newDisplayEnd = origDisplayEnd + deltaDisplayTime;
          
          // Clamp to valid display range
          newDisplayEnd = Math.min(timelineDuration, newDisplayEnd);
          
          // Convert back to source time
          newStart = origStart;
          newEnd = displayToSourceTime(newDisplayEnd);
          
          // Apply minimum duration constraint in source-time space
          if (newEnd - newStart < minDuration) {
            newEnd = newStart + minDuration;
          }
          
          // Final clamp to source bounds
          newEnd = Math.min(duration, newEnd);
          break;
        }
        default:
          newStart = origStart;
          newEnd = origEnd;
      }
      
      // Update local state for immediate visual feedback (no parent re-render)
      setLocalSpeedOverride({ id: draggingSpeedId, startTime: newStart, endTime: newEnd });
    });
  }, [draggingSpeedId, speedDragMode, timelineDuration, duration, sourceToDisplayTime, displayToSourceTime]);

  // Handle zoom drag end - commit local state to parent
  const handleZoomDragEnd = useCallback(() => {
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // Commit local override to parent state
    if (localZoomOverride && onUpdateZoom) {
      onUpdateZoom(localZoomOverride.id, { 
        startTime: localZoomOverride.startTime, 
        endTime: localZoomOverride.endTime 
      });
    }
    
    // If we actually dragged/resized, deselect the zoom
    if (zoomHasDraggedRef.current) {
      onSelectZoom(null);
    }
    
    setLocalZoomOverride(null);
    setDraggingZoomId(null);
    setZoomDragMode(null);
    zoomDragStartRef.current = null;
  }, [onSelectZoom, localZoomOverride, onUpdateZoom]);

  // Handle speed drag end - commit local state to parent
  const handleSpeedDragEnd = useCallback(() => {
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    
    // Commit local override to parent state
    if (localSpeedOverride && onUpdateSpeed) {
      onUpdateSpeed(localSpeedOverride.id, { 
        startTime: localSpeedOverride.startTime, 
        endTime: localSpeedOverride.endTime 
      });
    }
    
    // If we actually dragged/resized, deselect the speed
    if (speedHasDraggedRef.current) {
      onSelectSpeed(null);
    }
    
    setLocalSpeedOverride(null);
    setDraggingSpeedId(null);
    setSpeedDragMode(null);
    speedDragStartRef.current = null;
  }, [onSelectSpeed, localSpeedOverride, onUpdateSpeed]);

  useEffect(() => {
    function handleGlobalMouseUp() {
      setIsDragging(false);
      handleZoomDragEnd();
      handleSpeedDragEnd();
    }
    
    function handleGlobalMouseMove(e: MouseEvent) {
      if (draggingZoomId && zoomDragMode) {
        handleZoomDragMove(e);
      }
      if (draggingSpeedId && speedDragMode) {
        handleSpeedDragMove(e);
      }
    }
    
    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      // Clean up any pending RAF on unmount
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [draggingZoomId, zoomDragMode, handleZoomDragMove, handleZoomDragEnd, draggingSpeedId, speedDragMode, handleSpeedDragMove, handleSpeedDragEnd]);

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
                const isDraggingThis = draggingZoomId === effect.id;
                
                // Use local override for the element being dragged (smooth visual feedback)
                const effectTimes = isDraggingThis && localZoomOverride
                  ? { startTime: localZoomOverride.startTime, endTime: localZoomOverride.endTime }
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
                      onMouseDown={(e) => handleZoomMouseDown(e, effect.id, "resize-start")}
                    />
                    
                    {/* Center drag area */}
                    <div
                      className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => handleZoomMouseDown(e, effect.id, "move")}
                    />
                    
                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(e) => handleZoomMouseDown(e, effect.id, "resize-end")}
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

          {/* Speed track */}
          <div className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/30">
            {speed.length > 0 ? (
              speed.map((effect) => {
                const isDraggingThis = draggingSpeedId === effect.id;
                
                // Use local override for the element being dragged (smooth visual feedback)
                const effectTimes = isDraggingThis && localSpeedOverride
                  ? { startTime: localSpeedOverride.startTime, endTime: localSpeedOverride.endTime }
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
                      onMouseDown={(e) => handleSpeedMouseDown(e, effect.id, "resize-start")}
                    />
                    
                    {/* Center drag area */}
                    <div
                      className="absolute inset-x-2 inset-y-0 cursor-grab active:cursor-grabbing"
                      onMouseDown={(e) => handleSpeedMouseDown(e, effect.id, "move")}
                    />
                    
                    {/* Right resize handle */}
                    <div
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20"
                      onMouseDown={(e) => handleSpeedMouseDown(e, effect.id, "resize-end")}
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
