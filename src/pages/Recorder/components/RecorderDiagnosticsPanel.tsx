import { AlertCircle, Info, TriangleAlert } from "lucide-react";
import { useRuntimeDiagnosticsStore } from "../../../stores";

const MAX_VISIBLE_ENTRIES = 4;

function formatTimestamp(createdAtMs: number): string {
  return new Date(createdAtMs).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function LevelIcon({ level }: { level: "info" | "warning" | "error" }) {
  if (level === "error") {
    return <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />;
  }
  if (level === "warning") {
    return <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />;
  }
  return <Info className="mt-0.5 size-3.5 shrink-0 text-sky-500" />;
}

export function RecorderDiagnosticsPanel() {
  const entries = useRuntimeDiagnosticsStore((state) => state.entries);
  const clearEntries = useRuntimeDiagnosticsStore((state) => state.clearEntries);

  if (entries.length === 0) {
    return null;
  }

  const visibleEntries = entries.slice(0, MAX_VISIBLE_ENTRIES);
  const hiddenCount = Math.max(entries.length - visibleEntries.length, 0);

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-medium text-foreground/80">Recovery diagnostics</p>
        <button
          type="button"
          onClick={clearEntries}
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Clear
        </button>
      </div>
      <div className="space-y-1.5 text-muted-foreground">
        {visibleEntries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2">
            <LevelIcon level={entry.level} />
            <div className="min-w-0 flex-1">
              <p className="break-words">{entry.message}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                {entry.source} · {formatTimestamp(entry.createdAtMs)}
              </p>
            </div>
          </div>
        ))}
        {hiddenCount > 0 && (
          <p className="pt-0.5 text-[11px] text-muted-foreground/80">
            +{hiddenCount} older diagnostic{hiddenCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </section>
  );
}
