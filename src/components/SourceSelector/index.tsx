import { Monitor, AppWindow, ChevronDown, Check } from "lucide-react";
import { CaptureSource } from "../../types/project";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SourceSelectorProps {
  sources: CaptureSource[];
  selectedSource: CaptureSource | null;
  onSelect: (source: CaptureSource) => void;
  isLoading?: boolean;
}

export function SourceSelector({
  sources,
  selectedSource,
  onSelect,
  isLoading = false,
}: SourceSelectorProps) {
  const handleValueChange = (value: string) => {
    const source = sources.find((s) => s.id === value);
    if (source) {
      onSelect(source);
    }
  };

  return (
    <Select
      value={selectedSource?.id ?? ""}
      onValueChange={handleValueChange}
      disabled={isLoading}
    >
      <SelectTrigger 
        className={cn(
          "studio-panel h-auto w-full rounded-xl border-0 px-3 py-2.5 transition-all duration-200",
          "hover:bg-card/80",
          "focus:ring-1 focus:ring-primary/30",
          "[&>svg]:hidden"
        )}
      >
        <SelectValue placeholder={isLoading ? "Scanning sources..." : "Select a source"}>
          {isLoading ? (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-muted/50">
                <div className="size-3.5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-muted-foreground">
                  Scanning...
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  Looking for sources
                </span>
              </div>
            </div>
          ) : selectedSource ? (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary/15">
                {selectedSource.type === "display" ? (
                  <Monitor className="size-4 text-primary" strokeWidth={1.75} />
                ) : (
                  <AppWindow className="size-4 text-primary" strokeWidth={1.75} />
                )}
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[13px] font-medium text-foreground">
                  {selectedSource.name}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
                  {selectedSource.type === "display" ? "Full Screen" : "Window"}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-md bg-muted/50">
                <Monitor className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <span className="text-[13px] text-muted-foreground">
                Select a source
              </span>
            </div>
          )}
        </SelectValue>
        <ChevronDown className="size-4 text-muted-foreground/60 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
      </SelectTrigger>
      <SelectContent 
        className="studio-panel overflow-hidden rounded-xl border-0 p-1"
        sideOffset={8}
      >
        {sources.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No sources found
          </div>
        ) : (
          sources.map((source) => (
            <SelectItem 
              key={source.id} 
              value={source.id}
              className="rounded-lg px-3 py-2.5 transition-colors duration-150 focus:bg-card data-[state=checked]:bg-primary/10"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-colors",
                    selectedSource?.id === source.id ? "bg-primary/15" : "bg-muted/50"
                  )}
                >
                  {source.type === "display" ? (
                    <Monitor 
                      className={cn(
                        "size-4 transition-colors",
                        selectedSource?.id === source.id 
                          ? "text-primary" 
                          : "text-muted-foreground"
                      )} 
                      strokeWidth={1.75} 
                    />
                  ) : (
                    <AppWindow 
                      className={cn(
                        "size-4 transition-colors",
                        selectedSource?.id === source.id 
                          ? "text-primary" 
                          : "text-muted-foreground"
                      )} 
                      strokeWidth={1.75} 
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">{source.name}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {source.type === "display" ? "Full Screen" : "Window"}
                  </span>
                </div>
                {selectedSource?.id === source.id && (
                  <Check className="size-4 text-primary" strokeWidth={2} />
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
