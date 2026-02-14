import { memo, forwardRef, CSSProperties, useEffect, useMemo, useRef } from "react";
import { ZoomIn, Gauge, Film } from "lucide-react";
import { Annotation, ZoomEffect, SpeedEffect } from "../../../types/project";
import { useCameraOverlayDrag } from "../hooks/useCameraOverlayDrag";

interface VideoPreviewProps {
  videoSrc: string;
  videoZoomStyle: CSSProperties;
  activeZoom: ZoomEffect | null;
  activeSpeed: SpeedEffect | null;
  currentPlaybackRate: number;
  currentSourceTime: number;
  isPlaying: boolean;
  annotations: Annotation[];
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
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    const cameraOffsetSeconds = (cameraOffsetMs ?? 0) / 1000;
    const cameraTime = currentSourceTime - cameraOffsetSeconds;
    const showCamera = Boolean(cameraSrc) && cameraTime >= 0;
    const activeAnnotations = useMemo(
      () =>
        annotations.filter(
          (annotation) =>
            currentSourceTime >= annotation.startTime && currentSourceTime <= annotation.endTime
        ),
      [annotations, currentSourceTime]
    );
    const isCustomCameraOverlay = cameraOverlayPosition === "custom";
    const cameraOverlayWidthPercent = Math.min(40, Math.max(12, cameraOverlayScale * 100));
    const {
      customOverlayStyle,
      isDragging,
      handlePointerDown,
    } = useCameraOverlayDrag({
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

    useEffect(() => {
      const camera = cameraVideoRef.current;
      if (!camera || !cameraSrc || !showCamera) return;
      if (Math.abs(camera.currentTime - cameraTime) > 0.08) {
        camera.currentTime = Math.max(0, cameraTime);
      }
    }, [cameraSrc, cameraTime, showCamera]);

    useEffect(() => {
      const camera = cameraVideoRef.current;
      if (!camera || !cameraSrc) return;
      camera.playbackRate = currentPlaybackRate;
      if (!showCamera) {
        camera.pause();
        return;
      }
      if (isPlaying) {
        camera.play().catch(() => undefined);
      } else {
        camera.pause();
      }
    }, [cameraSrc, isPlaying, currentPlaybackRate, showCamera]);

    const cameraOverlayStyle = useMemo<CSSProperties>(() => {
      const margin = Math.max(0, cameraOverlayMargin);
      const style: CSSProperties = {
        position: "absolute",
        width: `${cameraOverlayWidthPercent}%`,
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        touchAction: "none",
      };
      if (isCustomCameraOverlay) {
        return {
          ...style,
          ...customOverlayStyle,
          cursor: isDragging ? "grabbing" : "grab",
        };
      }
      if (cameraOverlayPosition === "top-left" || cameraOverlayPosition === "bottom-left") {
        style.left = `${margin}px`;
      } else {
        style.right = `${margin}px`;
      }
      if (cameraOverlayPosition === "top-left" || cameraOverlayPosition === "top-right") {
        style.top = `${margin}px`;
      } else {
        style.bottom = `${margin}px`;
      }
      return style;
    }, [
      cameraOverlayMargin,
      cameraOverlayPosition,
      cameraOverlayWidthPercent,
      customOverlayStyle,
      isCustomCameraOverlay,
      isDragging,
    ]);

    if (!videoSrc) {
      return (
        <div className="studio-panel flex flex-1 items-center justify-center overflow-hidden rounded-xl">
          <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-card/50">
              <Film className="size-7 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <span className="text-sm">Video Preview</span>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {resolution.width}×{resolution.height}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="studio-panel flex flex-1 items-center justify-center overflow-hidden rounded-xl">
        <div
          ref={previewFrameRef}
          className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg"
        >
          <video
            ref={ref}
            src={videoSrc}
            className="max-h-full max-w-full transition-transform duration-150 ease-out"
            style={videoZoomStyle}
          />
          {showCamera && (
            <video
              ref={cameraVideoRef}
              src={cameraSrc}
              muted
              playsInline
              className={isCustomCameraOverlay ? "pointer-events-auto select-none" : "pointer-events-none"}
              style={cameraOverlayStyle}
              onPointerDown={isCustomCameraOverlay ? handlePointerDown : undefined}
            />
          )}
          {activeAnnotations.map((annotation) => {
            const mode = annotation.mode ?? "outline";
            const arrowStroke = Math.max(2, annotation.thickness);
            return (
              <div
                key={annotation.id}
                className="pointer-events-none absolute"
                style={{
                  left: `${Math.max(0, Math.min(1, annotation.x)) * 100}%`,
                  top: `${Math.max(0, Math.min(1, annotation.y)) * 100}%`,
                  width: `${Math.max(0.02, Math.min(1, annotation.width)) * 100}%`,
                  height: `${Math.max(0.02, Math.min(1, annotation.height)) * 100}%`,
                  borderStyle: "solid",
                  borderColor:
                    mode === "blur"
                      ? "rgba(255,255,255,0.85)"
                      : mode === "text"
                      ? "transparent"
                      : mode === "arrow"
                      ? "transparent"
                      : annotation.color,
                  borderWidth:
                    mode === "text" || mode === "arrow"
                      ? "0px"
                      : `${Math.max(1, annotation.thickness)}px`,
                  opacity: Math.max(0.1, Math.min(1, annotation.opacity)),
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.2)",
                  backdropFilter: mode === "blur" ? "blur(8px)" : undefined,
                  backgroundColor:
                    mode === "blur"
                      ? "rgba(0,0,0,0.15)"
                      : mode === "text"
                      ? "transparent"
                      : mode === "arrow"
                      ? "transparent"
                      : "transparent",
                }}
              >
                {mode === "arrow" && (
                  <>
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: "78%",
                        height: `${arrowStroke}px`,
                        backgroundColor: annotation.color,
                      }}
                    />
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2"
                      style={{
                        width: 0,
                        height: 0,
                        borderTop: `${arrowStroke * 1.6}px solid transparent`,
                        borderBottom: `${arrowStroke * 1.6}px solid transparent`,
                        borderLeft: `${arrowStroke * 2.6}px solid ${annotation.color}`,
                      }}
                    />
                  </>
                )}
                {annotation.text?.trim() && (
                  <span className="absolute left-1 top-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {annotation.text}
                  </span>
                )}
              </div>
            );
          })}
          {/* Effect indicator badges */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            {activeZoom && (
              <div className="flex items-center gap-1.5 rounded-md bg-violet-600/90 px-2 py-1 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
                <ZoomIn className="size-3" strokeWidth={2} />
                <span>{activeZoom.scale}x</span>
              </div>
            )}
            {activeSpeed && (
              <div className="flex items-center gap-1.5 rounded-md bg-accent/90 px-2 py-1 text-xs font-medium text-accent-foreground shadow-lg backdrop-blur-sm">
                <Gauge className="size-3" strokeWidth={2} />
                <span>{currentPlaybackRate}x</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
));
