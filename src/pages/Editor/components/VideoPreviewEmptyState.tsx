import { Film } from "lucide-react";

interface VideoPreviewEmptyStateProps {
  width: number;
  height: number;
}

export function VideoPreviewEmptyState({ width, height }: VideoPreviewEmptyStateProps) {
  return (
    <div className="studio-panel flex flex-1 items-center justify-center overflow-hidden rounded-xl">
      <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-card/50">
          <Film className="size-7 text-muted-foreground/50" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <span className="text-sm">Video Preview</span>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {width}×{height}
          </p>
        </div>
      </div>
    </div>
  );
}
