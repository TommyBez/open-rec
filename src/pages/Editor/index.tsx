import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useProject } from "../../hooks/useProject";
import { useEditorStore, useExportStore } from "../../stores";

import { EditorPageLayout } from "./components/EditorPageLayout";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { useVideoPlayback } from "./hooks/useVideoPlayback";
import { useWaveformData } from "./hooks/useWaveformData";
import { useEditedTimelineMetrics } from "./hooks/useEditedTimelineMetrics";
import { useEditorAutosaveLifecycle } from "./hooks/useEditorAutosaveLifecycle";
import { useEditorProjectLoader } from "./hooks/useEditorProjectLoader";
import { useEditorPreviewState } from "./hooks/useEditorPreviewState";
import { useEditorBoundedUpdaters } from "./hooks/useEditorBoundedUpdaters";
import { useEditorSelectionActions } from "./hooks/useEditorSelectionActions";
import { useEditorViewHandlers } from "./hooks/useEditorViewHandlers";

const loadingSpinner = (
  <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      <p className="text-sm text-muted-foreground">Loading project...</p>
    </div>
  </div>
);

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  const {
    project,
    setProject,
    isDirty,
    saveProject,
    renameProject,
    updateCameraOverlay,
    updateAudioMix,
    updateColorCorrection,
    canUndo,
    canRedo,
    undo,
    redo,
    cutAt,
    deleteSegment,
    addZoom,
    updateZoom,
    deleteZoom,
    addSpeed,
    updateSpeed,
    deleteSpeed,
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    duplicateAnnotation,
  } = useProject(null);
  
  const {
    isPlaying,
    currentTime,
    duration,
    selectedTool,
    selectedSegmentId,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    zoomDraft,
    speedDraft,
    showExportModal,
    isLoading,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    toggleTool,
    selectSegment,
    selectZoom,
    selectSpeed,
    selectAnnotation,
    setZoomDraft,
    setSpeedDraft,
    setShowExportModal,
    setIsLoading,
  } = useEditorStore();
  const activeExportCount = useExportStore((state) => state.activeExportCount);
  const { loadProject } = useEditorProjectLoader({
    setProject,
    setDuration,
    setIsLoading,
  });
  const {
    selectedZoom,
    selectedSpeed,
    selectedAnnotation,
    activeZoom,
    activeSpeed,
    currentPlaybackRate,
    effectivePlaybackRate,
    videoZoomStyle,
    previewFilter,
    jklRateMultiplier,
    setJklRateMultiplier,
    annotationInsertMode,
    setAnnotationInsertMode,
  } = useEditorPreviewState({
    project,
    currentTime,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    zoomDraft,
    speedDraft,
  });

  const videoSrc = useMemo(() => {
    if (!project?.screenVideoPath) return "";
    return convertFileSrc(project.screenVideoPath);
  }, [project?.screenVideoPath]);

  const cameraSrc = useMemo(() => {
    if (!project?.cameraVideoPath) return "";
    return convertFileSrc(project.cameraVideoPath);
  }, [project?.cameraVideoPath]);
  const screenWaveform = useWaveformData(project?.screenVideoPath);
  const microphoneWaveform = useWaveformData(project?.microphoneAudioPath);

  const { enabledSegments, editedDuration, sourceToEditedTime } =
    useEditedTimelineMetrics(project, duration);

  // Video playback hook
  const { videoRef, seek, togglePlay, skipBackward, skipForward } = useVideoPlayback({
    project,
    isPlaying,
    duration,
    enabledSegments,
    currentPlaybackRate,
    playbackRateMultiplier: jklRateMultiplier,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setProject,
  });

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  useEditorAutosaveLifecycle({ project, isDirty, saveProject });
  const {
    handleDeleteSelected,
    handleDuplicateSelectedAnnotation,
    handleNudgeSelectedAnnotation,
    handleManualSaveShortcut,
    handleOpenProjectWindow,
    canDeleteSegment,
    canDeleteZoom,
    canDeleteSpeed,
    canDeleteAnnotation,
    canDelete,
  } = useEditorSelectionActions({
    project,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    selectedSegmentId,
    deleteZoom,
    deleteSpeed,
    deleteAnnotation,
    deleteSegment,
    selectZoom,
    selectSpeed,
    selectAnnotation,
    selectSegment,
    duplicateAnnotation,
    updateAnnotation,
    saveProject,
  });
  const {
    createAnnotationAtPlayhead,
    handleTimelineClick,
    handleZoomDraftChange,
    handleSpeedDraftChange,
    handleZoomCommit,
    handleSpeedCommit,
    handleAnnotationCommit,
    handleCloseZoomInspector,
    handleCloseSpeedInspector,
    handleCloseAnnotationInspector,
    handleBack,
    handleExport,
    handleOpenVideos,
  } = useEditorViewHandlers({
    project,
    projectId,
    currentTime,
    duration,
    selectedTool,
    annotationInsertMode,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    addAnnotation,
    addZoom,
    addSpeed,
    cutAt,
    seek,
    setShowExportModal,
    setZoomDraft,
    setSpeedDraft,
    setAnnotationInsertMode,
    updateZoom,
    updateSpeed,
    updateAnnotation,
    selectZoom,
    selectSpeed,
    selectAnnotation,
    navigate,
  });

  useEditorKeyboardShortcuts({
    canUndo,
    canRedo,
    undo,
    redo,
    saveProjectNow: handleManualSaveShortcut,
    isPlaying,
    togglePlay,
    skipBackward,
    toggleTool,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    selectedSegmentId,
    handleDeleteSelected,
    duplicateSelectedAnnotation: handleDuplicateSelectedAnnotation,
    openProjectWindow: handleOpenProjectWindow,
    nudgeSelectedAnnotation: handleNudgeSelectedAnnotation,
    currentTime,
    duration,
    seek,
    createAnnotationAtPlayhead,
    setJklRateMultiplier,
  });

  const {
    handleCameraOverlayPositionChange,
    handleCameraOverlayScaleChange,
    handleCameraOverlayMarginChange,
    handleCameraOverlayCustomPositionChange,
    handleAudioSystemVolumeChange,
    handleAudioMicrophoneVolumeChange,
    handleMicrophoneNoiseGateChange,
    handleColorBrightnessChange,
    handleColorContrastChange,
    handleColorSaturationChange,
    handleResetColorCorrection,
    handleAnnotationPositionChange,
  } = useEditorBoundedUpdaters({
    updateCameraOverlay,
    updateAudioMix,
    updateColorCorrection,
    updateAnnotation,
  });

  if (isLoading || !project) return loadingSpinner;

  return (
    <EditorPageLayout
      project={project}
      isDirty={isDirty}
      activeExportCount={activeExportCount}
      duration={duration}
      videoRef={videoRef}
      videoSrc={videoSrc}
      videoZoomStyle={videoZoomStyle}
      activeZoom={activeZoom}
      activeSpeed={activeSpeed}
      effectivePlaybackRate={effectivePlaybackRate}
      currentTime={currentTime}
      isPlaying={isPlaying}
      previewFilter={previewFilter}
      selectedAnnotationId={selectedAnnotationId}
      cameraSrc={cameraSrc}
      onAnnotationPositionChange={handleAnnotationPositionChange}
      onCameraOverlayCustomPositionChange={handleCameraOverlayCustomPositionChange}
      sourceToEditedTime={sourceToEditedTime}
      editedDuration={editedDuration}
      canUndo={canUndo}
      canRedo={canRedo}
      canDelete={canDelete}
      canDeleteZoom={canDeleteZoom}
      canDeleteSpeed={canDeleteSpeed}
      canDeleteSegment={!!canDeleteSegment}
      canDeleteAnnotation={canDeleteAnnotation}
      annotationInsertMode={annotationInsertMode}
      selectedTool={selectedTool}
      selectedSegmentId={selectedSegmentId}
      selectedZoomId={selectedZoomId}
      selectedSpeedId={selectedSpeedId}
      screenWaveform={screenWaveform}
      microphoneWaveform={microphoneWaveform}
      selectedZoom={selectedZoom}
      selectedSpeed={selectedSpeed}
      selectedAnnotation={selectedAnnotation}
      onRenameProject={renameProject}
      onBack={handleBack}
      onExport={handleExport}
      onOpenVideos={handleOpenVideos}
      onOpenInNewWindow={handleOpenProjectWindow}
      onTogglePlay={togglePlay}
      onSkipBackward={skipBackward}
      onSkipForward={skipForward}
      onUndo={undo}
      onRedo={redo}
      onDeleteSelected={handleDeleteSelected}
      onToggleTool={toggleTool}
      onZoomCommit={handleZoomCommit}
      onCloseZoom={handleCloseZoomInspector}
      onZoomDraftChange={handleZoomDraftChange}
      onSpeedCommit={handleSpeedCommit}
      onCloseSpeed={handleCloseSpeedInspector}
      onSpeedDraftChange={handleSpeedDraftChange}
      onAnnotationCommit={handleAnnotationCommit}
      onDuplicateAnnotation={handleDuplicateSelectedAnnotation}
      onCloseAnnotation={handleCloseAnnotationInspector}
      onSeek={handleTimelineClick}
      onSelectSegment={selectSegment}
      onSelectZoom={selectZoom}
      onUpdateZoom={updateZoom}
      onSelectSpeed={selectSpeed}
      onUpdateSpeed={updateSpeed}
      onSelectAnnotation={selectAnnotation}
      onUpdateAnnotation={updateAnnotation}
      onCameraOverlayPositionChange={handleCameraOverlayPositionChange}
      onCameraOverlayScaleChange={handleCameraOverlayScaleChange}
      onCameraOverlayMarginChange={handleCameraOverlayMarginChange}
      onAudioSystemVolumeChange={handleAudioSystemVolumeChange}
      onAudioMicrophoneVolumeChange={handleAudioMicrophoneVolumeChange}
      onMicrophoneNoiseGateChange={handleMicrophoneNoiseGateChange}
      onColorBrightnessChange={handleColorBrightnessChange}
      onColorContrastChange={handleColorContrastChange}
      onColorSaturationChange={handleColorSaturationChange}
      onResetColorCorrection={handleResetColorCorrection}
      showExportModal={showExportModal}
      onSetShowExportModal={setShowExportModal}
      onSaveProject={saveProject}
    />
  );
}
