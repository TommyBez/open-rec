import { Loader2, Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface WidgetPanelProps {
  elapsedTime: number;
  isRecording: boolean;
  isStopping: boolean;
  statusLabel: string;
  permissionError: string | null;
  onTogglePause: () => void;
  onStopRecording: () => void;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function WidgetPanel({
  elapsedTime,
  isRecording,
  isStopping,
  statusLabel,
  permissionError,
  onTogglePause,
  onStopRecording,
}: WidgetPanelProps) {
  return (
    <div
      className="studio-grain relative flex h-full cursor-move select-none items-center justify-center overflow-hidden rounded-xl bg-background"
      data-tauri-drag-region
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-all duration-500",
          isRecording
            ? "bg-[radial-gradient(ellipse_at_center,oklch(0.25_0.12_25)_0%,transparent_70%)] opacity-60"
            : "bg-[radial-gradient(ellipse_at_center,oklch(0.25_0.10_75)_0%,transparent_70%)] opacity-40"
        )}
      />
      <div className="studio-panel relative z-10 flex items-center gap-3 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="relative flex size-3 items-center justify-center">
            <div
              className={cn(
                "size-2.5 rounded-full transition-all duration-300",
                isRecording
                  ? "animate-pulse bg-primary shadow-[0_0_8px_oklch(0.62_0.24_25/0.8)]"
                  : "bg-accent"
              )}
            />
            {isRecording && <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />}
          </div>
        </div>
        <div className="flex min-w-[65px] flex-col items-start">
          <span
            className={cn(
              "font-mono text-base font-semibold tabular-nums tracking-wide transition-colors duration-300",
              isRecording ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {formatTime(elapsedTime)}
          </span>
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-widest transition-colors duration-300",
              isRecording ? "text-primary" : "text-accent"
            )}
          >
            {statusLabel}
          </span>
        </div>
        <div className="h-6 w-px bg-border/50" />
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onTogglePause}
                disabled={isStopping}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-all duration-200",
                  isRecording
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "bg-accent/20 text-accent hover:bg-accent/30",
                  isStopping && "cursor-not-allowed opacity-40"
                )}
              >
                {isRecording ? (
                  <Pause className="size-4" strokeWidth={2} />
                ) : (
                  <Play className="size-4" strokeWidth={2} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isRecording ? "Pause (⌘⇧P)" : "Resume (⌘⇧P)"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onStopRecording}
                disabled={isStopping}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_12px_oklch(0.62_0.24_25/0.4)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_0_16px_oklch(0.62_0.24_25/0.6)] active:scale-95",
                  isStopping && "cursor-not-allowed opacity-70"
                )}
              >
                {isStopping ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                ) : (
                  <Square className="size-3.5" strokeWidth={2.5} fill="currentColor" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Stop Recording (⌘⇧2)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {permissionError && (
        <div className="absolute -bottom-11 left-0 right-0 rounded-md border border-destructive/40 bg-background/95 px-2 py-1 text-[10px] text-destructive shadow-lg">
          {permissionError}
        </div>
      )}
    </div>
  );
}
