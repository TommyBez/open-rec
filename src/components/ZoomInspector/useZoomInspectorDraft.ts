import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ZoomEffect } from "../../types/project";

interface UseZoomInspectorDraftOptions {
  zoom: ZoomEffect;
  resolution: { width: number; height: number };
  onCommit: (updates: Partial<ZoomEffect>) => void;
  onDraftChange?: (draft: { scale: number; x: number; y: number }) => void;
}

function getMaxOffset(dimension: number): number {
  return dimension / 2;
}

function clamp(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

export function useZoomInspectorDraft({
  zoom,
  resolution,
  onCommit,
  onDraftChange,
}: UseZoomInspectorDraftOptions) {
  const [draft, setDraft] = useState({
    scale: zoom.scale,
    x: zoom.x,
    y: zoom.y,
  });
  const padRef = useRef<HTMLDivElement>(null);
  const [isDraggingPad, setIsDraggingPad] = useState(false);

  useEffect(() => {
    setDraft({
      scale: zoom.scale,
      x: zoom.x,
      y: zoom.y,
    });
  }, [zoom.id, zoom.scale, zoom.x, zoom.y]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const maxX = getMaxOffset(resolution.width);
  const maxY = getMaxOffset(resolution.height);

  const handleScaleChange = useCallback((values: number[]) => {
    const newScale = values[0];
    setDraft((prev) => ({ ...prev, scale: newScale }));
  }, []);

  const handleScaleCommit = useCallback(
    (values: number[]) => {
      const newScale = values[0];
      onCommit({ scale: newScale });
    },
    [onCommit]
  );

  const padPositionToOffset = useCallback(
    (posX: number, posY: number) => {
      const rawX = (posX - 0.5) * resolution.width;
      const rawY = (posY - 0.5) * resolution.height;
      return { x: clamp(rawX, maxX), y: clamp(rawY, maxY) };
    },
    [resolution.width, resolution.height, maxX, maxY]
  );

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

  const handlePadPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      event.preventDefault();
      setIsDraggingPad(true);
      (event.target as HTMLElement).setPointerCapture(event.pointerId);

      const rect = padRef.current?.getBoundingClientRect();
      if (!rect) return;

      const posX = (event.clientX - rect.left) / rect.width;
      const posY = (event.clientY - rect.top) / rect.height;
      const { x, y } = padPositionToOffset(posX, posY);
      setDraft((prev) => ({ ...prev, x, y }));
    },
    [padPositionToOffset]
  );

  const handlePadPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      if (!isDraggingPad) return;

      const rect = padRef.current?.getBoundingClientRect();
      if (!rect) return;

      const posX = (event.clientX - rect.left) / rect.width;
      const posY = (event.clientY - rect.top) / rect.height;
      const { x, y } = padPositionToOffset(
        Math.max(0, Math.min(1, posX)),
        Math.max(0, Math.min(1, posY))
      );

      setDraft((prev) => ({ ...prev, x, y }));
    },
    [isDraggingPad, padPositionToOffset]
  );

  const handlePadPointerUp = useCallback(() => {
    if (!isDraggingPad) return;
    setIsDraggingPad(false);
    onCommit({ x: draft.x, y: draft.y });
  }, [isDraggingPad, draft.x, draft.y, onCommit]);

  const handleResetFocus = useCallback(() => {
    setDraft((prev) => ({ ...prev, x: 0, y: 0 }));
    onCommit({ x: 0, y: 0 });
  }, [onCommit]);

  const { posX: handlePosX, posY: handlePosY } = offsetToPadPosition(draft.x, draft.y);

  return {
    draft,
    padRef,
    isDraggingPad,
    handleScaleChange,
    handleScaleCommit,
    handlePadPointerDown,
    handlePadPointerMove,
    handlePadPointerUp,
    handleResetFocus,
    handlePosX,
    handlePosY,
  };
}
