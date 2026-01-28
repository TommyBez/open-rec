import { useState, useEffect, useCallback } from "react";
import { X, RotateCcw, Gauge } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { SpeedEffect } from "../../types/project";

interface SpeedInspectorProps {
  speed: SpeedEffect;
  onCommit: (updates: Partial<SpeedEffect>) => void;
  onClose: () => void;
  /** Called on every draft change for live preview */
  onDraftChange?: (draft: { speed: number }) => void;
}

// Common speed presets
const SPEED_PRESETS = [
  { value: 0.25, label: "0.25x" },
  { value: 0.5, label: "0.5x" },
  { value: 1, label: "1x" },
  { value: 1.5, label: "1.5x" },
  { value: 2, label: "2x" },
  { value: 3, label: "3x" },
  { value: 4, label: "4x" },
];

export function SpeedInspector({
  speed,
  onCommit,
  onClose,
  onDraftChange,
}: SpeedInspectorProps) {
  // Draft state for live preview without spamming undo history
  const [draft, setDraft] = useState({
    speed: speed.speed,
  });

  // Reset draft when speed.id changes (different speed effect selected)
  useEffect(() => {
    setDraft({
      speed: speed.speed,
    });
  }, [speed.id, speed.speed]);

  // Notify parent of draft changes for live preview
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  // Update speed
  const handleSpeedChange = useCallback((values: number[]) => {
    const newSpeed = values[0];
    setDraft({ speed: newSpeed });
  }, []);

  // Commit speed on slider release
  const handleSpeedCommit = useCallback(
    (values: number[]) => {
      const newSpeed = values[0];
      onCommit({ speed: newSpeed });
    },
    [onCommit]
  );

  // Reset speed to 1x (normal speed)
  const handleResetSpeed = useCallback(() => {
    setDraft({ speed: 1 });
    onCommit({ speed: 1 });
  }, [onCommit]);

  // Select a preset speed
  const handlePresetClick = useCallback(
    (presetValue: number) => {
      setDraft({ speed: presetValue });
      onCommit({ speed: presetValue });
    },
    [onCommit]
  );

  // Determine if current speed is slow-motion or fast-forward
  const isSlowMotion = draft.speed < 1;
  const isFastForward = draft.speed > 1;

  return (
    <div className="flex w-64 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-accent/20">
            <Gauge className="size-3.5 text-accent" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-foreground/80">
            Speed Effect
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
        {/* Speed Slider */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Playback Speed
            </label>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-mono text-xs",
                  isSlowMotion && "text-blue-400",
                  isFastForward && "text-orange-400",
                  !isSlowMotion && !isFastForward && "text-foreground/70"
                )}
              >
                {draft.speed.toFixed(2)}x
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleResetSpeed}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-md transition-colors",
                      draft.speed === 1
                        ? "text-muted-foreground/30 cursor-not-allowed"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    disabled={draft.speed === 1}
                  >
                    <RotateCcw className="size-3.5" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Reset to 1x</TooltipContent>
              </Tooltip>
            </div>
          </div>
          <Slider
            value={[draft.speed]}
            min={0.25}
            max={4}
            step={0.05}
            onValueChange={handleSpeedChange}
            onValueCommit={handleSpeedCommit}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>0.25x</span>
            <span>1x</span>
            <span>4x</span>
          </div>
        </div>

        {/* Speed Presets */}
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Presets
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  "flex items-center justify-center rounded-md px-2 py-1.5 text-[11px] font-medium transition-all",
                  Math.abs(draft.speed - preset.value) < 0.01
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Info display */}
        <div className="flex flex-col gap-2 rounded-lg bg-muted/30 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Effect</span>
            <span
              className={cn(
                "font-medium",
                isSlowMotion && "text-blue-400",
                isFastForward && "text-orange-400",
                !isSlowMotion && !isFastForward && "text-muted-foreground"
              )}
            >
              {isSlowMotion
                ? "Slow Motion"
                : isFastForward
                ? "Fast Forward"
                : "Normal"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Duration change</span>
            <span className="font-mono text-foreground/70">
              {draft.speed !== 0
                ? `${(100 / draft.speed).toFixed(0)}%`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
