import { PointerEvent as ReactPointerEvent, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface UseCameraOverlayDragOptions {
  enabled: boolean;
  customX: number;
  customY: number;
  containerRef: RefObject<HTMLElement | null>;
  overlayRef: RefObject<HTMLElement | null>;
  onCommit: (x: number, y: number) => void;
}

interface OverlayMetrics {
  containerWidth: number;
  containerHeight: number;
  overlayWidth: number;
  overlayHeight: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function useCameraOverlayDrag({
  enabled,
  customX,
  customY,
  containerRef,
  overlayRef,
  onCommit,
}: UseCameraOverlayDragOptions) {
  const [metrics, setMetrics] = useState<OverlayMetrics>({
    containerWidth: 0,
    containerHeight: 0,
    overlayWidth: 0,
    overlayHeight: 0,
  });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const measure = useCallback(() => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const overlayRect = overlayRef.current?.getBoundingClientRect();
    if (!containerRect || !overlayRect) return;
    setMetrics({
      containerWidth: containerRect.width,
      containerHeight: containerRect.height,
      overlayWidth: overlayRect.width,
      overlayHeight: overlayRect.height,
    });
  }, [containerRef, overlayRef]);

  useEffect(() => {
    if (!enabled) return;
    measure();

    const container = containerRef.current;
    const overlay = overlayRef.current;
    if (!container || !overlay || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    observer.observe(overlay);

    return () => observer.disconnect();
  }, [enabled, measure, containerRef, overlayRef]);

  const normalizedPosition = useMemo(() => {
    const source = dragPosition ?? { x: customX, y: customY };
    return {
      x: clamp01(source.x),
      y: clamp01(source.y),
    };
  }, [dragPosition, customX, customY]);

  const computePositionFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return null;

      const maxLeft = Math.max(metrics.containerWidth - metrics.overlayWidth, 0);
      const maxTop = Math.max(metrics.containerHeight - metrics.overlayHeight, 0);

      const rawLeft = clientX - containerRect.left - dragOffsetRef.current.x;
      const rawTop = clientY - containerRect.top - dragOffsetRef.current.y;

      const clampedLeft = Math.min(Math.max(rawLeft, 0), maxLeft);
      const clampedTop = Math.min(Math.max(rawTop, 0), maxTop);

      return {
        x: maxLeft > 0 ? clampedLeft / maxLeft : 0,
        y: maxTop > 0 ? clampedTop / maxTop : 0,
      };
    },
    [containerRef, metrics.containerWidth, metrics.containerHeight, metrics.overlayWidth, metrics.overlayHeight]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled) return;
      measure();

      const overlayRect = overlayRef.current?.getBoundingClientRect();
      if (!overlayRect) return;

      dragOffsetRef.current = {
        x: event.clientX - overlayRect.left,
        y: event.clientY - overlayRect.top,
      };

      const nextPosition = computePositionFromPointer(event.clientX, event.clientY);
      if (nextPosition) {
        setDragPosition({
          x: clamp01(nextPosition.x),
          y: clamp01(nextPosition.y),
        });
      }
      event.preventDefault();
    },
    [enabled, measure, overlayRef, computePositionFromPointer]
  );

  useEffect(() => {
    if (!dragPosition) return;

    const handlePointerMove = (event: PointerEvent) => {
      const nextPosition = computePositionFromPointer(event.clientX, event.clientY);
      if (!nextPosition) return;
      setDragPosition({
        x: clamp01(nextPosition.x),
        y: clamp01(nextPosition.y),
      });
    };

    const handlePointerUp = () => {
      const positionToCommit = dragPosition;
      setDragPosition(null);
      const nextX = clamp01(positionToCommit.x);
      const nextY = clamp01(positionToCommit.y);
      if (Math.abs(nextX - customX) > 0.001 || Math.abs(nextY - customY) > 0.001) {
        onCommit(nextX, nextY);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragPosition, computePositionFromPointer, customX, customY, onCommit]);

  const customOverlayStyle = useMemo(() => {
    const maxLeft = Math.max(metrics.containerWidth - metrics.overlayWidth, 0);
    const maxTop = Math.max(metrics.containerHeight - metrics.overlayHeight, 0);
    return {
      left: `${normalizedPosition.x * maxLeft}px`,
      top: `${normalizedPosition.y * maxTop}px`,
      right: "auto",
      bottom: "auto",
    };
  }, [metrics.containerWidth, metrics.containerHeight, metrics.overlayWidth, metrics.overlayHeight, normalizedPosition.x, normalizedPosition.y]);

  return {
    customOverlayStyle,
    isDragging: dragPosition !== null,
    handlePointerDown,
  };
}
