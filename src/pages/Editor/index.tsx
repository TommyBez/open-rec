import { useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Timeline } from "../../components/Timeline";
import { ExportModal } from "../../components/ExportModal";
import { useProject } from "../../hooks/useProject";
import { useEditorStore, useExportStore } from "../../stores";
import { Annotation, ZoomEffect, SpeedEffect } from "../../types/project";

// Extracted components
import { EditorHeader } from "./components/EditorHeader";
import { VideoPreview } from "./components/VideoPreview";
import { PlaybackControls } from "./components/PlaybackControls";
import { EditorInspectors } from "./components/EditorInspectors";
import { useEditorKeyboardShortcuts } from "./hooks/useEditorKeyboardShortcuts";
import { useVideoPlayback } from "./hooks/useVideoPlayback";
import { useWaveformData } from "./hooks/useWaveformData";
import { useEditedTimelineMetrics } from "./hooks/useEditedTimelineMetrics";
import { useEditorAutosaveLifecycle } from "./hooks/useEditorAutosaveLifecycle";
import { useEditorProjectLoader } from "./hooks/useEditorProjectLoader";
import { useEditorPreviewState } from "./hooks/useEditorPreviewState";

// Hoisted static JSX elements
const atmosphericGradient = (
  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
);

const loadingSpinner = (
  <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background">
    {atmosphericGradient}
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

  const createAnnotationAtPlayhead = useCallback(
    (mode: "outline" | "blur" | "text" | "arrow" = "outline") => {
      if (!project) return;
      const startTime = Math.max(0, currentTime);
      const endTime = Math.min(project.duration, startTime + 3);
      if (endTime - startTime > 0.1) {
        addAnnotation(startTime, endTime, mode);
        setAnnotationInsertMode(mode);
      }
    },
    [addAnnotation, currentTime, project]
  );

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  useEditorAutosaveLifecycle({ project, isDirty, saveProject });

  const handleDeleteSelected = useCallback(() => {
    if (selectedZoomId) { deleteZoom(selectedZoomId); selectZoom(null); }
    else if (selectedSpeedId) { deleteSpeed(selectedSpeedId); selectSpeed(null); }
    else if (selectedAnnotationId) { deleteAnnotation(selectedAnnotationId); selectAnnotation(null); }
    else if (selectedSegmentId && project && project.edits.segments.length > 1) {
      deleteSegment(selectedSegmentId);
      selectSegment(null);
    }
  }, [selectedZoomId, selectedSpeedId, selectedAnnotationId, selectedSegmentId, project, deleteZoom, deleteSpeed, deleteAnnotation, deleteSegment, selectZoom, selectSpeed, selectAnnotation, selectSegment]);
  const handleDuplicateSelectedAnnotation = useCallback(() => {
    if (!selectedAnnotationId) return;
    duplicateAnnotation(selectedAnnotationId);
  }, [duplicateAnnotation, selectedAnnotationId]);
  const handleNudgeSelectedAnnotation = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!selectedAnnotationId || !project) return;
      const annotation = project.edits.annotations.find((item) => item.id === selectedAnnotationId);
      if (!annotation) return;
      const width = Math.max(0.02, Math.min(1, annotation.width));
      const height = Math.max(0.02, Math.min(1, annotation.height));
      const nextX = Math.max(0, Math.min(1 - width, annotation.x + deltaX));
      const nextY = Math.max(0, Math.min(1 - height, annotation.y + deltaY));
      updateAnnotation(selectedAnnotationId, { x: nextX, y: nextY });
    },
    [selectedAnnotationId, project, updateAnnotation]
  );
  const handleManualSaveShortcut = useCallback(() => {
    saveProject().catch(console.error);
  }, [saveProject]);
  const handleOpenProjectWindow = useCallback(() => {
    if (!project) return;
    invoke("open_project_window", { projectId: project.id }).catch(console.error);
  }, [project]);

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

  // Memoized handlers
  const handleTimelineClick = useCallback((time: number) => {
    if (!project) { seek(time); return; }
    
    switch (selectedTool) {
      case "cut": cutAt(time); break;
      case "zoom": addZoom(time, Math.min(time + 5, duration), 1.5); break;
      case "speed": addSpeed(time, Math.min(time + 5, duration), 2.0); break;
      case "annotation": addAnnotation(time, Math.min(time + 3, duration), annotationInsertMode); break;
      default: seek(time);
    }
  }, [project, selectedTool, cutAt, addZoom, addSpeed, addAnnotation, annotationInsertMode, duration, seek]);

  const handleZoomDraftChange = useCallback((draft: { scale: number; x: number; y: number }) => setZoomDraft(draft), [setZoomDraft]);
  const handleSpeedDraftChange = useCallback((draft: { speed: number }) => setSpeedDraft(draft), [setSpeedDraft]);
  const handleZoomCommit = useCallback((updates: Partial<ZoomEffect>) => { if (selectedZoomId) updateZoom(selectedZoomId, updates); }, [selectedZoomId, updateZoom]);
  const handleSpeedCommit = useCallback((updates: Partial<SpeedEffect>) => { if (selectedSpeedId) updateSpeed(selectedSpeedId, updates); }, [selectedSpeedId, updateSpeed]);
  const handleAnnotationCommit = useCallback(
    (updates: Partial<Annotation>) => {
      if (selectedAnnotationId) {
        updateAnnotation(selectedAnnotationId, updates);
      }
    },
    [selectedAnnotationId, updateAnnotation]
  );
  const handleCloseZoomInspector = useCallback(() => { selectZoom(null); setZoomDraft(null); }, [selectZoom, setZoomDraft]);
  const handleCloseSpeedInspector = useCallback(() => { selectSpeed(null); setSpeedDraft(null); }, [selectSpeed, setSpeedDraft]);
  const handleCloseAnnotationInspector = useCallback(() => selectAnnotation(null), [selectAnnotation]);
  const handleBack = useCallback(() => navigate("/recorder"), [navigate]);
  const handleExport = useCallback(() => setShowExportModal(true), [setShowExportModal]);
  const handleOpenVideos = useCallback(() => {
    navigate("/videos", { state: { from: "editor", projectId } });
  }, [navigate, projectId]);

  // Derived delete state
  const canDeleteSegment = selectedSegmentId !== null && project && project.edits.segments.length > 1;
  const canDeleteZoom = selectedZoomId !== null;
  const canDeleteSpeed = selectedSpeedId !== null;
  const canDeleteAnnotation = selectedAnnotationId !== null;
  const canDelete = canDeleteSegment || canDeleteZoom || canDeleteSpeed || canDeleteAnnotation;

  if (isLoading || !project) return loadingSpinner;

  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background text-foreground">
      {atmosphericGradient}

      <EditorHeader
        projectName={project.name}
        isDirty={isDirty}
        onRename={renameProject}
        hasCameraTrack={Boolean(project.cameraVideoPath)}
        hasMicrophoneTrack={Boolean(project.microphoneAudioPath)}
        cameraOverlayPosition={project.edits.cameraOverlay.position}
        cameraOverlayScale={project.edits.cameraOverlay.scale}
        cameraOverlayMargin={project.edits.cameraOverlay.margin}
        audioSystemVolume={project.edits.audioMix.systemVolume}
        audioMicrophoneVolume={project.edits.audioMix.microphoneVolume}
        microphoneNoiseGate={project.edits.audioMix.microphoneNoiseGate}
        colorBrightness={project.edits.colorCorrection.brightness}
        colorContrast={project.edits.colorCorrection.contrast}
        colorSaturation={project.edits.colorCorrection.saturation}
        onCameraOverlayPositionChange={(position) =>
          updateCameraOverlay({ position })
        }
        onCameraOverlayScaleChange={(scale) =>
          updateCameraOverlay({ scale: Math.max(0.1, Math.min(0.6, scale)) })
        }
        onCameraOverlayMarginChange={(margin) =>
          updateCameraOverlay({ margin: Math.max(0, Math.min(100, Math.round(margin))) })
        }
        onAudioSystemVolumeChange={(volume) =>
          updateAudioMix({ systemVolume: Math.max(0, Math.min(2, volume)) })
        }
        onAudioMicrophoneVolumeChange={(volume) =>
          updateAudioMix({ microphoneVolume: Math.max(0, Math.min(2, volume)) })
        }
        onMicrophoneNoiseGateChange={(enabled) =>
          updateAudioMix({ microphoneNoiseGate: enabled })
        }
        onColorBrightnessChange={(value) =>
          updateColorCorrection({ brightness: Math.max(-1, Math.min(1, value)) })
        }
        onColorContrastChange={(value) =>
          updateColorCorrection({ contrast: Math.max(0.5, Math.min(2, value)) })
        }
        onColorSaturationChange={(value) =>
          updateColorCorrection({ saturation: Math.max(0, Math.min(2, value)) })
        }
        onResetColorCorrection={() =>
          updateColorCorrection({
            brightness: 0,
            contrast: 1,
            saturation: 1,
          })
        }
        onBack={handleBack}
        onExport={handleExport}
        onOpenVideos={handleOpenVideos}
        onOpenInNewWindow={handleOpenProjectWindow}
        activeExportCount={activeExportCount}
      />

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
            onAnnotationPositionChange={(annotationId, x, y) =>
              updateAnnotation(annotationId, {
                x: Math.max(0, Math.min(1, x)),
                y: Math.max(0, Math.min(1, y)),
              })
            }
            resolution={project.resolution}
            cameraSrc={cameraSrc}
            cameraOverlayPosition={project.edits.cameraOverlay.position}
            cameraOverlayScale={project.edits.cameraOverlay.scale}
            cameraOverlayMargin={project.edits.cameraOverlay.margin}
            cameraOverlayCustomX={project.edits.cameraOverlay.customX}
            cameraOverlayCustomY={project.edits.cameraOverlay.customY}
            onCameraOverlayCustomPositionChange={(x, y) =>
              updateCameraOverlay({
                position: "custom",
                customX: Math.min(1, Math.max(0, x)),
                customY: Math.min(1, Math.max(0, y)),
              })
            }
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
            canDeleteSegment={!!canDeleteSegment}
            canDeleteAnnotation={canDeleteAnnotation}
            annotationMode={annotationInsertMode}
            selectedTool={selectedTool}
            onTogglePlay={togglePlay}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onUndo={undo}
            onRedo={redo}
            onDelete={handleDeleteSelected}
            onToggleTool={toggleTool}
          />
        </div>

        <EditorInspectors
          selectedZoom={selectedZoom}
          selectedSpeed={selectedSpeed}
          selectedAnnotation={selectedAnnotation}
          resolution={project.resolution}
          maxDuration={project.duration}
          onZoomCommit={handleZoomCommit}
          onCloseZoom={handleCloseZoomInspector}
          onZoomDraftChange={handleZoomDraftChange}
          onSpeedCommit={handleSpeedCommit}
          onCloseSpeed={handleCloseSpeedInspector}
          onSpeedDraftChange={handleSpeedDraftChange}
          onAnnotationCommit={handleAnnotationCommit}
          onDuplicateAnnotation={handleDuplicateSelectedAnnotation}
          onCloseAnnotation={handleCloseAnnotationInspector}
        />
      </div>

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
          onSeek={handleTimelineClick}
          selectedTool={selectedTool}
          selectedSegmentId={selectedSegmentId}
          onSelectSegment={selectSegment}
          selectedZoomId={selectedZoomId}
          onSelectZoom={selectZoom}
          onUpdateZoom={updateZoom}
          selectedSpeedId={selectedSpeedId}
          onSelectSpeed={selectSpeed}
          onUpdateSpeed={updateSpeed}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={selectAnnotation}
          onUpdateAnnotation={updateAnnotation}
        />
      </div>

      <ExportModal
        project={project}
        editedDuration={editedDuration}
        open={showExportModal}
        onOpenChange={setShowExportModal}
        onSaveProject={saveProject}
      />
    </div>
  );
}
