import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import type { Annotation, SpeedEffect, ZoomEffect } from "../../../types/project";
import { AnnotationInspector } from "../../../components/AnnotationInspector";
import { SpeedInspector } from "../../../components/SpeedInspector";
import { ZoomInspector } from "../../../components/ZoomInspector";

interface EditorInspectorsProps {
  selectedZoom: ZoomEffect | null;
  selectedSpeed: SpeedEffect | null;
  selectedAnnotation: Annotation | null;
  resolution: { width: number; height: number };
  maxDuration: number;
  onZoomCommit: (updates: Partial<ZoomEffect>) => void;
  onCloseZoom: () => void;
  onZoomDraftChange: (draft: { scale: number; x: number; y: number }) => void;
  onSpeedCommit: (updates: Partial<SpeedEffect>) => void;
  onCloseSpeed: () => void;
  onSpeedDraftChange: (draft: { speed: number }) => void;
  onAnnotationCommit: (updates: Partial<Annotation>) => void;
  onDuplicateAnnotation: () => void;
  onCloseAnnotation: () => void;
}

function InspectorContainer({
  children,
  panelKey,
  ariaLabel,
}: {
  children: ReactNode;
  panelKey: string;
  ariaLabel: string;
}) {
  return (
    <motion.aside
      key={panelKey}
      className="shrink-0 overflow-hidden"
      initial={{ width: 0, opacity: 0, x: 16 }}
      animate={{ width: 256, opacity: 1, x: 0 }}
      exit={{ width: 0, opacity: 0, x: 16 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      aria-label={ariaLabel}
    >
      {children}
    </motion.aside>
  );
}

export function EditorInspectors({
  selectedZoom,
  selectedSpeed,
  selectedAnnotation,
  resolution,
  maxDuration,
  onZoomCommit,
  onCloseZoom,
  onZoomDraftChange,
  onSpeedCommit,
  onCloseSpeed,
  onSpeedDraftChange,
  onAnnotationCommit,
  onDuplicateAnnotation,
  onCloseAnnotation,
}: EditorInspectorsProps) {
  return (
    <>
      <AnimatePresence>
        {selectedZoom && (
          <InspectorContainer panelKey="zoom-inspector" ariaLabel="Zoom settings">
            <ZoomInspector
              zoom={selectedZoom}
              resolution={resolution}
              onCommit={onZoomCommit}
              onClose={onCloseZoom}
              onDraftChange={onZoomDraftChange}
            />
          </InspectorContainer>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedSpeed && (
          <InspectorContainer panelKey="speed-inspector" ariaLabel="Speed settings">
            <SpeedInspector
              speed={selectedSpeed}
              onCommit={onSpeedCommit}
              onClose={onCloseSpeed}
              onDraftChange={onSpeedDraftChange}
            />
          </InspectorContainer>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAnnotation && (
          <InspectorContainer panelKey="annotation-inspector" ariaLabel="Annotation settings">
            <AnnotationInspector
              annotation={selectedAnnotation}
              maxDuration={maxDuration}
              onCommit={onAnnotationCommit}
              onDuplicate={onDuplicateAnnotation}
              onClose={onCloseAnnotation}
            />
          </InspectorContainer>
        )}
      </AnimatePresence>
    </>
  );
}
