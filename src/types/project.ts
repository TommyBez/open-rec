// Project types matching the Rust backend

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  screenVideoPath: string;
  cameraVideoPath?: string;
  microphoneAudioPath?: string;
  cameraOffsetMs?: number;
  microphoneOffsetMs?: number;
  duration: number;
  resolution: Resolution;
  edits: EditDecisionList;
}

export interface Resolution {
  width: number;
  height: number;
}

export interface EditDecisionList {
  segments: Segment[];
  zoom: ZoomEffect[];
  speed: SpeedEffect[];
  cameraOverlay: CameraOverlaySettings;
}

export interface CameraOverlaySettings {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "custom";
  margin: number;
  scale: number;
  customX: number;
  customY: number;
}

export interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  enabled: boolean;
}

export interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  scale: number;
  x: number;
  y: number;
}

export interface SpeedEffect {
  id: string;
  startTime: number;
  endTime: number;
  speed: number;
}

// Export options
export interface ExportOptions {
  format: "mp4" | "gif" | "mov" | "wav" | "mp3";
  frameRate: 24 | 30 | 60;
  compression: "minimal" | "social" | "web" | "potato";
  resolution: "720p" | "1080p" | "4k";
}

// Capture source types
export interface CaptureSource {
  id: string;
  name: string;
  type: "display" | "window";
  thumbnail?: string;
}

export interface RecordingOptions {
  sourceId: string;
  sourceType: "display" | "window";
  captureCamera: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
  qualityPreset: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60";
  codec: "h264" | "hevc";
}

export interface StartRecordingResult {
  projectId: string;
  screenVideoPath: string;
  cameraVideoPath?: string;
  recordingStartTimeMs: number;
}
