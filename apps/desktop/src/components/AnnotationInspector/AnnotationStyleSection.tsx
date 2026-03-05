import { Slider } from "@/components/ui/slider";
import type { AnnotationDraft } from "./types";

interface AnnotationStyleSectionProps {
  draft: AnnotationDraft;
  onDraftChange: (updates: Partial<AnnotationDraft>) => void;
  onCommit: (updates: Partial<AnnotationDraft>) => void;
}

export function AnnotationStyleSection({
  draft,
  onDraftChange,
  onCommit,
}: AnnotationStyleSectionProps) {
  return (
    <>
      <label className="flex flex-col gap-1 text-xs text-foreground/80">
        Color
        <input
          type="color"
          value={draft.color}
          onChange={(event) => {
            const next = event.target.value;
            onDraftChange({ color: next });
            onCommit({ color: next });
          }}
          className="h-8 rounded-md border border-border/60 bg-background p-1"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-foreground/80">
        Mode
        <select
          value={draft.mode ?? "outline"}
          onChange={(event) => {
            const next = event.target.value as "outline" | "blur" | "text" | "arrow";
            onDraftChange({ mode: next });
            onCommit({ mode: next });
          }}
          className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
        >
          <option value="outline">Outline</option>
          <option value="blur">Blur</option>
          <option value="text">Text only</option>
          <option value="arrow">Arrow</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-foreground/80">
        Text (optional)
        <input
          type="text"
          value={draft.text ?? ""}
          onChange={(event) => {
            const next = event.target.value;
            onDraftChange({ text: next });
            onCommit({ text: next });
          }}
          className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
          placeholder="Callout text"
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
            onDraftChange({ opacity: next });
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
            onDraftChange({ thickness: next });
            onCommit({ thickness: next });
          }}
          className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
        />
      </label>
    </>
  );
}
