import { Calendar, Pencil, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { formatProjectDate } from "../projectCardUtils";

interface ProjectCardDetailsProps {
  projectId: string;
  projectName: string;
  createdAt: string;
  resolution: { width: number; height: number };
  selectionMode: boolean;
  isRenaming: boolean;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onOpenInNewWindow?: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

export function ProjectCardDetails({
  projectId,
  projectName,
  createdAt,
  resolution,
  selectionMode,
  isRenaming,
  draftName,
  onDraftNameChange,
  onCommitRename,
  onCancelRename,
  onStartRename,
  onOpenInNewWindow,
  onDelete,
}: ProjectCardDetailsProps) {
  return (
    <div className="flex flex-col gap-1 p-3">
      <div className="flex items-center gap-2">
        {isRenaming ? (
          <input
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            onBlur={onCommitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onCommitRename();
              }
              if (event.key === "Escape") {
                onCancelRename();
              }
            }}
            autoFocus
            onClick={(event) => event.stopPropagation()}
            className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm font-medium text-foreground outline-none focus:border-primary/50"
          />
        ) : (
          <>
            <h3 className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
              {projectName}
            </h3>
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (selectionMode) return;
                onStartRename();
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Rename project"
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (selectionMode) return;
                onOpenInNewWindow?.(projectId);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Open in new window"
            >
              <SquareArrowOutUpRight className="size-3.5" strokeWidth={1.75} />
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                if (selectionMode) return;
                onDelete(projectId);
              }}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title="Delete project"
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Calendar className="size-3" strokeWidth={2} />
        {formatProjectDate(createdAt)}
      </div>
      <div className="text-xs text-muted-foreground/60">
        {resolution.width} × {resolution.height}
      </div>
    </div>
  );
}
