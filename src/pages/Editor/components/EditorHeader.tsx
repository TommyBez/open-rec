import { memo } from "react";
import { ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProjectTitle } from "./header/ProjectTitle";
import { ColorCorrectionControls } from "./header/ColorCorrectionControls";
import { AudioMixControls } from "./header/AudioMixControls";
import { CameraOverlayControls } from "./header/CameraOverlayControls";
import { HeaderActions } from "./header/HeaderActions";

interface EditorHeaderProps {
  projectName: string;
  isDirty: boolean;
  onRename: (name: string) => void;
  hasCameraTrack: boolean;
  hasMicrophoneTrack: boolean;
  cameraOverlayPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  cameraOverlayScale: number;
  cameraOverlayMargin: number;
  audioSystemVolume: number;
  audioMicrophoneVolume: number;
  microphoneNoiseGate: boolean;
  colorBrightness: number;
  colorContrast: number;
  colorSaturation: number;
  onCameraOverlayPositionChange: (
    position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom"
  ) => void;
  onCameraOverlayScaleChange: (scale: number) => void;
  onCameraOverlayMarginChange: (margin: number) => void;
  onAudioSystemVolumeChange: (volume: number) => void;
  onAudioMicrophoneVolumeChange: (volume: number) => void;
  onMicrophoneNoiseGateChange: (enabled: boolean) => void;
  onColorBrightnessChange: (value: number) => void;
  onColorContrastChange: (value: number) => void;
  onColorSaturationChange: (value: number) => void;
  onResetColorCorrection: () => void;
  onBack: () => void;
  onExport: () => void;
  onOpenVideos: () => void;
  onOpenInNewWindow: () => void;
  activeExportCount: number;
}

export const EditorHeader = memo(function EditorHeader({
  projectName,
  isDirty,
  onRename,
  hasCameraTrack,
  hasMicrophoneTrack,
  cameraOverlayPosition,
  cameraOverlayScale,
  cameraOverlayMargin,
  audioSystemVolume,
  audioMicrophoneVolume,
  microphoneNoiseGate,
  colorBrightness,
  colorContrast,
  colorSaturation,
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
  onBack,
  onExport,
  onOpenVideos,
  onOpenInNewWindow,
  activeExportCount,
}: EditorHeaderProps) {
  return (
    <header className="relative z-10 flex items-center justify-between border-b border-border/50 bg-card/30 px-4 py-3 backdrop-blur-sm animate-fade-up">
      <div className="flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onBack}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-5" strokeWidth={1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Back to recorder</TooltipContent>
        </Tooltip>
        <ProjectTitle projectName={projectName} isDirty={isDirty} onRename={onRename} />
      </div>
      <div className="flex items-center gap-2">
        <ColorCorrectionControls
          brightness={colorBrightness}
          contrast={colorContrast}
          saturation={colorSaturation}
          onBrightnessChange={onColorBrightnessChange}
          onContrastChange={onColorContrastChange}
          onSaturationChange={onColorSaturationChange}
          onReset={onResetColorCorrection}
        />
        <AudioMixControls
          hasMicrophoneTrack={hasMicrophoneTrack}
          systemVolume={audioSystemVolume}
          microphoneVolume={audioMicrophoneVolume}
          microphoneNoiseGate={microphoneNoiseGate}
          onSystemVolumeChange={onAudioSystemVolumeChange}
          onMicrophoneVolumeChange={onAudioMicrophoneVolumeChange}
          onMicrophoneNoiseGateChange={onMicrophoneNoiseGateChange}
        />
        <CameraOverlayControls
          hasCameraTrack={hasCameraTrack}
          cameraOverlayPosition={cameraOverlayPosition}
          cameraOverlayScale={cameraOverlayScale}
          cameraOverlayMargin={cameraOverlayMargin}
          onCameraOverlayPositionChange={onCameraOverlayPositionChange}
          onCameraOverlayScaleChange={onCameraOverlayScaleChange}
          onCameraOverlayMarginChange={onCameraOverlayMarginChange}
        />
        <HeaderActions
          onOpenVideos={onOpenVideos}
          onOpenInNewWindow={onOpenInNewWindow}
          onExport={onExport}
          activeExportCount={activeExportCount}
        />
      </div>
    </header>
  );
});
