import { memo, forwardRef, CSSProperties, useEffect, useMemo, useRef } from "react";
import { ZoomIn, Gauge, Film } from "lucide-react";
import { ZoomEffect, SpeedEffect } from "../../../types/project";

interface VideoPreviewProps {
  videoSrc: string;
  videoZoomStyle: CSSProperties;
  activeZoom: ZoomEffect | null;
  activeSpeed: SpeedEffect | null;
  currentPlaybackRate: number;
  currentSourceTime: number;
  isPlaying: boolean;
  resolution: { width: number; height: number };
  cameraSrc?: string;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
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
      resolution,
      cameraSrc,
      cameraOverlayPosition,
      cameraOverlayScale,
      cameraOverlayMargin,
      cameraOffsetMs,
    },
    ref
  ) {
    const cameraVideoRef = useRef<HTMLVideoElement>(null);
    const cameraOffsetSeconds = (cameraOffsetMs ?? 0) / 1000;
    const cameraTime = currentSourceTime - cameraOffsetSeconds;
    const showCamera = Boolean(cameraSrc) && cameraTime >= 0;

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
        width: `${Math.max(12, cameraOverlayScale * 100)}%`,
        maxWidth: "40%",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      };
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
    }, [cameraOverlayMargin, cameraOverlayPosition, cameraOverlayScale]);

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
        <div className="relative flex max-h-full max-w-full items-center justify-center overflow-hidden rounded-lg">
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
              className="pointer-events-none"
              style={cameraOverlayStyle}
            />
          )}
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
