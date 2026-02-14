import { AppWindow, Monitor } from "lucide-react";
import { CaptureSource } from "../../../types/project";

interface SourceSelectorValueContentProps {
  isLoading: boolean;
  selectedSource: CaptureSource | null;
}

export function SourceSelectorValueContent({
  isLoading,
  selectedSource,
}: SourceSelectorValueContentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-muted/50">
          <div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
        </div>
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-muted-foreground">Scanning...</span>
          <span className="text-[10px] text-muted-foreground/60">Looking for sources</span>
        </div>
      </div>
    );
  }

  if (selectedSource) {
    return (
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/15">
          {selectedSource.type === "display" ? (
            <Monitor className="size-4 text-primary" strokeWidth={1.75} />
          ) : (
            <AppWindow className="size-4 text-primary" strokeWidth={1.75} />
          )}
        </div>
        <div className="flex flex-col items-start">
          <span className="text-[13px] font-medium text-foreground">{selectedSource.name}</span>
          <span className="text-[10px] text-muted-foreground/60">
            {selectedSource.type === "display" ? "Full Screen" : "Window"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-7 items-center justify-center rounded-md bg-muted/50">
        <Monitor className="size-4 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <span className="text-[13px] text-muted-foreground">Select a source</span>
    </div>
  );
}
