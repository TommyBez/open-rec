import { Clock, Film, Video } from "lucide-react";
import { formatProjectDuration } from "../projectCardUtils";

interface ProjectCardThumbnailProps {
  thumbnailSrc: string;
  thumbnailError: boolean;
  onThumbnailError: () => void;
  duration: number;
  selectionMode: boolean;
  selected: boolean;
}

export function ProjectCardThumbnail({
  thumbnailSrc,
  thumbnailError,
  onThumbnailError,
  duration,
  selectionMode,
  selected,
}: ProjectCardThumbnailProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
      {thumbnailSrc && !thumbnailError ? (
        <video
          src={thumbnailSrc}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={onThumbnailError}
          preload="metadata"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Video className="size-10 text-muted-foreground/30" strokeWidth={1.5} />
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
        <Clock className="size-3" strokeWidth={2} />
        {formatProjectDuration(duration)}
      </div>

      {selectionMode && (
        <div className="absolute left-2 top-2 rounded-md bg-background/85 px-2 py-1 text-[11px] font-medium text-foreground">
          {selected ? "Selected" : "Select"}
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition-all duration-200 group-hover:bg-primary/10 group-hover:opacity-100">
        <div className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
          <Film className="size-4" strokeWidth={2} />
          {selectionMode ? (selected ? "Deselect" : "Select") : "Open"}
        </div>
      </div>
    </div>
  );
}
