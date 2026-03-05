import { useEffect, useState } from "react";
import { Film } from "lucide-react";

interface ProjectTitleProps {
  projectName: string;
  isDirty: boolean;
  onRename: (name: string) => void;
}

export function ProjectTitle({ projectName, isDirty, onRename }: ProjectTitleProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(projectName);

  useEffect(() => {
    if (!isRenaming) {
      setDraftName(projectName);
    }
  }, [projectName, isRenaming]);

  const commitRename = () => {
    onRename(draftName);
    setIsRenaming(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
        <Film className="size-4 text-primary" strokeWidth={1.75} />
      </div>
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
              setDraftName(projectName);
              setIsRenaming(false);
            }
          }}
          autoFocus
          className="w-56 rounded-md border border-border/60 bg-background px-2 py-1 text-sm font-medium text-foreground/90 outline-none focus:border-primary/50"
        />
      ) : (
        <button
          onClick={() => setIsRenaming(true)}
          className="text-sm font-medium text-foreground/80 hover:text-foreground"
          title="Rename project"
        >
          {projectName}
        </button>
      )}
      {isDirty && <span className="text-xl leading-none text-accent">•</span>}
    </div>
  );
}
