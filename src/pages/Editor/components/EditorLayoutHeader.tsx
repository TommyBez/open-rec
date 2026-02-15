import { EditorHeader } from "./EditorHeader";
import type { EditorPageLayoutProps } from "./EditorPageLayout.types";

type EditorLayoutHeaderProps = Pick<
  EditorPageLayoutProps,
  | "project"
  | "isDirty"
  | "activeExportCount"
  | "onRenameProject"
  | "onBack"
  | "onExport"
  | "onOpenVideos"
  | "onOpenInNewWindow"
  | "onCameraOverlayPositionChange"
  | "onCameraOverlayScaleChange"
  | "onCameraOverlayMarginChange"
  | "onAudioSystemVolumeChange"
  | "onAudioMicrophoneVolumeChange"
  | "onMicrophoneNoiseGateChange"
  | "onColorBrightnessChange"
  | "onColorContrastChange"
  | "onColorSaturationChange"
  | "onResetColorCorrection"
>;

export function EditorLayoutHeader({
  project,
  isDirty,
  activeExportCount,
  onRenameProject,
  onBack,
  onExport,
  onOpenVideos,
  onOpenInNewWindow,
  onCameraOverlayPositionChange,
  onCameraOverlayScaleChange,
  onCameraOverlayMarginChange,
  onAudioSystemVolumeChange,
  onAudioMicrophoneVolumeChange,
  onMicrophoneNoiseGateChange,
  onColorBrightnessChange,
  onColorContrastChange,
  onColorSaturationChange,
  onResetColorCorrection,
}: EditorLayoutHeaderProps) {
  return (
    <EditorHeader
      projectName={project.name}
      isDirty={isDirty}
      onRename={onRenameProject}
      hasCameraTrack={Boolean(project.cameraVideoPath)}
      hasMicrophoneTrack={Boolean(project.microphoneAudioPath)}
      cameraOverlayPosition={project.edits.cameraOverlay.position}
      cameraOverlayScale={project.edits.cameraOverlay.scale}
      cameraOverlayMargin={project.edits.cameraOverlay.margin}
      audioSystemVolume={project.edits.audioMix.systemVolume}
      audioMicrophoneVolume={project.edits.audioMix.microphoneVolume}
      microphoneNoiseGate={project.edits.audioMix.microphoneNoiseGate}
      colorBrightness={project.edits.colorCorrection.brightness}
      colorContrast={project.edits.colorCorrection.contrast}
      colorSaturation={project.edits.colorCorrection.saturation}
      onCameraOverlayPositionChange={onCameraOverlayPositionChange}
      onCameraOverlayScaleChange={onCameraOverlayScaleChange}
      onCameraOverlayMarginChange={onCameraOverlayMarginChange}
      onAudioSystemVolumeChange={onAudioSystemVolumeChange}
      onAudioMicrophoneVolumeChange={onAudioMicrophoneVolumeChange}
      onMicrophoneNoiseGateChange={onMicrophoneNoiseGateChange}
      onColorBrightnessChange={onColorBrightnessChange}
      onColorContrastChange={onColorContrastChange}
      onColorSaturationChange={onColorSaturationChange}
      onResetColorCorrection={onResetColorCorrection}
      onBack={onBack}
      onExport={onExport}
      onOpenVideos={onOpenVideos}
      onOpenInNewWindow={onOpenInNewWindow}
      activeExportCount={activeExportCount}
    />
  );
}
