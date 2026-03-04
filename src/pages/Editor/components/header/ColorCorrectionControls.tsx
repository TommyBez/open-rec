import { RotateCcw } from "lucide-react";

interface ColorCorrectionControlsProps {
  brightness: number;
  contrast: number;
  saturation: number;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onReset: () => void;
}

export function ColorCorrectionControls({
  brightness,
  contrast,
  saturation,
  onBrightnessChange,
  onContrastChange,
  onSaturationChange,
  onReset,
}: ColorCorrectionControlsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Br
        <input
          type="number"
          min={-1}
          max={1}
          step={0.05}
          value={brightness.toFixed(2)}
          onChange={(event) => onBrightnessChange(Number(event.target.value) || 0)}
          className="w-10 bg-transparent text-right text-xs outline-none"
          title="Brightness"
        />
      </label>
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Ct
        <input
          type="number"
          min={0.5}
          max={2}
          step={0.05}
          value={contrast.toFixed(2)}
          onChange={(event) => onContrastChange(Number(event.target.value) || contrast)}
          className="w-10 bg-transparent text-right text-xs outline-none"
          title="Contrast"
        />
      </label>
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Sat
        <input
          type="number"
          min={0}
          max={2}
          step={0.05}
          value={saturation.toFixed(2)}
          onChange={(event) => onSaturationChange(Number(event.target.value) || saturation)}
          className="w-10 bg-transparent text-right text-xs outline-none"
          title="Saturation"
        />
      </label>
      <button
        onClick={onReset}
        className="flex size-7 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Reset color correction"
      >
        <RotateCcw className="size-3.5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
