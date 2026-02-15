import type { CSSProperties } from "react";

interface BuildCameraOverlayStyleOptions {
  cameraOverlayMargin: number;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  cameraOverlayWidthPercent: number;
  isCustomCameraOverlay: boolean;
  customOverlayStyle: CSSProperties;
  isDragging: boolean;
}

export function buildCameraOverlayStyle({
  cameraOverlayMargin,
  cameraOverlayPosition,
  cameraOverlayWidthPercent,
  isCustomCameraOverlay,
  customOverlayStyle,
  isDragging,
}: BuildCameraOverlayStyleOptions): CSSProperties {
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
}
