import { useCallback, useEffect, useMemo, useState } from "react";
import type { SpeedEffect } from "../../types/project";

interface UseSpeedInspectorDraftOptions {
  speed: SpeedEffect;
  onCommit: (updates: Partial<SpeedEffect>) => void;
  onDraftChange?: (draft: { speed: number }) => void;
}

export function useSpeedInspectorDraft({
  speed,
  onCommit,
  onDraftChange,
}: UseSpeedInspectorDraftOptions) {
  const [draft, setDraft] = useState({ speed: speed.speed });

  useEffect(() => {
    setDraft({ speed: speed.speed });
  }, [speed.id, speed.speed]);

  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);

  const handleSpeedChange = useCallback((values: number[]) => {
    setDraft({ speed: values[0] });
  }, []);

  const handleSpeedCommit = useCallback(
    (values: number[]) => {
      onCommit({ speed: values[0] });
    },
    [onCommit]
  );

  const handleResetSpeed = useCallback(() => {
    setDraft({ speed: 1 });
    onCommit({ speed: 1 });
  }, [onCommit]);

  const handlePresetClick = useCallback(
    (presetValue: number) => {
      setDraft({ speed: presetValue });
      onCommit({ speed: presetValue });
    },
    [onCommit]
  );

  const isSlowMotion = useMemo(() => draft.speed < 1, [draft.speed]);
  const isFastForward = useMemo(() => draft.speed > 1, [draft.speed]);

  return {
    draft,
    isSlowMotion,
    isFastForward,
    handleSpeedChange,
    handleSpeedCommit,
    handleResetSpeed,
    handlePresetClick,
  };
}
