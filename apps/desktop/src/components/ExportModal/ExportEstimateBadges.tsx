import { Clapperboard, Monitor, Package, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ExportEstimateBadgesProps {
  durationLabel: string;
  resolutionLabel: string;
  estimatedSize: string;
  estimatedTime: string;
}

export function ExportEstimateBadges({
  durationLabel,
  resolutionLabel,
  estimatedSize,
  estimatedTime,
}: ExportEstimateBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="secondary" className="gap-1.5">
        <Clapperboard className="size-3" />
        {durationLabel}
      </Badge>
      <Badge variant="secondary" className="gap-1.5">
        <Monitor className="size-3" />
        {resolutionLabel}
      </Badge>
      <Badge variant="secondary" className="gap-1.5">
        <Package className="size-3" />
        {estimatedSize}
      </Badge>
      <Badge variant="secondary" className="gap-1.5">
        <Timer className="size-3" />~{estimatedTime}
      </Badge>
    </div>
  );
}
