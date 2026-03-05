import { useEffect, useMemo, useState } from "react";
import type {
  Annotation,
  Project,
  SpeedEffect,
  ZoomEffect,
} from "../../../types/project";

interface UseEditorPreviewStateOptions {
  project: Project | null;
  currentTime: number;
  selectedZoomId: string | null;
  selectedSpeedId: string | null;
  selectedAnnotationId: string | null;
  zoomDraft: { scale: number; x: number; y: number } | null;
  speedDraft: { speed: number } | null;
}

export function useEditorPreviewState({
  project,
  currentTime,
  selectedZoomId,
  selectedSpeedId,
  selectedAnnotationId,
  zoomDraft,
  speedDraft,
}: UseEditorPreviewStateOptions) {
  const [jklRateMultiplier, setJklRateMultiplier] = useState(1);
  const [annotationInsertMode, setAnnotationInsertMode] =
    useState<"outline" | "blur" | "text" | "arrow">("outline");

  const selectedZoom = useMemo<ZoomEffect | null>(() => {
    if (!project || !selectedZoomId) return null;
    return project.edits.zoom.find((zoom) => zoom.id === selectedZoomId) ?? null;
  }, [project, selectedZoomId]);

  const selectedSpeed = useMemo<SpeedEffect | null>(() => {
    if (!project || !selectedSpeedId) return null;
    return project.edits.speed.find((speed) => speed.id === selectedSpeedId) ?? null;
  }, [project, selectedSpeedId]);

  const selectedAnnotation = useMemo<Annotation | null>(() => {
    if (!project || !selectedAnnotationId) return null;
    return (
      project.edits.annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null
    );
  }, [project, selectedAnnotationId]);

  useEffect(() => {
    const selectedMode = selectedAnnotation?.mode;
    if (!selectedMode) return;
    setAnnotationInsertMode(selectedMode);
  }, [selectedAnnotation?.id, selectedAnnotation?.mode]);

  const activeZoom = useMemo(() => {
    if (!project) return null;
    return (
      project.edits.zoom.find(
        (zoom) => currentTime >= zoom.startTime && currentTime < zoom.endTime
      ) ?? null
    );
  }, [project, currentTime]);

  const activeSpeed = useMemo(() => {
    if (!project) return null;
    return (
      project.edits.speed.find(
        (speed) => currentTime >= speed.startTime && currentTime < speed.endTime
      ) ?? null
    );
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
      return { transform: "scale(1)", transformOrigin: "center center" };
    }

    const useDraft = zoomDraft && selectedZoomId === activeZoom.id;
    const scale = useDraft ? zoomDraft.scale : activeZoom.scale;
    const x = useDraft ? zoomDraft.x : activeZoom.x;
    const y = useDraft ? zoomDraft.y : activeZoom.y;

    const previewWidth = Math.max(1, project?.resolution.width ?? 1920);
    const previewHeight = Math.max(1, project?.resolution.height ?? 1080);
    const originX = 50 + (x / previewWidth) * 100;
    const originY = 50 + (y / previewHeight) * 100;
    return {
      transform: `scale(${scale})`,
      transformOrigin: `${originX}% ${originY}%`,
    };
  }, [activeZoom, selectedZoomId, zoomDraft, project?.resolution]);

  const previewFilter = useMemo(() => {
    const brightness = project?.edits.colorCorrection.brightness ?? 0;
    const contrast = project?.edits.colorCorrection.contrast ?? 1;
    const saturation = project?.edits.colorCorrection.saturation ?? 1;
    return `brightness(${1 + brightness}) contrast(${contrast}) saturate(${saturation})`;
  }, [project?.edits.colorCorrection]);

  return {
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
  };
}
