import { Gauge, ZoomIn } from "lucide-react";
import type { SpeedEffect, ZoomEffect } from "../../../types/project";

interface VideoEffectBadgesProps {
  activeZoom: ZoomEffect | null;
  activeSpeed: SpeedEffect | null;
  currentPlaybackRate: number;
}

export function VideoEffectBadges({
  activeZoom,
  activeSpeed,
  currentPlaybackRate,
}: VideoEffectBadgesProps) {
  return (
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
  );
}
