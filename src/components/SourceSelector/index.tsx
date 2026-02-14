import { ChevronDown } from "lucide-react";
import { CaptureSource } from "../../types/project";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SourceSelectorValueContent } from "./components/SourceSelectorValueContent";
import { SourceSelectorOption } from "./components/SourceSelectorOption";

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
          <SourceSelectorValueContent isLoading={isLoading} selectedSource={selectedSource} />
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
            <SourceSelectorOption key={source.id} source={source} selectedSource={selectedSource} />
          ))
        )}
      </SelectContent>
    </Select>
  );
}
