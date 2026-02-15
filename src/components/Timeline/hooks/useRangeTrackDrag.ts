import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type DragMode = "move" | "resize-start" | "resize-end" | null;

interface RangeTrackItem {
  id: string;
  startTime: number;
  endTime: number;
}

interface UseRangeTrackDragOptions<T extends RangeTrackItem> {
  items: T[];
  timelineRef: RefObject<HTMLDivElement | null>;
  timelineDuration: number;
  duration: number;
  minDuration: number;
  sourceToDisplayTime: (sourceTime: number) => number;
  displayToSourceTime: (displayTime: number) => number;
  getSnappedDisplayTime: (displayTime: number) => number;
  onCommit?: (id: string, updates: { startTime: number; endTime: number }) => void;
  onDraggedSelectionReset?: () => void;
}

function computeDraggedRange({
  mode,
  deltaDisplayTime,
  origStart,
  origEnd,
  timelineDuration,
  duration,
  minDuration,
  sourceToDisplayTime,
  displayToSourceTime,
  getSnappedDisplayTime,
}: {
  mode: Exclude<DragMode, null>;
  deltaDisplayTime: number;
  origStart: number;
  origEnd: number;
  timelineDuration: number;
  duration: number;
  minDuration: number;
  sourceToDisplayTime: (sourceTime: number) => number;
  displayToSourceTime: (displayTime: number) => number;
  getSnappedDisplayTime: (displayTime: number) => number;
}) {
  const sourceDuration = origEnd - origStart;
  const origDisplayStart = sourceToDisplayTime(origStart);
  const origDisplayEnd = sourceToDisplayTime(origEnd);
  let newStart = origStart;
  let newEnd = origEnd;

  switch (mode) {
    case "move": {
      let newDisplayStart = origDisplayStart + deltaDisplayTime;
      newDisplayStart = Math.max(0, Math.min(timelineDuration, newDisplayStart));
      newDisplayStart = getSnappedDisplayTime(newDisplayStart);
      newStart = displayToSourceTime(newDisplayStart);
      newEnd = newStart + sourceDuration;
      if (newEnd > duration) {
        newEnd = duration;
        newStart = Math.max(0, newEnd - sourceDuration);
      }
      break;
    }
    case "resize-start": {
      let newDisplayStart = origDisplayStart + deltaDisplayTime;
      newDisplayStart = Math.max(0, newDisplayStart);
      newDisplayStart = getSnappedDisplayTime(newDisplayStart);
      newStart = displayToSourceTime(newDisplayStart);
      newEnd = origEnd;
      if (newEnd - newStart < minDuration) {
        newStart = newEnd - minDuration;
      }
      newStart = Math.max(0, newStart);
      break;
    }
    case "resize-end": {
      let newDisplayEnd = origDisplayEnd + deltaDisplayTime;
      newDisplayEnd = Math.min(timelineDuration, newDisplayEnd);
      newDisplayEnd = getSnappedDisplayTime(newDisplayEnd);
      newStart = origStart;
      newEnd = displayToSourceTime(newDisplayEnd);
      if (newEnd - newStart < minDuration) {
        newEnd = newStart + minDuration;
      }
      newEnd = Math.min(duration, newEnd);
      break;
    }
  }

  return { startTime: newStart, endTime: newEnd };
}

export function useRangeTrackDrag<T extends RangeTrackItem>({
  items,
  timelineRef,
  timelineDuration,
  duration,
  minDuration,
  sourceToDisplayTime,
  displayToSourceTime,
  getSnappedDisplayTime,
  onCommit,
  onDraggedSelectionReset,
}: UseRangeTrackDragOptions<T>) {
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; startTime: number; endTime: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const [localOverride, setLocalOverride] = useState<{
    id: string;
    startTime: number;
    endTime: number;
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const handleItemMouseDown = useCallback(
    (event: React.MouseEvent, itemId: string, mode: Exclude<DragMode, null>) => {
      event.stopPropagation();
      event.preventDefault();
      const item = items.find((candidate) => candidate.id === itemId);
      if (!item || !timelineRef.current) return;
      hasDraggedRef.current = false;
      setDraggingId(itemId);
      setDragMode(mode);
      dragStartRef.current = {
        x: event.clientX,
        startTime: item.startTime,
        endTime: item.endTime,
      };
    },
    [items, timelineRef]
  );

  const handleItemClick = useCallback(
    (event: React.MouseEvent, itemId: string, onSelect: (id: string) => void) => {
      event.stopPropagation();
      if (hasDraggedRef.current) {
        hasDraggedRef.current = false;
        return;
      }
      onSelect(itemId);
    },
    []
  );

  const handleGlobalMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!draggingId || !dragMode || !dragStartRef.current || !timelineRef.current) return;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      const clientX = event.clientX;
      rafIdRef.current = requestAnimationFrame(() => {
        if (!dragStartRef.current || !timelineRef.current || !dragMode) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const deltaX = clientX - dragStartRef.current.x;
        if (Math.abs(deltaX) > 2) {
          hasDraggedRef.current = true;
        }
        const deltaDisplayTime = (deltaX / rect.width) * timelineDuration;
        const nextRange = computeDraggedRange({
          mode: dragMode,
          deltaDisplayTime,
          origStart: dragStartRef.current.startTime,
          origEnd: dragStartRef.current.endTime,
          timelineDuration,
          duration,
          minDuration,
          sourceToDisplayTime,
          displayToSourceTime,
          getSnappedDisplayTime,
        });
        setLocalOverride({
          id: draggingId,
          startTime: nextRange.startTime,
          endTime: nextRange.endTime,
        });
      });
    },
    [
      draggingId,
      dragMode,
      timelineRef,
      timelineDuration,
      duration,
      minDuration,
      sourceToDisplayTime,
      displayToSourceTime,
      getSnappedDisplayTime,
    ]
  );

  const handleGlobalMouseUp = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (localOverride && onCommit) {
      onCommit(localOverride.id, {
        startTime: localOverride.startTime,
        endTime: localOverride.endTime,
      });
    }
    if (hasDraggedRef.current) {
      onDraggedSelectionReset?.();
    }
    setLocalOverride(null);
    setDraggingId(null);
    setDragMode(null);
    dragStartRef.current = null;
  }, [localOverride, onCommit, onDraggedSelectionReset]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    draggingId,
    dragMode,
    localOverride,
    handleItemMouseDown,
    handleItemClick,
    handleGlobalMouseMove,
    handleGlobalMouseUp,
  };
}
