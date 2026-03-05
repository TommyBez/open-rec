import type { CSSProperties, RefObject } from "react";
import { useMemo, useRef } from "react";
import { useCameraOverlayDrag } from "./useCameraOverlayDrag";
import { useCameraPreviewSync } from "./useCameraPreviewSync";
import { buildCameraOverlayStyle } from "../components/videoPreviewUtils";

interface UseVideoPreviewCameraOverlayOptions {
  previewFrameRef: RefObject<HTMLDivElement | null>;
  cameraSrc?: string;
  currentSourceTime: number;
  currentPlaybackRate: number;
  isPlaying: boolean;
  cameraOffsetMs?: number;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
  cameraOverlayCustomX: number;
  cameraOverlayCustomY: number;
  onCameraOverlayCustomPositionChange?: (x: number, y: number) => void;
}

export function useVideoPreviewCameraOverlay({
  previewFrameRef,
  cameraSrc,
  currentSourceTime,
  currentPlaybackRate,
  isPlaying,
  cameraOffsetMs,
  cameraOverlayPosition,
  cameraOverlayScale,
  cameraOverlayMargin,
  cameraOverlayCustomX,
  cameraOverlayCustomY,
  onCameraOverlayCustomPositionChange,
}: UseVideoPreviewCameraOverlayOptions) {
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraOffsetSeconds = (cameraOffsetMs ?? 0) / 1000;
  const cameraTime = currentSourceTime - cameraOffsetSeconds;
  const showCamera = Boolean(cameraSrc) && cameraTime >= 0;
  const isCustomCameraOverlay = cameraOverlayPosition === "custom";
  const cameraOverlayWidthPercent = Math.min(40, Math.max(12, cameraOverlayScale * 100));

  const { customOverlayStyle, isDragging, handlePointerDown } = useCameraOverlayDrag({
    enabled:
      showCamera &&
      isCustomCameraOverlay &&
      typeof onCameraOverlayCustomPositionChange === "function",
    customX: cameraOverlayCustomX,
    customY: cameraOverlayCustomY,
    containerRef: previewFrameRef,
    overlayRef: cameraVideoRef,
    onCommit: (x, y) => {
      onCameraOverlayCustomPositionChange?.(x, y);
    },
  });

  useCameraPreviewSync({
    cameraVideoRef,
    cameraSrc,
    showCamera,
    cameraTime,
    currentPlaybackRate,
    isPlaying,
  });

  const cameraOverlayStyle = useMemo<CSSProperties>(() => {
    return buildCameraOverlayStyle({
      cameraOverlayMargin,
      cameraOverlayPosition,
      cameraOverlayWidthPercent,
      isCustomCameraOverlay,
      customOverlayStyle,
      isDragging,
    });
  }, [
    cameraOverlayMargin,
    cameraOverlayPosition,
    cameraOverlayWidthPercent,
    isCustomCameraOverlay,
    customOverlayStyle,
    isDragging,
  ]);

  return {
    cameraVideoRef,
    showCamera,
    cameraOverlayStyle,
    isCustomCameraOverlay,
    handlePointerDown,
  };
}
