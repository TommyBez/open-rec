import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { Project } from "../../types/project";
import { ProjectCardThumbnail } from "./components/ProjectCardThumbnail";
import { ProjectCardDetails } from "./components/ProjectCardDetails";

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onRename: (projectId: string, name: string) => void;
  onDelete: (projectId: string) => void;
  onOpenInNewWindow?: (projectId: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (projectId: string) => void;
  index: number;
}

export function ProjectCard({
  project,
  onSelect,
  onRename,
  onDelete,
  onOpenInNewWindow,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  index,
}: ProjectCardProps) {
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
      onClick={() => {
        if (selectionMode && onToggleSelect) {
          onToggleSelect(project.id);
          return;
        }
        onSelect(project);
      }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm",
        "transition-all duration-200 hover:border-primary/30 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        "animate-fade-up",
        selectionMode && selected && "border-primary/60 ring-1 ring-primary/40"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <ProjectCardThumbnail
        thumbnailSrc={thumbnailSrc}
        thumbnailError={thumbnailError}
        onThumbnailError={() => setThumbnailError(true)}
        duration={project.duration}
        selectionMode={selectionMode}
        selected={selected}
      />
      <ProjectCardDetails
        projectId={project.id}
        projectName={project.name}
        createdAt={project.createdAt}
        resolution={project.resolution}
        selectionMode={selectionMode}
        isRenaming={isRenaming}
        draftName={draftName}
        onDraftNameChange={setDraftName}
        onCommitRename={commitRename}
        onCancelRename={() => {
          setDraftName(project.name);
          setIsRenaming(false);
        }}
        onStartRename={() => setIsRenaming(true)}
        onOpenInNewWindow={onOpenInNewWindow}
        onDelete={onDelete}
      />
    </button>
  );
}
