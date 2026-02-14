import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Film, Clock, Calendar, Video, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project } from "../../types/project";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onRename: (projectId: string, name: string) => void;
  index: number;
}

export function ProjectCard({ project, onSelect, onRename, index }: ProjectCardProps) {
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(project.name);
  const thumbnailSrc = project.screenVideoPath
    ? convertFileSrc(project.screenVideoPath)
    : "";

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(project.name);
    }
  }, [project.name, isRenaming]);

  const commitRename = () => {
    onRename(project.id, draftName);
    setIsRenaming(false);
  };

  return (
    <button
      onClick={() => onSelect(project)}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm",
        "transition-all duration-200 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "animate-fade-up"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
        {thumbnailSrc && !thumbnailError ? (
          <video
            src={thumbnailSrc}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setThumbnailError(true)}
            preload="metadata"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Video className="size-10 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
        )}
        
        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/80 px-2 py-1 text-xs font-medium backdrop-blur-sm">
          <Clock className="size-3" strokeWidth={2} />
          {formatDuration(project.duration)}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition-all duration-200 group-hover:bg-primary/10 group-hover:opacity-100">
          <div className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg">
            <Film className="size-4" strokeWidth={2} />
            Open
          </div>
        </div>
      </div>

      {/* Info area */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-center gap-2">
          {isRenaming ? (
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitRename}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitRename();
                }
                if (event.key === "Escape") {
                  setDraftName(project.name);
                  setIsRenaming(false);
                }
              }}
              autoFocus
              onClick={(event) => event.stopPropagation()}
              className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-primary/50"
            />
          ) : (
            <>
              <h3 className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                {project.name}
              </h3>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  setIsRenaming(true);
                }}
                className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Rename project"
              >
                <Pencil className="size-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3" strokeWidth={2} />
          {formatDate(project.createdAt)}
        </div>
        <div className="text-xs text-muted-foreground/60">
          {project.resolution.width} × {project.resolution.height}
        </div>
      </div>
    </button>
  );
}
