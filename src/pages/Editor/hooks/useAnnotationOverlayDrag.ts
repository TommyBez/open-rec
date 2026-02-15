import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Annotation } from "../../../types/project";

interface DragState {
  annotationId: string;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface DragPosition {
  annotationId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseAnnotationOverlayDragOptions {
  selectedAnnotationId?: string | null;
  onAnnotationPositionChange?: (annotationId: string, x: number, y: number) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function useAnnotationOverlayDrag({
  selectedAnnotationId,
  onAnnotationPositionChange,
  containerRef,
}: UseAnnotationOverlayDragOptions) {
  const dragStateRef = useRef<DragState | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);

  useEffect(() => {
    if (!dragStateRef.current) return;

    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      if (!dragState) return;

      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const maxLeft = Math.max(containerRect.width - dragState.width, 0);
      const maxTop = Math.max(containerRect.height - dragState.height, 0);
      const rawLeft = event.clientX - containerRect.left - dragState.offsetX;
      const rawTop = event.clientY - containerRect.top - dragState.offsetY;
      const clampedLeft = Math.min(Math.max(rawLeft, 0), maxLeft);
      const clampedTop = Math.min(Math.max(rawTop, 0), maxTop);

      setDragPosition({
        annotationId: dragState.annotationId,
        x: containerRect.width > 0 ? clampedLeft / containerRect.width : 0,
        y: containerRect.height > 0 ? clampedTop / containerRect.height : 0,
        width: containerRect.width > 0 ? dragState.width / containerRect.width : 0.02,
        height: containerRect.height > 0 ? dragState.height / containerRect.height : 0.02,
      });
    }

    function handlePointerUp() {
      const pending = dragPosition;
      dragStateRef.current = null;
      setDragPosition(null);

      if (
        pending &&
        typeof onAnnotationPositionChange === "function" &&
        Number.isFinite(pending.x) &&
        Number.isFinite(pending.y)
      ) {
        onAnnotationPositionChange(
          pending.annotationId,
          Math.min(Math.max(0, 1 - pending.width), Math.max(0, pending.x)),
          Math.min(Math.max(0, 1 - pending.height), Math.max(0, pending.y))
        );
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [containerRef, dragPosition, onAnnotationPositionChange]);

  const isDraggingAnnotationId = dragPosition?.annotationId;

  const getAnnotationRenderPosition = useMemo(
    () =>
      (annotation: Annotation) => {
        const widthNormalized = Math.max(0.02, Math.min(1, annotation.width));
        const heightNormalized = Math.max(0.02, Math.min(1, annotation.height));
        const isDragging = isDraggingAnnotationId === annotation.id;
        const rawX = isDragging ? (dragPosition?.x ?? annotation.x) : annotation.x;
        const rawY = isDragging ? (dragPosition?.y ?? annotation.y) : annotation.y;
        const x = Math.max(0, Math.min(1 - widthNormalized, rawX));
        const y = Math.max(0, Math.min(1 - heightNormalized, rawY));
        return { isDragging, x, y, widthNormalized, heightNormalized };
      },
    [dragPosition, isDraggingAnnotationId]
  );

  function handleAnnotationPointerDown(event: ReactPointerEvent<HTMLDivElement>, annotation: Annotation) {
    if (selectedAnnotationId !== annotation.id) return;

    const annotationRect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      annotationId: annotation.id,
      offsetX: event.clientX - annotationRect.left,
      offsetY: event.clientY - annotationRect.top,
      width: annotationRect.width,
      height: annotationRect.height,
    };

    const widthNormalized = Math.max(0.02, Math.min(1, annotation.width));
    const heightNormalized = Math.max(0.02, Math.min(1, annotation.height));
    const x = Math.max(0, Math.min(1 - widthNormalized, annotation.x));
    const y = Math.max(0, Math.min(1 - heightNormalized, annotation.y));

    setDragPosition({
      annotationId: annotation.id,
      x,
      y,
      width: widthNormalized,
      height: heightNormalized,
    });
    event.preventDefault();
  }

  return {
    getAnnotationRenderPosition,
    handleAnnotationPointerDown,
    isDraggingAnnotationId,
  };
}
