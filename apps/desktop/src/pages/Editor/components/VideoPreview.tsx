import { memo, forwardRef, CSSProperties, useMemo, useRef } from "react";
import { Annotation, ZoomEffect, SpeedEffect } from "../../../types/project";
import { useAnnotationOverlayDrag } from "../hooks/useAnnotationOverlayDrag";
import { useVideoPreviewCameraOverlay } from "../hooks/useVideoPreviewCameraOverlay";
import { AnnotationOverlayLayer } from "./AnnotationOverlayLayer";
import { VideoPreviewEmptyState } from "./VideoPreviewEmptyState";
import { VideoEffectBadges } from "./VideoEffectBadges";
import { CameraOverlayVideo } from "./CameraOverlayVideo";

interface VideoPreviewProps {
  videoSrc: string;
  videoZoomStyle: CSSProperties;
  activeZoom: ZoomEffect | null;
  activeSpeed: SpeedEffect | null;
  currentPlaybackRate: number;
  currentSourceTime: number;
  isPlaying: boolean;
  annotations: Annotation[];
  previewFilter: string;
  selectedAnnotationId?: string | null;
  onAnnotationPositionChange?: (annotationId: string, x: number, y: number) => void;
  resolution: { width: number; height: number };
  cameraSrc?: string;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
  cameraOverlayCustomX: number;
  cameraOverlayCustomY: number;
  onCameraOverlayCustomPositionChange?: (x: number, y: number) => void;
  cameraOffsetMs?: number;
}

export const VideoPreview = memo(forwardRef<HTMLVideoElement, VideoPreviewProps>(
  function VideoPreview(
    {
      videoSrc,
      videoZoomStyle,
      activeZoom,
      activeSpeed,
      currentPlaybackRate,
      currentSourceTime,
      isPlaying,
      annotations,
      previewFilter,
      selectedAnnotationId,
      onAnnotationPositionChange,
      resolution,
      cameraSrc,
      cameraOverlayPosition,
      cameraOverlayScale,
      cameraOverlayMargin,
      cameraOverlayCustomX,
      cameraOverlayCustomY,
      onCameraOverlayCustomPositionChange,
      cameraOffsetMs,
    },
    ref
  ) {
    const previewFrameRef = useRef<HTMLDivElement>(null);
    const activeAnnotations = useMemo(
      () =>
        annotations.filter(
          (annotation) =>
            currentSourceTime >= annotation.startTime && currentSourceTime <= annotation.endTime
        ),
      [annotations, currentSourceTime]
    );
    const {
      cameraVideoRef,
      showCamera,
      cameraOverlayStyle,
      isCustomCameraOverlay,
      handlePointerDown,
    } = useVideoPreviewCameraOverlay({
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
    });
    const { getAnnotationRenderPosition, handleAnnotationPointerDown } =
      useAnnotationOverlayDrag({
        selectedAnnotationId,
        onAnnotationPositionChange,
        containerRef: previewFrameRef,
      });

    if (!videoSrc) {
      return <VideoPreviewEmptyState width={resolution.width} height={resolution.height} />;
    }

    return (
      <div className="studio-panel flex flex-1 items-center justify-center overflow-hidden rounded-xl">
        <div
          ref={previewFrameRef}
          className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg"
          style={{ filter: previewFilter }}
        >
          <video
            ref={ref}
            src={videoSrc}
            className="max-h-full max-w-full transition-transform duration-150 ease-out"
            style={videoZoomStyle}
          />
          {showCamera && cameraSrc && (
            <CameraOverlayVideo
              cameraVideoRef={cameraVideoRef}
              cameraSrc={cameraSrc}
              isCustomCameraOverlay={isCustomCameraOverlay}
              cameraOverlayStyle={cameraOverlayStyle}
              onPointerDown={handlePointerDown}
            />
          )}
          <AnnotationOverlayLayer
            annotations={activeAnnotations}
            selectedAnnotationId={selectedAnnotationId}
            getAnnotationRenderPosition={getAnnotationRenderPosition}
            onAnnotationPointerDown={handleAnnotationPointerDown}
          />
          <VideoEffectBadges
            activeZoom={activeZoom}
            activeSpeed={activeSpeed}
            currentPlaybackRate={currentPlaybackRate}
          />
        </div>
      </div>
    );
  }
));
