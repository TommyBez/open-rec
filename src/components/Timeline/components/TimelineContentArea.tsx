import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import type { Annotation, Segment, SpeedEffect, ZoomEffect } from "../../../types/project";
import type { SegmentDisplayInfo } from "../hooks/useTimelineDisplayMetrics";
import { AnnotationTrack } from "./AnnotationTrack";
import { ClipTrack } from "./ClipTrack";
import { Playhead } from "./Playhead";
import { SpeedTrack } from "./SpeedTrack";
import { TimelineAudioWaveforms } from "./TimelineAudioWaveforms";
import { ZoomTrack } from "./ZoomTrack";

interface TimelineContentAreaProps {
  timelineRef: RefObject<HTMLDivElement | null>;
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  onMouseDown: (event: React.MouseEvent) => void;
  onMouseMove: (event: React.MouseEvent) => void;
  onMouseUp: () => void;
  segments: Segment[];
  selectedSegmentId: string | null;
  timelineDuration: number;
  segmentDisplayInfo: Map<string, SegmentDisplayInfo>;
  onSegmentMouseDown: (event: React.MouseEvent) => void;
  onSegmentClick: (event: React.MouseEvent, segmentId: string) => void;
  zoom: ZoomEffect[];
  selectedZoomId: string | null;
  sourceToDisplayTime: (sourceTime: number) => number;
  zoomDrag: {
    draggingId: string | null;
    localOverride: { id: string; startTime: number; endTime: number } | null;
    handleItemMouseDown: (
      event: React.MouseEvent,
      itemId: string,
      mode: "move" | "resize-start" | "resize-end"
    ) => void;
  };
  onZoomClick: (event: React.MouseEvent, zoomId: string) => void;
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  annotationDrag: {
    draggingId: string | null;
    localOverride: { id: string; startTime: number; endTime: number } | null;
    handleItemMouseDown: (
      event: React.MouseEvent,
      itemId: string,
      mode: "move" | "resize-start" | "resize-end"
    ) => void;
  };
  onAnnotationClick: (event: React.MouseEvent, annotationId: string) => void;
  speed: SpeedEffect[];
  selectedSpeedId: string | null;
  speedDrag: {
    draggingId: string | null;
    localOverride: { id: string; startTime: number; endTime: number } | null;
    handleItemMouseDown: (
      event: React.MouseEvent,
      itemId: string,
      mode: "move" | "resize-start" | "resize-end"
    ) => void;
  };
  onSpeedClick: (event: React.MouseEvent, speedId: string) => void;
  screenWaveformBars: Array<{ id: string; leftPercent: number; amplitude: number }>;
  microphoneWaveformBars: Array<{ id: string; leftPercent: number; amplitude: number }>;
  playheadPosition: number;
}

export function TimelineContentArea({
  timelineRef,
  selectedTool,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  segments,
  selectedSegmentId,
  timelineDuration,
  segmentDisplayInfo,
  onSegmentMouseDown,
  onSegmentClick,
  zoom,
  selectedZoomId,
  sourceToDisplayTime,
  zoomDrag,
  onZoomClick,
  annotations,
  selectedAnnotationId,
  annotationDrag,
  onAnnotationClick,
  speed,
  selectedSpeedId,
  speedDrag,
  onSpeedClick,
  screenWaveformBars,
  microphoneWaveformBars,
  playheadPosition,
}: TimelineContentAreaProps) {
  return (
    <div
      ref={timelineRef}
      className={cn("relative flex flex-1 flex-col gap-2", selectedTool ? "cursor-crosshair" : "cursor-pointer")}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <ClipTrack
        segments={segments}
        selectedSegmentId={selectedSegmentId}
        selectedTool={selectedTool}
        timelineDuration={timelineDuration}
        segmentDisplayInfo={segmentDisplayInfo}
        onSegmentMouseDown={onSegmentMouseDown}
        onSegmentClick={onSegmentClick}
      />
      <ZoomTrack
        zoom={zoom}
        selectedZoomId={selectedZoomId}
        timelineDuration={timelineDuration}
        sourceToDisplayTime={sourceToDisplayTime}
        draggingId={zoomDrag.draggingId}
        localOverride={zoomDrag.localOverride}
        onZoomClick={onZoomClick}
        onZoomMouseDown={zoomDrag.handleItemMouseDown}
      />
      <AnnotationTrack
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        timelineDuration={timelineDuration}
        sourceToDisplayTime={sourceToDisplayTime}
        draggingId={annotationDrag.draggingId}
        localOverride={annotationDrag.localOverride}
        onAnnotationClick={onAnnotationClick}
        onAnnotationMouseDown={annotationDrag.handleItemMouseDown}
      />
      <SpeedTrack
        speed={speed}
        selectedSpeedId={selectedSpeedId}
        timelineDuration={timelineDuration}
        sourceToDisplayTime={sourceToDisplayTime}
        draggingId={speedDrag.draggingId}
        localOverride={speedDrag.localOverride}
        onSpeedClick={onSpeedClick}
        onSpeedMouseDown={speedDrag.handleItemMouseDown}
      />
      <TimelineAudioWaveforms
        screenWaveformBars={screenWaveformBars}
        microphoneWaveformBars={microphoneWaveformBars}
      />
      <Playhead playheadPosition={playheadPosition} />
    </div>
  );
}
