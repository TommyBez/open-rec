import { Slider } from "@/components/ui/slider";

interface ZoomFactorControlProps {
  scale: number;
  onChange: (values: number[]) => void;
  onCommit: (values: number[]) => void;
}

export function ZoomFactorControl({ scale, onChange, onCommit }: ZoomFactorControlProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Zoom Factor
        </label>
        <span className="font-mono text-xs text-foreground/70">{scale.toFixed(2)}x</span>
      </div>
      <Slider
        value={[scale]}
        min={1.1}
        max={2.5}
        step={0.05}
        onValueChange={onChange}
        onValueCommit={onCommit}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground/50">
        <span>1.1x</span>
        <span>2.5x</span>
      </div>
    </div>
  );
}
