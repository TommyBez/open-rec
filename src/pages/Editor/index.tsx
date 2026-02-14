import { useParams, useNavigate } from "react-router-dom";
import { EditorPageLayout } from "./components/EditorPageLayout";
import { useEditorPageController } from "./hooks/useEditorPageController";

const loadingSpinner = (
  <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background">
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40" />
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-3">
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
      <p className="text-sm text-muted-foreground">Loading project...</p>
    </div>
  </div>
);

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { isLoading, layoutProps } = useEditorPageController({ projectId, navigate });

  if (isLoading || !layoutProps) return loadingSpinner;

  return <EditorPageLayout {...layoutProps} />;
}
