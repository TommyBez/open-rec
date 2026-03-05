import type { CSSProperties, PointerEvent as ReactPointerEvent, RefObject } from "react";

interface CameraOverlayVideoProps {
  cameraVideoRef: RefObject<HTMLVideoElement | null>;
  cameraSrc: string;
  isCustomCameraOverlay: boolean;
  cameraOverlayStyle: CSSProperties;
  onPointerDown?: (event: ReactPointerEvent<HTMLVideoElement>) => void;
}

export function CameraOverlayVideo({
  cameraVideoRef,
  cameraSrc,
  isCustomCameraOverlay,
  cameraOverlayStyle,
  onPointerDown,
}: CameraOverlayVideoProps) {
  return (
    <video
      ref={cameraVideoRef}
      src={cameraSrc}
      muted
      playsInline
      className={isCustomCameraOverlay ? "pointer-events-auto select-none" : "pointer-events-none"}
      style={cameraOverlayStyle}
      onPointerDown={isCustomCameraOverlay ? onPointerDown : undefined}
    />
  );
}
