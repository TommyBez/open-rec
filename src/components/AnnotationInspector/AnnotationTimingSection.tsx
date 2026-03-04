import type { AnnotationDraft } from "./types";

interface AnnotationTimingSectionProps {
  draft: AnnotationDraft;
  maxDuration: number;
  onDraftChange: (updates: Partial<AnnotationDraft>) => void;
  onCommit: (updates: Partial<AnnotationDraft>) => void;
}

export function AnnotationTimingSection({
  draft,
  maxDuration,
  onDraftChange,
  onCommit,
}: AnnotationTimingSectionProps) {
  return (
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
            onDraftChange({ startTime: nextStart, endTime: clampedEnd });
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
            onDraftChange({ endTime: nextEnd });
            onCommit({ endTime: nextEnd });
          }}
          className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs outline-none"
        />
      </label>
    </div>
  );
}
