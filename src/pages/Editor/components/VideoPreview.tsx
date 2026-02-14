import { memo, forwardRef, CSSProperties } from "react";
import { ZoomIn, Gauge, Film } from "lucide-react";
import { ZoomEffect, SpeedEffect } from "../../../types/project";

interface VideoPreviewProps {
  videoSrc: string;
  videoZoomStyle: CSSProperties;
  activeZoom: ZoomEffect | null;
  activeSpeed: SpeedEffect | null;
  currentPlaybackRate: number;
  resolution: { width: number; height: number };
}

export const VideoPreview = memo(forwardRef<HTMLVideoElement, VideoPreviewProps>(
  function VideoPreview(
    { videoSrc, videoZoomStyle, activeZoom, activeSpeed, currentPlaybackRate, resolution },
    ref
  ) {
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
