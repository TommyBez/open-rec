import { EditorInspectors } from "./EditorInspectors";
import { PlaybackControls } from "./PlaybackControls";
import { VideoPreview } from "./VideoPreview";
import type { EditorMainPaneProps } from "./EditorMainPane.types";

export function EditorMainPane({
  project,
  videoRef,
  videoSrc,
  videoZoomStyle,
  activeZoom,
  activeSpeed,
  effectivePlaybackRate,
  currentTime,
  isPlaying,
  previewFilter,
  selectedAnnotationId,
  cameraSrc,
  onAnnotationPositionChange,
  onCameraOverlayCustomPositionChange,
  sourceToEditedTime,
  editedDuration,
  canUndo,
  canRedo,
  canDelete,
  canDeleteZoom,
  canDeleteSpeed,
  canDeleteSegment,
  canDeleteAnnotation,
  annotationInsertMode,
  selectedTool,
  onTogglePlay,
  onSkipBackward,
  onSkipForward,
  onUndo,
  onRedo,
  onDelete,
  onToggleTool,
  selectedZoom,
  selectedSpeed,
  selectedAnnotation,
  onZoomCommit,
  onCloseZoom,
  onZoomDraftChange,
  onSpeedCommit,
  onCloseSpeed,
  onSpeedDraftChange,
  onAnnotationCommit,
  onDuplicateAnnotation,
  onCloseAnnotation,
}: EditorMainPaneProps) {
  return (
    <div className="relative z-10 flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 animate-fade-up-delay-1">
        <VideoPreview
          ref={videoRef}
          videoSrc={videoSrc}
          videoZoomStyle={videoZoomStyle}
          activeZoom={activeZoom}
          activeSpeed={activeSpeed}
          currentPlaybackRate={effectivePlaybackRate}
          currentSourceTime={currentTime}
          isPlaying={isPlaying}
          annotations={project.edits.annotations}
          previewFilter={previewFilter}
          selectedAnnotationId={selectedAnnotationId}
          onAnnotationPositionChange={onAnnotationPositionChange}
          resolution={project.resolution}
          cameraSrc={cameraSrc}
          cameraOverlayPosition={project.edits.cameraOverlay.position}
          cameraOverlayScale={project.edits.cameraOverlay.scale}
          cameraOverlayMargin={project.edits.cameraOverlay.margin}
          cameraOverlayCustomX={project.edits.cameraOverlay.customX}
          cameraOverlayCustomY={project.edits.cameraOverlay.customY}
          onCameraOverlayCustomPositionChange={onCameraOverlayCustomPositionChange}
          cameraOffsetMs={project.cameraOffsetMs}
        />

        <PlaybackControls
          currentTime={sourceToEditedTime(currentTime)}
          editedDuration={editedDuration}
          isPlaying={isPlaying}
          canUndo={canUndo}
          canRedo={canRedo}
          canDelete={canDelete}
          canDeleteZoom={canDeleteZoom}
          canDeleteSpeed={canDeleteSpeed}
          canDeleteSegment={canDeleteSegment}
          canDeleteAnnotation={canDeleteAnnotation}
          annotationMode={annotationInsertMode}
          selectedTool={selectedTool}
          onTogglePlay={onTogglePlay}
          onSkipBackward={onSkipBackward}
          onSkipForward={onSkipForward}
          onUndo={onUndo}
          onRedo={onRedo}
          onDelete={onDelete}
          onToggleTool={onToggleTool}
        />
      </div>

      <EditorInspectors
        selectedZoom={selectedZoom}
        selectedSpeed={selectedSpeed}
        selectedAnnotation={selectedAnnotation}
        resolution={project.resolution}
        maxDuration={project.duration}
        onZoomCommit={onZoomCommit}
        onCloseZoom={onCloseZoom}
        onZoomDraftChange={onZoomDraftChange}
        onSpeedCommit={onSpeedCommit}
        onCloseSpeed={onCloseSpeed}
        onSpeedDraftChange={onSpeedDraftChange}
        onAnnotationCommit={onAnnotationCommit}
        onDuplicateAnnotation={onDuplicateAnnotation}
        onCloseAnnotation={onCloseAnnotation}
      />
    </div>
  );
}
