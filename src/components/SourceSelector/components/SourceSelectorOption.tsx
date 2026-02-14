import { AppWindow, Check, Monitor } from "lucide-react";
import { SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CaptureSource } from "../../../types/project";

interface SourceSelectorOptionProps {
  source: CaptureSource;
  selectedSource: CaptureSource | null;
}

export function SourceSelectorOption({ source, selectedSource }: SourceSelectorOptionProps) {
  const isSelected = selectedSource?.id === source.id;

  return (
    <SelectItem
      value={source.id}
      className="rounded-lg px-3 py-2.5 transition-colors duration-150 focus:bg-card data-[state=checked]:bg-primary/10"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-lg transition-colors",
            isSelected ? "bg-primary/15" : "bg-muted/50"
          )}
        >
          {source.type === "display" ? (
            <Monitor
              className={cn("size-4 transition-colors", isSelected ? "text-primary" : "text-muted-foreground")}
              strokeWidth={1.75}
            />
          ) : (
            <AppWindow
              className={cn("size-4 transition-colors", isSelected ? "text-primary" : "text-muted-foreground")}
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
        {isSelected && <Check className="size-4 text-primary" strokeWidth={2} />}
      </div>
    </SelectItem>
  );
}
