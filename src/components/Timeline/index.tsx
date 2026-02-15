import type { Segment, ZoomEffect, SpeedEffect, Annotation } from "../../types/project";
import { TimeMarkers } from "./components/TimeMarkers";
import { TimelineLabelsColumn } from "./components/TimelineLabelsColumn";
import { TimelineContentArea } from "./components/TimelineContentArea";
import { useTimelineRuntime } from "./hooks/useTimelineRuntime";

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
  const {
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
  } = useTimelineRuntime({
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
  });

  return (
    <div className="flex flex-col gap-2 border-t border-border/50 bg-card/30 px-4 pb-4 pt-3 backdrop-blur-sm">
      <TimeMarkers markers={markers} timelineDuration={timelineDuration} />

      <div className="flex gap-2">
        <TimelineLabelsColumn
          showAnnotations={annotations.length > 0}
          showScreenWaveform={screenWaveformBars.length > 0}
          showMicrophoneWaveform={microphoneWaveformBars.length > 0}
        />
        <TimelineContentArea
          timelineRef={timelineRef}
          selectedTool={selectedTool}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          segments={segments}
          selectedSegmentId={selectedSegmentId}
          timelineDuration={timelineDuration}
          segmentDisplayInfo={segmentDisplayInfo}
          onSegmentMouseDown={handleSegmentMouseDown}
          onSegmentClick={handleSegmentClick}
          zoom={zoom}
          selectedZoomId={selectedZoomId}
          sourceToDisplayTime={sourceToDisplayTime}
          zoomDrag={zoomDrag}
          onZoomClick={handleZoomClick}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          annotationDrag={annotationDrag}
          onAnnotationClick={handleAnnotationClick}
          speed={speed}
          selectedSpeedId={selectedSpeedId}
          speedDrag={speedDrag}
          onSpeedClick={handleSpeedClick}
          screenWaveformBars={screenWaveformBars}
          microphoneWaveformBars={microphoneWaveformBars}
          playheadPosition={playheadPosition}
        />
      </div>

    </div>
  );
}
