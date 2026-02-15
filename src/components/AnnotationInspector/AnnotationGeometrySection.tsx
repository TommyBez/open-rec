import type { AnnotationDraft } from "./types";
import { clamp01 } from "./types";

interface AnnotationGeometrySectionProps {
  draft: AnnotationDraft;
  onDraftChange: (updates: Partial<AnnotationDraft>) => void;
  onCommit: (updates: Partial<AnnotationDraft>) => void;
}

export function AnnotationGeometrySection({
  draft,
  onDraftChange,
  onCommit,
}: AnnotationGeometrySectionProps) {
  return (
    <>
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
              onDraftChange({ x: next });
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
              onDraftChange({ y: next });
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
              onDraftChange({ width: next });
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
              onDraftChange({ height: next });
              onCommit({ height: next });
            }}
            className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
          />
        </label>
      </div>
    </>
  );
}
