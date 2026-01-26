import { Monitor, AppWindow } from "lucide-react";
import { CaptureSource } from "../../pages/Recorder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

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
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? "Loading..." : "Select source"}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <Spinner className="size-3" />
              Loading...
            </span>
          ) : selectedSource ? (
            <span className="flex items-center gap-2 truncate">
              {selectedSource.type === "display" ? (
                <Monitor className="size-4 shrink-0" />
              ) : (
                <AppWindow className="size-4 shrink-0" />
              )}
              <span className="truncate">{selectedSource.name}</span>
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sources.map((source) => (
          <SelectItem key={source.id} value={source.id}>
            <span className="flex items-center gap-2">
              {source.type === "display" ? (
                <Monitor className="size-4" />
              ) : (
                <AppWindow className="size-4" />
              )}
              <span className="truncate">{source.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
