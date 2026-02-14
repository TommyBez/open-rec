import { useCallback } from "react";
import type { Annotation } from "../../../types/project";

interface UseEditorBoundedUpdatersOptions {
  updateCameraOverlay: (updates: {
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
    margin?: number;
    scale?: number;
    customX?: number;
    customY?: number;
  }) => void;
  updateAudioMix: (updates: {
    systemVolume?: number;
    microphoneVolume?: number;
    microphoneNoiseGate?: boolean;
  }) => void;
  updateColorCorrection: (updates: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
  }) => void;
  updateAnnotation: (annotationId: string, updates: Partial<Annotation>) => void;
}

export function useEditorBoundedUpdaters({
  updateCameraOverlay,
  updateAudioMix,
  updateColorCorrection,
  updateAnnotation,
}: UseEditorBoundedUpdatersOptions) {
  const handleCameraOverlayPositionChange = useCallback(
    (position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom") =>
      updateCameraOverlay({ position }),
    [updateCameraOverlay]
  );

  const handleCameraOverlayScaleChange = useCallback(
    (scale: number) => updateCameraOverlay({ scale: Math.max(0.1, Math.min(0.6, scale)) }),
    [updateCameraOverlay]
  );

  const handleCameraOverlayMarginChange = useCallback(
    (margin: number) => updateCameraOverlay({ margin: Math.max(0, Math.min(100, Math.round(margin))) }),
    [updateCameraOverlay]
  );

  const handleCameraOverlayCustomPositionChange = useCallback(
    (x: number, y: number) =>
      updateCameraOverlay({
        position: "custom",
        customX: Math.min(1, Math.max(0, x)),
        customY: Math.min(1, Math.max(0, y)),
      }),
    [updateCameraOverlay]
  );

  const handleAudioSystemVolumeChange = useCallback(
    (volume: number) => updateAudioMix({ systemVolume: Math.max(0, Math.min(2, volume)) }),
    [updateAudioMix]
  );

  const handleAudioMicrophoneVolumeChange = useCallback(
    (volume: number) => updateAudioMix({ microphoneVolume: Math.max(0, Math.min(2, volume)) }),
    [updateAudioMix]
  );

  const handleMicrophoneNoiseGateChange = useCallback(
    (enabled: boolean) => updateAudioMix({ microphoneNoiseGate: enabled }),
    [updateAudioMix]
  );

  const handleColorBrightnessChange = useCallback(
    (value: number) => updateColorCorrection({ brightness: Math.max(-1, Math.min(1, value)) }),
    [updateColorCorrection]
  );

  const handleColorContrastChange = useCallback(
    (value: number) => updateColorCorrection({ contrast: Math.max(0.5, Math.min(2, value)) }),
    [updateColorCorrection]
  );

  const handleColorSaturationChange = useCallback(
    (value: number) => updateColorCorrection({ saturation: Math.max(0, Math.min(2, value)) }),
    [updateColorCorrection]
  );

  const handleResetColorCorrection = useCallback(
    () =>
      updateColorCorrection({
        brightness: 0,
        contrast: 1,
        saturation: 1,
      }),
    [updateColorCorrection]
  );

  const handleAnnotationPositionChange = useCallback(
    (annotationId: string, x: number, y: number) =>
      updateAnnotation(annotationId, {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      }),
    [updateAnnotation]
  );

  return {
    handleCameraOverlayPositionChange,
    handleCameraOverlayScaleChange,
    handleCameraOverlayMarginChange,
    handleCameraOverlayCustomPositionChange,
    handleAudioSystemVolumeChange,
    handleAudioMicrophoneVolumeChange,
    handleMicrophoneNoiseGateChange,
    handleColorBrightnessChange,
    handleColorContrastChange,
    handleColorSaturationChange,
    handleResetColorCorrection,
    handleAnnotationPositionChange,
  };
}
