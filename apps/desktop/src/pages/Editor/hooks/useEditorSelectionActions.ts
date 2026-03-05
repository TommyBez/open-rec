import { useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../../../types/project";

interface UseEditorSelectionActionsOptions {
  project: Project | null;
  selectedZoomId: string | null;
  selectedSpeedId: string | null;
  selectedAnnotationId: string | null;
  selectedSegmentId: string | null;
  deleteZoom: (id: string) => void;
  deleteSpeed: (id: string) => void;
  deleteAnnotation: (id: string) => void;
  deleteSegment: (id: string) => void;
  selectZoom: (id: string | null) => void;
  selectSpeed: (id: string | null) => void;
  selectAnnotation: (id: string | null) => void;
  selectSegment: (id: string | null) => void;
  duplicateAnnotation: (id: string) => void;
  updateAnnotation: (id: string, updates: { x?: number; y?: number }) => void;
  saveProject: () => Promise<void>;
}

export function useEditorSelectionActions({
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
}: UseEditorSelectionActionsOptions) {
  const handleDeleteSelected = useCallback(() => {
    if (selectedZoomId) {
      deleteZoom(selectedZoomId);
      selectZoom(null);
      return;
    }
    if (selectedSpeedId) {
      deleteSpeed(selectedSpeedId);
      selectSpeed(null);
      return;
    }
    if (selectedAnnotationId) {
      deleteAnnotation(selectedAnnotationId);
      selectAnnotation(null);
      return;
    }
    if (selectedSegmentId && project && project.edits.segments.length > 1) {
      deleteSegment(selectedSegmentId);
      selectSegment(null);
    }
  }, [
    deleteAnnotation,
    deleteSegment,
    deleteSpeed,
    deleteZoom,
    project,
    selectAnnotation,
    selectSegment,
    selectSpeed,
    selectZoom,
    selectedAnnotationId,
    selectedSegmentId,
    selectedSpeedId,
    selectedZoomId,
  ]);

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
    [project, selectedAnnotationId, updateAnnotation]
  );

  const handleManualSaveShortcut = useCallback(() => {
    saveProject().catch(console.error);
  }, [saveProject]);

  const handleOpenProjectWindow = useCallback(() => {
    if (!project) return;
    invoke("open_project_window", { projectId: project.id }).catch(console.error);
  }, [project]);

  const canDeleteSegment = useMemo(
    () => selectedSegmentId !== null && !!project && project.edits.segments.length > 1,
    [project, selectedSegmentId]
  );
  const canDeleteZoom = useMemo(() => selectedZoomId !== null, [selectedZoomId]);
  const canDeleteSpeed = useMemo(() => selectedSpeedId !== null, [selectedSpeedId]);
  const canDeleteAnnotation = useMemo(
    () => selectedAnnotationId !== null,
    [selectedAnnotationId]
  );
  const canDelete = useMemo(
    () => canDeleteSegment || canDeleteZoom || canDeleteSpeed || canDeleteAnnotation,
    [canDeleteAnnotation, canDeleteSegment, canDeleteSpeed, canDeleteZoom]
  );

  return {
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
  };
}
