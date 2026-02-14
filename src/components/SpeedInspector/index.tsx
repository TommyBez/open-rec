import type { SpeedEffect } from "../../types/project";
import { SpeedInspectorHeader } from "./SpeedInspectorHeader";
import { SpeedControlSection } from "./SpeedControlSection";
import { SpeedPresetSection } from "./SpeedPresetSection";
import { SpeedEffectSummary } from "./SpeedEffectSummary";
import { useSpeedInspectorDraft } from "./useSpeedInspectorDraft";

interface SpeedInspectorProps {
  speed: SpeedEffect;
  onCommit: (updates: Partial<SpeedEffect>) => void;
  onClose: () => void;
  onDraftChange?: (draft: { speed: number }) => void;
}

export function SpeedInspector({
  speed,
  onCommit,
  onClose,
  onDraftChange,
}: SpeedInspectorProps) {
  const {
    draft,
    isSlowMotion,
    isFastForward,
    handleSpeedChange,
    handleSpeedCommit,
    handleResetSpeed,
    handlePresetClick,
  } = useSpeedInspectorDraft({ speed, onCommit, onDraftChange });

  return (
    <div className="flex w-64 flex-col border-l border-border/50 bg-card/30 backdrop-blur-sm">
      <SpeedInspectorHeader onClose={onClose} />

      <div className="flex flex-col gap-5 p-4">
        <SpeedControlSection
          speed={draft.speed}
          isSlowMotion={isSlowMotion}
          isFastForward={isFastForward}
          onSpeedChange={handleSpeedChange}
          onSpeedCommit={handleSpeedCommit}
          onResetSpeed={handleResetSpeed}
        />
        <SpeedPresetSection speed={draft.speed} onPresetClick={handlePresetClick} />
        <SpeedEffectSummary
          speed={draft.speed}
          isSlowMotion={isSlowMotion}
          isFastForward={isFastForward}
        />
      </div>
    </div>
  );
}
