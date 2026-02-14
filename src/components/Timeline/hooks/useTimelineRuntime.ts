import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { Annotation, Segment, SpeedEffect, ZoomEffect } from "../../../types/project";
import { useRangeTrackDrag } from "./useRangeTrackDrag";
import { useTimelineDisplayMetrics } from "./useTimelineDisplayMetrics";

interface UseTimelineRuntimeOptions {
  duration: number;
  currentTime: number;
  segments: Segment[];
  zoom: ZoomEffect[];
  speed: SpeedEffect[];
  annotations: Annotation[];
  screenWaveform: number[];
  microphoneWaveform: number[];
  onSeek: (time: number) => void;
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  selectedSegmentId: string | null;
  selectedAnnotationId: string | null;
  onSelectSegment: (segmentId: string | null) => void;
  onSelectZoom: (zoomId: string | null) => void;
  onSelectSpeed: (speedId: string | null) => void;
  onSelectAnnotation: (annotationId: string | null) => void;
  onUpdateZoom?: (zoomId: string, updates: Partial<ZoomEffect>) => void;
  onUpdateSpeed?: (speedId: string, updates: Partial<SpeedEffect>) => void;
  onUpdateAnnotation?: (annotationId: string, updates: Partial<Annotation>) => void;
}

export function useTimelineRuntime({
  duration,
  currentTime,
  segments,
  zoom,
  speed,
  annotations,
  screenWaveform,
  microphoneWaveform,
  onSeek,
  selectedTool,
  selectedSegmentId,
  selectedAnnotationId,
  onSelectSegment,
  onSelectZoom,
  onSelectSpeed,
  onSelectAnnotation,
  onUpdateZoom,
  onUpdateSpeed,
  onUpdateAnnotation,
}: UseTimelineRuntimeOptions) {
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

  const handleTimelineClick = useCallback(
    (event: ReactMouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      const rawDisplayTime = percentage * timelineDuration;
      const displayTime = getSnappedDisplayTime(rawDisplayTime);
      const sourceTime = displayToSourceTime(displayTime);
      onSeek(sourceTime);
      onSelectSegment(null);
      onSelectZoom(null);
      onSelectSpeed(null);
      onSelectAnnotation(null);
    },
    [
      displayToSourceTime,
      getSnappedDisplayTime,
      onSeek,
      onSelectAnnotation,
      onSelectSegment,
      onSelectSpeed,
      onSelectZoom,
      timelineDuration,
    ]
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      setIsDragging(true);
      handleTimelineClick(event);
    },
    [handleTimelineClick]
  );
  const handleMouseMove = useCallback(
    (event: ReactMouseEvent) => {
      if (!isDragging) return;
      handleTimelineClick(event);
    },
    [handleTimelineClick, isDragging]
  );
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleSegmentClick = useCallback(
    (event: ReactMouseEvent, segmentId: string) => {
      if (selectedTool !== null) return;
      event.stopPropagation();
      onSelectSegment(selectedSegmentId === segmentId ? null : segmentId);
    },
    [onSelectSegment, selectedSegmentId, selectedTool]
  );
  const handleSegmentMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      if (selectedTool !== null) return;
      event.stopPropagation();
    },
    [selectedTool]
  );

  const handleZoomClick = useCallback(
    (event: ReactMouseEvent, zoomId: string) =>
      zoomDrag.handleItemClick(event, zoomId, onSelectZoom),
    [onSelectZoom, zoomDrag]
  );
  const handleSpeedClick = useCallback(
    (event: ReactMouseEvent, speedId: string) =>
      speedDrag.handleItemClick(event, speedId, onSelectSpeed),
    [onSelectSpeed, speedDrag]
  );
  const handleAnnotationClick = useCallback(
    (event: ReactMouseEvent, annotationId: string) =>
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
    function handleGlobalMouseMove(event: MouseEvent) {
      zoomDrag.handleGlobalMouseMove(event);
      speedDrag.handleGlobalMouseMove(event);
      annotationDrag.handleGlobalMouseMove(event);
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

  const displayTime = sourceToDisplayTime(currentTime);
  const playheadPosition = timelineDuration > 0 ? (displayTime / timelineDuration) * 100 : 0;

  return {
    timelineRef,
    timelineDuration,
    markers,
    segmentDisplayInfo,
    sourceToDisplayTime,
    screenWaveformBars,
    microphoneWaveformBars,
    playheadPosition,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleSegmentClick,
    handleSegmentMouseDown,
    handleZoomClick,
    handleSpeedClick,
    handleAnnotationClick,
    zoomDrag,
    speedDrag,
    annotationDrag,
  };
}
