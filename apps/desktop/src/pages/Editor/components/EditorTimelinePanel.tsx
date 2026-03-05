import type { Annotation, Project, SpeedEffect, ZoomEffect } from "../../../types/project";
import { Timeline } from "../../../components/Timeline";

interface EditorTimelinePanelProps {
  project: Project;
  duration: number;
  currentTime: number;
  screenWaveform: number[];
  microphoneWaveform: number[];
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  selectedSegmentId: string | null;
  selectedZoomId: string | null;
  selectedSpeedId: string | null;
  selectedAnnotationId: string | null;
  onSeek: (time: number) => void;
  onSelectSegment: (segmentId: string | null) => void;
  onSelectZoom: (zoomId: string | null) => void;
  onUpdateZoom: (zoomId: string, updates: Partial<ZoomEffect>) => void;
  onSelectSpeed: (speedId: string | null) => void;
  onUpdateSpeed: (speedId: string, updates: Partial<SpeedEffect>) => void;
  onSelectAnnotation: (annotationId: string | null) => void;
  onUpdateAnnotation: (annotationId: string, updates: Partial<Annotation>) => void;
}

export function EditorTimelinePanel({
  project,
  duration,
  currentTime,
  screenWaveform,
  microphoneWaveform,
  selectedTool,
  selectedSegmentId,
  selectedZoomId,
  selectedSpeedId,
  selectedAnnotationId,
  onSeek,
  onSelectSegment,
  onSelectZoom,
  onUpdateZoom,
  onSelectSpeed,
  onUpdateSpeed,
  onSelectAnnotation,
  onUpdateAnnotation,
}: EditorTimelinePanelProps) {
  return (
    <div className="relative z-10 animate-fade-up-delay-3">
      <Timeline
        duration={duration}
        currentTime={currentTime}
        segments={project.edits.segments}
        zoom={project.edits.zoom}
        speed={project.edits.speed}
        annotations={project.edits.annotations}
        screenWaveform={screenWaveform}
        microphoneWaveform={microphoneWaveform}
        onSeek={onSeek}
        selectedTool={selectedTool}
        selectedSegmentId={selectedSegmentId}
        onSelectSegment={onSelectSegment}
        selectedZoomId={selectedZoomId}
        onSelectZoom={onSelectZoom}
        onUpdateZoom={onUpdateZoom}
        selectedSpeedId={selectedSpeedId}
        onSelectSpeed={onSelectSpeed}
        onUpdateSpeed={onUpdateSpeed}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={onSelectAnnotation}
        onUpdateAnnotation={onUpdateAnnotation}
      />
    </div>
  );
}
