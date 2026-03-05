import { cn } from "@/lib/utils";
import { SPEED_PRESETS } from "./speedPresets";

interface SpeedPresetSectionProps {
  speed: number;
  onPresetClick: (value: number) => void;
}

export function SpeedPresetSection({ speed, onPresetClick }: SpeedPresetSectionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Presets
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => onPresetClick(preset.value)}
            className={cn(
              "flex items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-medium transition-all",
              Math.abs(speed - preset.value) < 0.01
                ? "bg-accent text-accent-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
