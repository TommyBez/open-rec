import { useEffect, useState } from "react";
import { X, Square } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import type { Annotation } from "../../types/project";

interface AnnotationInspectorProps {
  annotation: Annotation;
  maxDuration: number;
  onCommit: (updates: Partial<Annotation>) => void;
  onClose: () => void;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function AnnotationInspector({
  annotation,
  maxDuration,
  onCommit,
  onClose,
}: AnnotationInspectorProps) {
  const [draft, setDraft] = useState(annotation);

  useEffect(() => {
    setDraft(annotation);
  }, [annotation]);

  return (
    <div className="flex w-64 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/20">
            <Square className="size-3.5 text-amber-400" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-foreground/80">Annotation</span>
        </div>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-foreground/80">
          <label className="flex flex-col gap-1">
            Start
            <input
              type="number"
              min={0}
              max={Math.max(0, maxDuration)}
              step={0.1}
              value={draft.startTime.toFixed(2)}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const nextStart = Math.max(0, Math.min(maxDuration, raw));
                const nextEnd = Math.max(nextStart + 0.1, draft.endTime);
                const clampedEnd = Math.min(maxDuration, nextEnd);
                setDraft((current) => ({
                  ...current,
                  startTime: nextStart,
                  endTime: clampedEnd,
                }));
                onCommit({ startTime: nextStart, endTime: clampedEnd });
              }}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            End
            <input
              type="number"
              min={0.1}
              max={Math.max(0.1, maxDuration)}
              step={0.1}
              value={draft.endTime.toFixed(2)}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const minEnd = draft.startTime + 0.1;
                const nextEnd = Math.max(minEnd, Math.min(maxDuration, raw));
                setDraft((current) => ({ ...current, endTime: nextEnd }));
                onCommit({ endTime: nextEnd });
              }}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-foreground/80">
          <label className="flex flex-col gap-1">
            X
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={draft.x.toFixed(2)}
              onChange={(event) => {
                const next = clamp01(Number(event.target.value));
                setDraft((current) => ({ ...current, x: next }));
                onCommit({ x: next });
              }}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            Y
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={draft.y.toFixed(2)}
              onChange={(event) => {
                const next = clamp01(Number(event.target.value));
                setDraft((current) => ({ ...current, y: next }));
                onCommit({ y: next });
              }}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-foreground/80">
          <label className="flex flex-col gap-1">
            Width
            <input
              type="number"
              min={0.02}
              max={1}
              step={0.01}
              value={draft.width.toFixed(2)}
              onChange={(event) => {
                const next = Math.max(0.02, clamp01(Number(event.target.value)));
                setDraft((current) => ({ ...current, width: next }));
                onCommit({ width: next });
              }}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            Height
            <input
              type="number"
              min={0.02}
              max={1}
              step={0.01}
              value={draft.height.toFixed(2)}
              onChange={(event) => {
                const next = Math.max(0.02, clamp01(Number(event.target.value)));
                setDraft((current) => ({ ...current, height: next }));
                onCommit({ height: next });
              }}
              className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-foreground/80">
          Color
          <input
            type="color"
            value={draft.color}
            onChange={(event) => {
              const next = event.target.value;
              setDraft((current) => ({ ...current, color: next }));
              onCommit({ color: next });
            }}
            className="h-8 rounded-md border border-border/60 bg-background p-1"
          />
        </label>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-foreground/80">
            <span>Opacity</span>
            <span className="font-mono">{draft.opacity.toFixed(2)}</span>
          </div>
          <Slider
            value={[draft.opacity]}
            min={0.1}
            max={1}
            step={0.05}
            onValueChange={(values) => {
              const next = values[0];
              setDraft((current) => ({ ...current, opacity: next }));
            }}
            onValueCommit={(values) => onCommit({ opacity: values[0] })}
          />
        </div>

        <label className="flex flex-col gap-1 text-xs text-foreground/80">
          Border Thickness
          <input
            type="number"
            min={1}
            max={16}
            step={1}
            value={draft.thickness}
            onChange={(event) => {
              const next = Math.max(1, Math.min(16, Math.round(Number(event.target.value) || 1)));
              setDraft((current) => ({ ...current, thickness: next }));
              onCommit({ thickness: next });
            }}
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
          />
        </label>
      </div>
    </div>
  );
}
