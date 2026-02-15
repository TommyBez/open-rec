import { Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExportStore } from "../stores";

const MAX_VISIBLE_EXPORT_JOBS = 5;

interface ActiveExportBadgeProps {
  activeExportCount: number;
}

function formatStartedAt(startedAtMs: number): string {
  const date = new Date(startedAtMs);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ActiveExportBadge({ activeExportCount }: ActiveExportBadgeProps) {
  const activeExportJobs = useExportStore((state) => state.activeExportJobs);

  if (activeExportCount <= 0) {
    return null;
  }

  const visibleJobs = activeExportJobs.slice(0, MAX_VISIBLE_EXPORT_JOBS);
  const hiddenJobCount = Math.max(activeExportJobs.length - visibleJobs.length, 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-3 animate-spin" />
          {activeExportCount} exporting
        </div>
      </TooltipTrigger>
      <TooltipContent align="end">
        <div className="space-y-1 text-xs">
          <p className="font-medium text-foreground">Active export queue</p>
          {visibleJobs.length > 0 ? (
            <ul className="space-y-0.5 text-muted-foreground">
              {visibleJobs.map((job) => (
                <li key={job.jobId}>
                  <span className="font-mono">{job.jobId}</span>
                  <span className="ml-1">· started {formatStartedAt(job.startedAtMs)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Syncing active job details…</p>
          )}
          {hiddenJobCount > 0 && (
            <p className="text-muted-foreground">
              +{hiddenJobCount} more running job{hiddenJobCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
