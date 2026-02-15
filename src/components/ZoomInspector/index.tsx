import type { ZoomEffect } from "../../types/project";
import { ZoomInspectorHeader } from "./ZoomInspectorHeader";
import { ZoomFactorControl } from "./ZoomFactorControl";
import { FocusPointControl } from "./FocusPointControl";
import { useZoomInspectorDraft } from "./useZoomInspectorDraft";

interface ZoomInspectorProps {
  zoom: ZoomEffect;
  resolution: { width: number; height: number };
  onCommit: (updates: Partial<ZoomEffect>) => void;
  onClose: () => void;
  onDraftChange?: (draft: { scale: number; x: number; y: number }) => void;
}

export function ZoomInspector({
  zoom,
  resolution,
  onCommit,
  onClose,
  onDraftChange,
}: ZoomInspectorProps) {
  const {
    draft,
    padRef,
    isDraggingPad,
    handleScaleChange,
    handleScaleCommit,
    handlePadPointerDown,
    handlePadPointerMove,
    handlePadPointerUp,
    handleResetFocus,
    handlePosX,
    handlePosY,
  } = useZoomInspectorDraft({ zoom, resolution, onCommit, onDraftChange });

  return (
    <div className="flex w-64 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm">
      <ZoomInspectorHeader onClose={onClose} />
      <div className="flex flex-col gap-5 p-4">
        <ZoomFactorControl
          scale={draft.scale}
          onChange={handleScaleChange}
          onCommit={handleScaleCommit}
        />
        <FocusPointControl
          resolution={resolution}
          isDraggingPad={isDraggingPad}
          handlePosX={handlePosX}
          handlePosY={handlePosY}
          draftX={draft.x}
          draftY={draft.y}
          onResetFocus={handleResetFocus}
          onPointerDown={handlePadPointerDown}
          onPointerMove={handlePadPointerMove}
          onPointerUp={handlePadPointerUp}
          padRef={padRef}
        />
      </div>
    </div>
  );
}
