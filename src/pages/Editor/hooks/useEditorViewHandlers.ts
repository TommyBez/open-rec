import { useCallback } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { Annotation, Project, SpeedEffect, ZoomEffect } from "../../../types/project";

interface UseEditorViewHandlersOptions {
  project: Project | null;
  projectId?: string;
  currentTime: number;
  duration: number;
  selectedTool: "cut" | "zoom" | "speed" | "annotation" | null;
  annotationInsertMode: "outline" | "blur" | "text" | "arrow";
  selectedZoomId: string | null;
  selectedSpeedId: string | null;
  selectedAnnotationId: string | null;
  addAnnotation: (startTime: number, endTime: number, mode?: "outline" | "blur" | "text" | "arrow") => void;
  addZoom: (startTime: number, endTime: number, scale?: number) => void;
  addSpeed: (startTime: number, endTime: number, speed?: number) => void;
  cutAt: (time: number) => void;
  seek: (time: number) => void;
  setShowExportModal: (show: boolean) => void;
  setZoomDraft: (draft: { scale: number; x: number; y: number } | null) => void;
  setSpeedDraft: (draft: { speed: number } | null) => void;
  setAnnotationInsertMode: (mode: "outline" | "blur" | "text" | "arrow") => void;
  updateZoom: (id: string, updates: Partial<ZoomEffect>) => void;
  updateSpeed: (id: string, updates: Partial<SpeedEffect>) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  selectZoom: (id: string | null) => void;
  selectSpeed: (id: string | null) => void;
  selectAnnotation: (id: string | null) => void;
  navigate: NavigateFunction;
}

export function useEditorViewHandlers({
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
}: UseEditorViewHandlersOptions) {
  const createAnnotationAtPlayhead = useCallback(
    (mode: "outline" | "blur" | "text" | "arrow" = "outline") => {
      if (!project) return;
      const startTime = Math.max(0, currentTime);
      const endTime = Math.min(project.duration, startTime + 3);
      if (endTime - startTime <= 0.1) return;
      addAnnotation(startTime, endTime, mode);
      setAnnotationInsertMode(mode);
    },
    [addAnnotation, currentTime, project, setAnnotationInsertMode]
  );

  const handleTimelineClick = useCallback(
    (time: number) => {
      if (!project) {
        seek(time);
        return;
      }
      switch (selectedTool) {
        case "cut":
          cutAt(time);
          break;
        case "zoom":
          addZoom(time, Math.min(time + 5, duration), 1.5);
          break;
        case "speed":
          addSpeed(time, Math.min(time + 5, duration), 2.0);
          break;
        case "annotation":
          addAnnotation(time, Math.min(time + 3, duration), annotationInsertMode);
          break;
        default:
          seek(time);
      }
    },
    [
      addAnnotation,
      addSpeed,
      addZoom,
      annotationInsertMode,
      cutAt,
      duration,
      project,
      seek,
      selectedTool,
    ]
  );

  const handleZoomDraftChange = useCallback(
    (draft: { scale: number; x: number; y: number }) => setZoomDraft(draft),
    [setZoomDraft]
  );
  const handleSpeedDraftChange = useCallback(
    (draft: { speed: number }) => setSpeedDraft(draft),
    [setSpeedDraft]
  );
  const handleZoomCommit = useCallback(
    (updates: Partial<ZoomEffect>) => {
      if (selectedZoomId) updateZoom(selectedZoomId, updates);
    },
    [selectedZoomId, updateZoom]
  );
  const handleSpeedCommit = useCallback(
    (updates: Partial<SpeedEffect>) => {
      if (selectedSpeedId) updateSpeed(selectedSpeedId, updates);
    },
    [selectedSpeedId, updateSpeed]
  );
  const handleAnnotationCommit = useCallback(
    (updates: Partial<Annotation>) => {
      if (selectedAnnotationId) updateAnnotation(selectedAnnotationId, updates);
    },
    [selectedAnnotationId, updateAnnotation]
  );

  const handleCloseZoomInspector = useCallback(() => {
    selectZoom(null);
    setZoomDraft(null);
  }, [selectZoom, setZoomDraft]);

  const handleCloseSpeedInspector = useCallback(() => {
    selectSpeed(null);
    setSpeedDraft(null);
  }, [selectSpeed, setSpeedDraft]);

  const handleCloseAnnotationInspector = useCallback(
    () => selectAnnotation(null),
    [selectAnnotation]
  );

  const handleBack = useCallback(() => navigate("/recorder"), [navigate]);
  const handleExport = useCallback(() => setShowExportModal(true), [setShowExportModal]);
  const handleOpenVideos = useCallback(() => {
    navigate("/videos", { state: { from: "editor", projectId } });
  }, [navigate, projectId]);

  return {
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
  };
}
