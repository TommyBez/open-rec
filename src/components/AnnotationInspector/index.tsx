import { useEffect, useState } from "react";
import type { Annotation } from "../../types/project";
import { AnnotationInspectorHeader } from "./AnnotationInspectorHeader";
import { AnnotationTimingSection } from "./AnnotationTimingSection";
import { AnnotationGeometrySection } from "./AnnotationGeometrySection";
import { AnnotationStyleSection } from "./AnnotationStyleSection";

interface AnnotationInspectorProps {
  annotation: Annotation;
  maxDuration: number;
  onCommit: (updates: Partial<Annotation>) => void;
  onDuplicate: () => void;
  onClose: () => void;
}

export function AnnotationInspector({
  annotation,
  maxDuration,
  onCommit,
  onDuplicate,
  onClose,
}: AnnotationInspectorProps) {
  const [draft, setDraft] = useState(annotation);
  const updateDraft = (updates: Partial<Annotation>) =>
    setDraft((current) => ({ ...current, ...updates }));

  useEffect(() => {
    setDraft(annotation);
  }, [annotation]);

  return (
    <div className="flex w-64 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm">
      <AnnotationInspectorHeader onDuplicate={onDuplicate} onClose={onClose} />

      <div className="flex flex-col gap-4 p-4">
        <AnnotationTimingSection
          draft={draft}
          maxDuration={maxDuration}
          onDraftChange={updateDraft}
          onCommit={onCommit}
        />
        <AnnotationGeometrySection
          draft={draft}
          onDraftChange={updateDraft}
          onCommit={onCommit}
        />
        <AnnotationStyleSection
          draft={draft}
          onDraftChange={updateDraft}
          onCommit={onCommit}
        />
      </div>
    </div>
  );
}
