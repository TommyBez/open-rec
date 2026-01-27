import { useState, useEffect, useRef, useCallback } from "react";
import { X, RotateCcw, ZoomIn } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ZoomEffect } from "../../types/project";

interface ZoomInspectorProps {
  zoom: ZoomEffect;
  resolution: { width: number; height: number };
  onCommit: (updates: Partial<ZoomEffect>) => void;
  onClose: () => void;
  /** Called on every draft change for live preview */
  onDraftChange?: (draft: { scale: number; x: number; y: number }) => void;
}

/**
 * Calculate max allowed offset - allows focus to reach the edges of the frame.
 * At max offset, the center of the zoomed view is at the edge of the video.
 */
function getMaxOffset(dimension: number): number {
  return dimension / 2;
}

/**
 * Clamp a value to [-max, max]
 */
function clamp(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

export function ZoomInspector({
  zoom,
  resolution,
  onCommit,
  onClose,
  onDraftChange,
}: ZoomInspectorProps) {
  // Draft state for live preview without spamming undo history
  const [draft, setDraft] = useState({
    scale: zoom.scale,
    x: zoom.x,
    y: zoom.y,
  });

  // Reset draft when zoom.id changes (different zoom selected)
  useEffect(() => {
    setDraft({
      scale: zoom.scale,
      x: zoom.x,
      y: zoom.y,
    });
  }, [zoom.id, zoom.scale, zoom.x, zoom.y]);

  // Notify parent of draft changes for live preview
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  // Pad interaction state
  const padRef = useRef<HTMLDivElement>(null);
  const [isDraggingPad, setIsDraggingPad] = useState(false);

  // Calculate max offsets - full range allows focus to reach edges
  const maxX = getMaxOffset(resolution.width);
  const maxY = getMaxOffset(resolution.height);

  // Update scale
  const handleScaleChange = useCallback(
    (values: number[]) => {
      const newScale = values[0];
      setDraft((prev) => ({ ...prev, scale: newScale }));
    },
    []
  );

  // Commit scale on slider release
  const handleScaleCommit = useCallback(
    (values: number[]) => {
      const newScale = values[0];
      onCommit({ scale: newScale });
    },
    [onCommit]
  );

  // Convert pad position (0-1) to pixel offset
  // The pad represents the full video frame - position is where the zoom focuses
  const padPositionToOffset = useCallback(
    (posX: number, posY: number) => {
      // posX/posY are 0-1 where 0.5 is center of video
      // Map to pixel offset from center: [-width/2, width/2] then clamp to valid range
      const rawX = (posX - 0.5) * resolution.width;
      const rawY = (posY - 0.5) * resolution.height;
      return { x: clamp(rawX, maxX), y: clamp(rawY, maxY) };
    },
    [resolution.width, resolution.height, maxX, maxY]
  );

  // Convert pixel offset to pad position (0-1)
  // Maps offset back to position on the full video frame
  const offsetToPadPosition = useCallback(
    (x: number, y: number) => {
      const posX = x / resolution.width + 0.5;
      const posY = y / resolution.height + 0.5;
      return {
        posX: Math.max(0, Math.min(1, posX)),
        posY: Math.max(0, Math.min(1, posY)),
      };
    },
    [resolution.width, resolution.height]
  );

  // Handle pad pointer events
  const handlePadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDraggingPad(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      const rect = padRef.current?.getBoundingClientRect();
      if (!rect) return;

      const posX = (e.clientX - rect.left) / rect.width;
      const posY = (e.clientY - rect.top) / rect.height;
      const { x, y } = padPositionToOffset(posX, posY);

      setDraft((prev) => ({ ...prev, x, y }));
    },
    [padPositionToOffset]
  );

  const handlePadPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingPad) return;

      const rect = padRef.current?.getBoundingClientRect();
      if (!rect) return;

      const posX = (e.clientX - rect.left) / rect.width;
      const posY = (e.clientY - rect.top) / rect.height;
      const { x, y } = padPositionToOffset(
        Math.max(0, Math.min(1, posX)),
        Math.max(0, Math.min(1, posY))
      );

      setDraft((prev) => ({ ...prev, x, y }));
    },
    [isDraggingPad, padPositionToOffset]
  );

  const handlePadPointerUp = useCallback(() => {
    if (isDraggingPad) {
      setIsDraggingPad(false);
      onCommit({ x: draft.x, y: draft.y });
    }
  }, [isDraggingPad, draft.x, draft.y, onCommit]);

  // Reset focus to center
  const handleResetFocus = useCallback(() => {
    setDraft((prev) => ({ ...prev, x: 0, y: 0 }));
    onCommit({ x: 0, y: 0 });
  }, [onCommit]);

  // Current handle position on the pad
  const { posX: handlePosX, posY: handlePosY } = offsetToPadPosition(
    draft.x,
    draft.y
  );

  return (
    <div className="flex w-64 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-violet-600/20">
            <ZoomIn className="size-3.5 text-violet-400" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-foreground/80">
            Zoom Effect
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onClose}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Close inspector</TooltipContent>
        </Tooltip>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-5 p-4">
        {/* Zoom Factor Slider */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Zoom Factor
            </label>
            <span className="font-mono text-xs text-foreground/70">
              {draft.scale.toFixed(2)}x
            </span>
          </div>
          <Slider
            value={[draft.scale]}
            min={1.1}
            max={2.5}
            step={0.05}
            onValueChange={handleScaleChange}
            onValueCommit={handleScaleCommit}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>1.1x</span>
            <span>2.5x</span>
          </div>
        </div>

        {/* Focus Point Pad */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Focus Point
            </label>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleResetFocus}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md transition-colors",
                    draft.x === 0 && draft.y === 0
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  disabled={draft.x === 0 && draft.y === 0}
                >
                  <RotateCcw className="size-3.5" strokeWidth={1.75} />
                </button>
              </TooltipTrigger>
              <TooltipContent>Reset to center</TooltipContent>
            </Tooltip>
          </div>

          {/* Aspect ratio pad */}
          <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/30">
            <AspectRatio ratio={resolution.width / resolution.height}>
              <div
                ref={padRef}
                className={cn(
                  "relative size-full cursor-crosshair select-none",
                  isDraggingPad && "cursor-grabbing"
                )}
                onPointerDown={handlePadPointerDown}
                onPointerMove={handlePadPointerMove}
                onPointerUp={handlePadPointerUp}
                onPointerCancel={handlePadPointerUp}
              >
                {/* Grid lines */}
                <div className="pointer-events-none absolute inset-0">
                  {/* Vertical center line */}
                  <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border/30" />
                  {/* Horizontal center line */}
                  <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border/30" />
                  {/* Thirds grid */}
                  <div className="absolute left-1/3 top-0 h-full w-px bg-border/15" />
                  <div className="absolute left-2/3 top-0 h-full w-px bg-border/15" />
                  <div className="absolute left-0 top-1/3 h-px w-full bg-border/15" />
                  <div className="absolute left-0 top-2/3 h-px w-full bg-border/15" />
                </div>

                {/* Draggable handle */}
                <div
                  className={cn(
                    "absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-violet-400 bg-violet-500 shadow-lg transition-shadow",
                    isDraggingPad
                      ? "ring-4 ring-violet-400/30"
                      : "hover:ring-2 hover:ring-violet-400/20"
                  )}
                  style={{
                    left: `${handlePosX * 100}%`,
                    top: `${handlePosY * 100}%`,
                  }}
                />
              </div>
            </AspectRatio>
          </div>

          {/* Coordinates display */}
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground/50">
            <span>x: {Math.round(draft.x)}px</span>
            <span>y: {Math.round(draft.y)}px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
