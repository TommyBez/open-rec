interface CameraOverlayControlsProps {
  hasCameraTrack: boolean;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
  onCameraOverlayPositionChange: (
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom"
  ) => void;
  onCameraOverlayScaleChange: (scale: number) => void;
  onCameraOverlayMarginChange: (margin: number) => void;
}

export function CameraOverlayControls({
  hasCameraTrack,
  cameraOverlayPosition,
  cameraOverlayScale,
  cameraOverlayMargin,
  onCameraOverlayPositionChange,
  onCameraOverlayScaleChange,
  onCameraOverlayMarginChange,
}: CameraOverlayControlsProps) {
  if (!hasCameraTrack) return null;

  const marginDisabled = cameraOverlayPosition === "custom";

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={cameraOverlayPosition}
        onChange={(event) =>
          onCameraOverlayPositionChange(
            event.target.value as
              | "top-left"
              | "top-right"
              | "bottom-left"
              | "bottom-right"
              | "custom"
          )
        }
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80 outline-none focus:border-primary/50"
        title="Camera overlay position"
      >
        <option value="top-left">Cam TL</option>
        <option value="top-right">Cam TR</option>
        <option value="bottom-left">Cam BL</option>
        <option value="bottom-right">Cam BR</option>
        <option value="custom">Cam Drag</option>
      </select>
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Scale
        <input
          type="number"
          min={0.1}
          max={0.6}
          step={0.05}
          value={cameraOverlayScale.toFixed(2)}
          onChange={(event) =>
            onCameraOverlayScaleChange(Number(event.target.value) || cameraOverlayScale)
          }
          className="w-11 bg-transparent text-right text-xs outline-none"
        />
      </label>
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Margin
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={cameraOverlayMargin}
          disabled={marginDisabled}
          onChange={(event) =>
            onCameraOverlayMarginChange(Number(event.target.value) || cameraOverlayMargin)
          }
          className="w-10 bg-transparent text-right text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>
    </div>
  );
}
