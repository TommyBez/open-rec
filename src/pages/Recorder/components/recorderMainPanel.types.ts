import { CaptureSource } from "../../../types/project";

export interface RecorderMainPanelProps {
  selectedSource: CaptureSource | null;
  countdown: number | null;
  errorMessage: string | null;
  finalizingMessage: string | null;
  diskWarning: string | null;
  sourceType: "display" | "window";
  sources: CaptureSource[];
  isLoadingSources: boolean;
  captureCamera: boolean;
  isActivelyRecording: boolean;
  projectId: string | null;
  recordingStartTimeMs: number | null;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
  cameraReady: boolean;
  qualityPreset: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60";
  codec: "h264" | "hevc";
  isRecording: boolean;
  onOpenVideos: () => void;
  onSetSourceType: (type: "display" | "window") => void;
  onSetSelectedSource: (source: CaptureSource) => void;
  onSetCameraReady: (ready: boolean) => void;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onToggleSystemAudio: () => void;
  onQualityPresetChange: (value: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60") => void;
  onCodecChange: (value: "h264" | "hevc") => void;
  showOpenRecordingWidgetButton: boolean;
  showRetryFinalizationButton: boolean;
  onOpenRecordingWidget: () => void;
  onRetryFinalization: () => void;
  onStartRecording: () => void;
}
