import { useEffect, useMemo } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { NavigateFunction } from "react-router-dom";
import { useProject } from "../../../hooks/useProject";
import { useEditorStore, useExportStore } from "../../../stores";
import { useEditorAutosaveLifecycle } from "./useEditorAutosaveLifecycle";
import { useEditorBoundedUpdaters } from "./useEditorBoundedUpdaters";
import { useEditedTimelineMetrics } from "./useEditedTimelineMetrics";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import { useEditorPreviewState } from "./useEditorPreviewState";
import { useEditorProjectLoader } from "./useEditorProjectLoader";
import { useEditorSelectionActions } from "./useEditorSelectionActions";
import { useEditorViewHandlers } from "./useEditorViewHandlers";
import { useVideoPlayback } from "./useVideoPlayback";
import { useWaveformData } from "./useWaveformData";
import type { EditorPageLayoutProps } from "../components/EditorPageLayout.types";

interface UseEditorPageControllerOptions {
  projectId?: string;
  navigate: NavigateFunction;
}

export function useEditorPageController({
  projectId,
  navigate,
}: UseEditorPageControllerOptions) {
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
  const { loadProject } = useEditorProjectLoader({ setProject, setDuration, setIsLoading });
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

  const videoSrc = useMemo(
    () => (project?.screenVideoPath ? convertFileSrc(project.screenVideoPath) : ""),
    [project?.screenVideoPath]
  );
  const cameraSrc = useMemo(
    () => (project?.cameraVideoPath ? convertFileSrc(project.cameraVideoPath) : ""),
    [project?.cameraVideoPath]
  );
  const screenWaveform = useWaveformData(project?.screenVideoPath);
  const microphoneWaveform = useWaveformData(project?.microphoneAudioPath);

  const { enabledSegments, editedDuration, sourceToEditedTime } = useEditedTimelineMetrics(
    project,
    duration
  );

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

  const layoutProps = useMemo<EditorPageLayoutProps | null>(() => {
    if (!project) return null;
    return {
      project,
      isDirty,
      activeExportCount,
      duration,
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
      onAnnotationPositionChange: handleAnnotationPositionChange,
      onCameraOverlayCustomPositionChange: handleCameraOverlayCustomPositionChange,
      sourceToEditedTime,
      editedDuration,
      canUndo,
      canRedo,
      canDelete,
      canDeleteZoom,
      canDeleteSpeed,
      canDeleteSegment: !!canDeleteSegment,
      canDeleteAnnotation,
      annotationInsertMode,
      selectedTool,
      selectedSegmentId,
      selectedZoomId,
      selectedSpeedId,
      screenWaveform,
      microphoneWaveform,
      selectedZoom,
      selectedSpeed,
      selectedAnnotation,
      onRenameProject: renameProject,
      onBack: handleBack,
      onExport: handleExport,
      onOpenVideos: handleOpenVideos,
      onOpenInNewWindow: handleOpenProjectWindow,
      onTogglePlay: togglePlay,
      onSkipBackward: skipBackward,
      onSkipForward: skipForward,
      onUndo: undo,
      onRedo: redo,
      onDeleteSelected: handleDeleteSelected,
      onToggleTool: toggleTool,
      onZoomCommit: handleZoomCommit,
      onCloseZoom: handleCloseZoomInspector,
      onZoomDraftChange: handleZoomDraftChange,
      onSpeedCommit: handleSpeedCommit,
      onCloseSpeed: handleCloseSpeedInspector,
      onSpeedDraftChange: handleSpeedDraftChange,
      onAnnotationCommit: handleAnnotationCommit,
      onDuplicateAnnotation: handleDuplicateSelectedAnnotation,
      onCloseAnnotation: handleCloseAnnotationInspector,
      onSeek: handleTimelineClick,
      onSelectSegment: selectSegment,
      onSelectZoom: selectZoom,
      onUpdateZoom: updateZoom,
      onSelectSpeed: selectSpeed,
      onUpdateSpeed: updateSpeed,
      onSelectAnnotation: selectAnnotation,
      onUpdateAnnotation: updateAnnotation,
      onCameraOverlayPositionChange: handleCameraOverlayPositionChange,
      onCameraOverlayScaleChange: handleCameraOverlayScaleChange,
      onCameraOverlayMarginChange: handleCameraOverlayMarginChange,
      onAudioSystemVolumeChange: handleAudioSystemVolumeChange,
      onAudioMicrophoneVolumeChange: handleAudioMicrophoneVolumeChange,
      onMicrophoneNoiseGateChange: handleMicrophoneNoiseGateChange,
      onColorBrightnessChange: handleColorBrightnessChange,
      onColorContrastChange: handleColorContrastChange,
      onColorSaturationChange: handleColorSaturationChange,
      onResetColorCorrection: handleResetColorCorrection,
      showExportModal,
      onSetShowExportModal: setShowExportModal,
      onSaveProject: saveProject,
    };
  }, [
    activeExportCount,
    activeSpeed,
    activeZoom,
    annotationInsertMode,
    cameraSrc,
    canDelete,
    canDeleteAnnotation,
    canDeleteSegment,
    canDeleteSpeed,
    canDeleteZoom,
    canRedo,
    canUndo,
    currentTime,
    duration,
    editedDuration,
    effectivePlaybackRate,
    handleAnnotationCommit,
    handleAnnotationPositionChange,
    handleBack,
    handleCameraOverlayCustomPositionChange,
    handleCameraOverlayMarginChange,
    handleCameraOverlayPositionChange,
    handleCameraOverlayScaleChange,
    handleCloseAnnotationInspector,
    handleCloseSpeedInspector,
    handleCloseZoomInspector,
    handleColorBrightnessChange,
    handleColorContrastChange,
    handleColorSaturationChange,
    handleDeleteSelected,
    handleDuplicateSelectedAnnotation,
    handleExport,
    handleMicrophoneNoiseGateChange,
    handleOpenProjectWindow,
    handleOpenVideos,
    handleResetColorCorrection,
    handleSpeedCommit,
    handleSpeedDraftChange,
    handleTimelineClick,
    handleZoomCommit,
    handleZoomDraftChange,
    isDirty,
    isPlaying,
    microphoneWaveform,
    handleAudioMicrophoneVolumeChange,
    handleAudioSystemVolumeChange,
    previewFilter,
    project,
    renameProject,
    screenWaveform,
    selectAnnotation,
    selectSegment,
    selectSpeed,
    selectZoom,
    selectedAnnotation,
    selectedAnnotationId,
    selectedSegmentId,
    selectedSpeed,
    selectedSpeedId,
    selectedTool,
    selectedZoom,
    selectedZoomId,
    setShowExportModal,
    skipBackward,
    skipForward,
    sourceToEditedTime,
    togglePlay,
    toggleTool,
    undo,
    updateAnnotation,
    updateSpeed,
    updateZoom,
    videoRef,
    videoSrc,
    videoZoomStyle,
    saveProject,
    redo,
  ]);

  return {
    isLoading,
    layoutProps,
  };
}
