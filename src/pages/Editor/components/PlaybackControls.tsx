import { memo } from "react";
import { TimeUndoSection } from "./playback/TimeUndoSection";
import { TransportSection } from "./playback/TransportSection";
import { ToolSection } from "./playback/ToolSection";

interface PlaybackControlsProps {
  currentTime: number;
  editedDuration: number;
  isPlaying: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canDelete: boolean;
  canDeleteZoom: boolean;
  canDeleteSpeed: boolean;
  canDeleteSegment: boolean;
  canDeleteAnnotation: boolean;
  annotationMode: "outline" | "blur" | "text" | "arrow";
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  onTogglePlay: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onToggleTool: (tool: "cut" | "zoom" | "speed" | "annotation") => void;
}

export const PlaybackControls = memo(function PlaybackControls({
  currentTime,
  editedDuration,
  isPlaying,
  canUndo,
  canRedo,
  canDelete,
  canDeleteZoom,
  canDeleteSpeed,
  canDeleteSegment,
  canDeleteAnnotation,
  annotationMode,
  selectedTool,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  onUndo,
  onRedo,
  onDelete,
  onToggleTool,
}: PlaybackControlsProps) {
  return (
    <div className="studio-panel flex items-center justify-between rounded-xl px-4 py-3 animate-fade-up-delay-2">
      <TimeUndoSection
        currentTime={currentTime}
        editedDuration={editedDuration}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
      />
      <TransportSection
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onSkipBackward={onSkipBackward}
        onSkipForward={onSkipForward}
      />
      <ToolSection
        selectedTool={selectedTool}
        annotationMode={annotationMode}
        canDelete={canDelete}
        canDeleteZoom={canDeleteZoom}
        canDeleteSpeed={canDeleteSpeed}
        canDeleteSegment={canDeleteSegment}
        canDeleteAnnotation={canDeleteAnnotation}
        onToggleTool={onToggleTool}
        onDelete={onDelete}
      />
    </div>
  );
});
