import { ExportModal } from "../../../components/ExportModal";
import { EditorLayoutContent } from "./EditorLayoutContent";
import { EditorLayoutHeader } from "./EditorLayoutHeader";
import type { EditorPageLayoutProps } from "./EditorPageLayout.types";

const atmosphericGradient = (
  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
);

export function EditorPageLayout({
  project,
  editedDuration,
  showExportModal,
  onSetShowExportModal,
  onSaveProject,
  ...layoutProps
}: EditorPageLayoutProps) {
  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background text-foreground">
      {atmosphericGradient}
      <EditorLayoutHeader project={project} {...layoutProps} />
      <EditorLayoutContent project={project} editedDuration={editedDuration} {...layoutProps} />
      <ExportModal
        project={project}
        editedDuration={editedDuration}
        open={showExportModal}
        onOpenChange={onSetShowExportModal}
        onSaveProject={onSaveProject}
      />
    </div>
  );
}
