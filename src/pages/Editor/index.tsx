import { useEffect, useMemo, useCallback, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "motion/react";
import { Timeline } from "../../components/Timeline";
import { ExportModal } from "../../components/ExportModal";
import { ZoomInspector } from "../../components/ZoomInspector";
import { SpeedInspector } from "../../components/SpeedInspector";
import { AnnotationInspector } from "../../components/AnnotationInspector";
import { useProject } from "../../hooks/useProject";
import { useEditorStore, useExportStore } from "../../stores";
import { Annotation, Project, ZoomEffect, SpeedEffect } from "../../types/project";

// Extracted components
import { EditorHeader } from "./components/EditorHeader";
import { VideoPreview } from "./components/VideoPreview";
import { PlaybackControls } from "./components/PlaybackControls";
import { useVideoPlayback } from "./hooks/useVideoPlayback";
import { useWaveformData } from "./hooks/useWaveformData";

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

function normalizeProject(project: Project): Project {
  const overlay = project.edits.cameraOverlay;
  const audioMix = project.edits.audioMix;
  const annotations = project.edits.annotations;
  return {
    ...project,
    edits: {
      ...project.edits,
      cameraOverlay: {
        ...(overlay ?? {
          position: "bottom-right",
          margin: 20,
          scale: 0.25,
        }),
        customX: overlay?.customX ?? 1,
        customY: overlay?.customY ?? 1,
      },
      audioMix: {
        systemVolume: audioMix?.systemVolume ?? 1,
        microphoneVolume: audioMix?.microphoneVolume ?? 1,
      },
      annotations: annotations ?? [],
    },
  };
}

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
  const [jklRateMultiplier, setJklRateMultiplier] = useState(1);

  // Derived state
  const selectedZoom = useMemo(() => {
    if (!project || !selectedZoomId) return null;
    return project.edits.zoom.find((z) => z.id === selectedZoomId) ?? null;
  }, [project, selectedZoomId]);

  const selectedSpeed = useMemo(() => {
    if (!project || !selectedSpeedId) return null;
    return project.edits.speed.find((s) => s.id === selectedSpeedId) ?? null;
  }, [project, selectedSpeedId]);

  const selectedAnnotation = useMemo(() => {
    if (!project || !selectedAnnotationId) return null;
    return project.edits.annotations.find((a) => a.id === selectedAnnotationId) ?? null;
  }, [project, selectedAnnotationId]);

  const activeZoom = useMemo(() => {
    if (!project) return null;
    return project.edits.zoom.find(
      (z) => currentTime >= z.startTime && currentTime < z.endTime
    ) ?? null;
  }, [project, currentTime]);

  const activeSpeed = useMemo(() => {
    if (!project) return null;
    return project.edits.speed.find(
      (s) => currentTime >= s.startTime && currentTime < s.endTime
    ) ?? null;
  }, [project, currentTime]);

  const currentPlaybackRate = useMemo(() => {
    if (!activeSpeed) return 1;
    const useDraft = speedDraft && selectedSpeedId === activeSpeed.id;
    return useDraft ? speedDraft.speed : activeSpeed.speed;
  }, [activeSpeed, selectedSpeedId, speedDraft]);

  const effectivePlaybackRate = useMemo(
    () => Math.min(currentPlaybackRate * jklRateMultiplier, 8),
    [currentPlaybackRate, jklRateMultiplier]
  );

  const videoZoomStyle = useMemo(() => {
    if (!activeZoom) {
      return { transform: 'scale(1)', transformOrigin: 'center center' };
    }
    
    const useDraft = zoomDraft && selectedZoomId === activeZoom.id;
    const scale = useDraft ? zoomDraft.scale : activeZoom.scale;
    const x = useDraft ? zoomDraft.x : activeZoom.x;
    const y = useDraft ? zoomDraft.y : activeZoom.y;
    
    const originX = 50 + (x / (project?.resolution.width ?? 1920)) * 100;
    const originY = 50 + (y / (project?.resolution.height ?? 1080)) * 100;
    
    return {
      transform: `scale(${scale})`,
      transformOrigin: `${originX}% ${originY}%`,
    };
  }, [activeZoom, selectedZoomId, zoomDraft, project?.resolution]);

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

  // Segments and duration calculation
  const { enabledSegments, editedDuration, sourceToEditedTime } = useMemo(() => {
    if (!project) return { enabledSegments: [], editedDuration: 0, sourceToEditedTime: () => 0 };
    
    const sorted = project.edits.segments
      .filter((s) => s.enabled)
      .sort((a, b) => a.startTime - b.startTime);
    
    const speedEffects = project.edits.speed.filter(
      (s) => Math.abs(s.speed - 1.0) > 0.01
    );
    
    const getSpeedAt = (time: number): number => {
      for (const effect of speedEffects) {
        if (time >= effect.startTime && time < effect.endTime) {
          return effect.speed;
        }
      }
      return 1.0;
    };
    
    const getAdjustedDuration = (start: number, end: number): number => {
      if (speedEffects.length === 0) return end - start;
      
      const breakpoints = new Set<number>([start, end]);
      for (const effect of speedEffects) {
        if (effect.startTime > start && effect.startTime < end) breakpoints.add(effect.startTime);
        if (effect.endTime > start && effect.endTime < end) breakpoints.add(effect.endTime);
      }
      
      const sortedPoints = Array.from(breakpoints).sort((a, b) => a - b);
      let totalAdjusted = 0;
      
      for (let i = 0; i < sortedPoints.length - 1; i++) {
        const segStart = sortedPoints[i];
        const segEnd = sortedPoints[i + 1];
        totalAdjusted += (segEnd - segStart) / getSpeedAt(segStart);
      }
      
      return totalAdjusted;
    };
    
    let editedOffset = 0;
    const segmentInfo: Array<{ seg: typeof sorted[0]; clampedStart: number; clampedEnd: number; editedStart: number }> = [];
    
    for (const seg of sorted) {
      const clampedStart = Math.max(0, Math.min(seg.startTime, duration));
      const clampedEnd = Math.max(0, Math.min(seg.endTime, duration));
      const segDuration = Math.max(0, clampedEnd - clampedStart);
      
      if (segDuration > 0) {
        segmentInfo.push({ seg, clampedStart, clampedEnd, editedStart: editedOffset });
        editedOffset += getAdjustedDuration(clampedStart, clampedEnd);
      }
    }
    
    const sourceToEdited = (sourceTime: number): number => {
      for (const info of segmentInfo) {
        if (sourceTime >= info.clampedStart && sourceTime <= info.clampedEnd) {
          return info.editedStart + (sourceTime - info.clampedStart);
        }
      }
      return editedOffset;
    };
    
    return { enabledSegments: sorted, editedDuration: editedOffset || duration, sourceToEditedTime: sourceToEdited };
  }, [project, duration]);

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
  }, [projectId]);

  // Auto-save
  useEffect(() => {
    if (isDirty && project) {
      const timeout = setTimeout(() => saveProject().catch(console.error), 5000);
      return () => clearTimeout(timeout);
    }
  }, [isDirty, project, saveProject]);

  useEffect(() => {
    const flushSave = () => {
      if (isDirty) {
        saveProject().catch(console.error);
      }
    };
    window.addEventListener("beforeunload", flushSave);
    return () => window.removeEventListener("beforeunload", flushSave);
  }, [isDirty, saveProject]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedZoomId) { deleteZoom(selectedZoomId); selectZoom(null); }
    else if (selectedSpeedId) { deleteSpeed(selectedSpeedId); selectSpeed(null); }
    else if (selectedAnnotationId) { deleteAnnotation(selectedAnnotationId); selectAnnotation(null); }
    else if (selectedSegmentId && project && project.edits.segments.length > 1) {
      deleteSegment(selectedSegmentId);
      selectSegment(null);
    }
  }, [selectedZoomId, selectedSpeedId, selectedAnnotationId, selectedSegmentId, project, deleteZoom, deleteSpeed, deleteAnnotation, deleteSegment, selectZoom, selectSpeed, selectAnnotation, selectSegment]);

  // Keyboard shortcuts (undo/redo + JKL transport controls)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable='true']")) {
        return;
      }

      const isModifier = e.metaKey || e.ctrlKey;
      if (isModifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if (isModifier && ((e.key === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        if (canRedo) redo();
      }
      if (isModifier) return;

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setJklRateMultiplier(1);
        if (isPlaying) togglePlay();
      }
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (!isPlaying) {
          setJklRateMultiplier(1);
          togglePlay();
        } else {
          setJklRateMultiplier((current) => (current >= 4 ? 1 : current >= 2 ? 4 : 2));
        }
      }
      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        setJklRateMultiplier(1);
        if (isPlaying) togglePlay();
        skipBackward();
      }

      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (!project) return;
        const startTime = Math.max(0, currentTime);
        const endTime = Math.min(project.duration, startTime + 3);
        if (endTime - startTime > 0.1) {
          addAnnotation(startTime, endTime);
        }
      }

      if (e.key === "1") {
        e.preventDefault();
        toggleTool("cut");
      }

      if (e.key === "2") {
        e.preventDefault();
        toggleTool("zoom");
      }

      if (e.key === "3") {
        e.preventDefault();
        toggleTool("speed");
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedZoomId || selectedSpeedId || selectedAnnotationId || selectedSegmentId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const frameStep = (e.shiftKey ? 10 : 1) / 30;
        seek(Math.max(0, currentTime - frameStep));
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const frameStep = (e.shiftKey ? 10 : 1) / 30;
        seek(Math.min(duration, currentTime + frameStep));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    isPlaying,
    togglePlay,
    skipBackward,
    project,
    addAnnotation,
    toggleTool,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    selectedSegmentId,
    handleDeleteSelected,
    currentTime,
    duration,
    seek,
  ]);

  async function loadProject(id: string) {
    setIsLoading(true);
    try {
      const result = await invoke<Project>("load_project", { projectId: id });
      const normalizedProject = normalizeProject(result);
      setProject(normalizedProject);
      setDuration(normalizedProject.duration);
    } catch (error) {
      console.error("Failed to load project:", error);
      const mockProject: Project = {
        id: id,
        name: `Recording ${id.slice(0, 8)}`,
        createdAt: new Date().toISOString(),
        screenVideoPath: "",
        duration: 274.8,
        resolution: { width: 1920, height: 1080 },
        edits: {
          segments: [{ id: crypto.randomUUID(), startTime: 0, endTime: 274.8, enabled: true }],
          zoom: [],
          speed: [],
          annotations: [],
          cameraOverlay: {
            position: "bottom-right",
            margin: 20,
            scale: 0.25,
            customX: 1,
            customY: 1,
          },
          audioMix: {
            systemVolume: 1,
            microphoneVolume: 1,
          },
        },
      };
      setProject(mockProject);
      setDuration(mockProject.duration);
    } finally {
      setIsLoading(false);
    }
  }

  // Memoized handlers
  const handleTimelineClick = useCallback((time: number) => {
    if (!project) { seek(time); return; }
    
    switch (selectedTool) {
      case "cut": cutAt(time); break;
      case "zoom": addZoom(time, Math.min(time + 5, duration), 1.5); break;
      case "speed": addSpeed(time, Math.min(time + 5, duration), 2.0); break;
      default: seek(time);
    }
  }, [project, selectedTool, cutAt, addZoom, addSpeed, duration, seek]);

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
  const handleAddAnnotation = useCallback(() => {
    if (!project) return;
    const startTime = Math.max(0, currentTime);
    const endTime = Math.min(project.duration, startTime + 3);
    if (endTime - startTime > 0.1) {
      addAnnotation(startTime, endTime);
    }
  }, [addAnnotation, currentTime, project]);

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
        onBack={handleBack}
        onExport={handleExport}
        onOpenVideos={handleOpenVideos}
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
            annotations={project.edits.annotations}
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
            selectedTool={selectedTool}
            onTogglePlay={togglePlay}
            onSkipBackward={skipBackward}
            onSkipForward={skipForward}
            onUndo={undo}
            onRedo={redo}
            onDelete={handleDeleteSelected}
            onToggleTool={toggleTool}
            onAddAnnotation={handleAddAnnotation}
          />
        </div>

        {/* Zoom Inspector Sidebar */}
        <AnimatePresence>
          {selectedZoom && (
            <motion.aside
              key="zoom-inspector"
              className="shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0, x: 16 }}
              animate={{ width: 256, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Zoom settings"
            >
              <ZoomInspector
                zoom={selectedZoom}
                resolution={project.resolution}
                onCommit={handleZoomCommit}
                onClose={handleCloseZoomInspector}
                onDraftChange={handleZoomDraftChange}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Speed Inspector Sidebar */}
        <AnimatePresence>
          {selectedSpeed && (
            <motion.aside
              key="speed-inspector"
              className="shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0, x: 16 }}
              animate={{ width: 256, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Speed settings"
            >
              <SpeedInspector
                speed={selectedSpeed}
                onCommit={handleSpeedCommit}
                onClose={handleCloseSpeedInspector}
                onDraftChange={handleSpeedDraftChange}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Annotation Inspector Sidebar */}
        <AnimatePresence>
          {selectedAnnotation && (
            <motion.aside
              key="annotation-inspector"
              className="shrink-0 overflow-hidden"
              initial={{ width: 0, opacity: 0, x: 16 }}
              animate={{ width: 256, opacity: 1, x: 0 }}
              exit={{ width: 0, opacity: 0, x: 16 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Annotation settings"
            >
              <AnnotationInspector
                annotation={selectedAnnotation}
                maxDuration={project.duration}
                onCommit={handleAnnotationCommit}
                onClose={handleCloseAnnotationInspector}
              />
            </motion.aside>
          )}
        </AnimatePresence>
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
