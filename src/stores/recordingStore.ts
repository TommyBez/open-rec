import { create } from "zustand";
import { CaptureSource } from "../types/project";

export type RecordingState = "idle" | "starting" | "recording" | "paused";

interface RecordingStore {
  // Recording state
  state: RecordingState;
  elapsedTime: number;
  projectId: string | null;
  recordingStartTimeMs: number | null;
  
  // Source selection
  sourceType: "display" | "window";
  selectedSource: CaptureSource | null;
  sources: CaptureSource[];
  isLoadingSources: boolean;
  
  // Input options
  captureCamera: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
  qualityPreset: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60";
  codec: "h264" | "hevc";
  
  // Permission state
  hasPermission: boolean | null;
  
  // Camera state
  cameraReady: boolean;
  
  // Actions
  setRecordingState: (state: RecordingState) => void;
  setElapsedTime: (time: number) => void;
  incrementElapsedTime: () => void;
  setProjectId: (id: string | null) => void;
  setRecordingStartTimeMs: (value: number | null) => void;
  setSourceType: (type: "display" | "window") => void;
  setSelectedSource: (source: CaptureSource | null) => void;
  setSources: (sources: CaptureSource[]) => void;
  setIsLoadingSources: (loading: boolean) => void;
  setCaptureCamera: (enabled: boolean) => void;
  setCaptureMicrophone: (enabled: boolean) => void;
  setCaptureSystemAudio: (enabled: boolean) => void;
  setQualityPreset: (preset: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60") => void;
  setCodec: (codec: "h264" | "hevc") => void;
  setHasPermission: (permission: boolean | null) => void;
  setCameraReady: (ready: boolean) => void;
  
  // Composite actions
  beginRecordingStart: () => void;
  startRecording: (projectId: string) => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  // Initial state
  state: "idle",
  elapsedTime: 0,
  projectId: null,
  recordingStartTimeMs: null,
  sourceType: "display",
  selectedSource: null,
  sources: [],
  isLoadingSources: false,
  captureCamera: false,
  captureMicrophone: false,
  captureSystemAudio: false,
  qualityPreset: "1080p30",
  codec: "h264",
  hasPermission: null,
  cameraReady: false,
  
  // Actions
  setRecordingState: (state) => set({ state }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  incrementElapsedTime: () => set((s) => ({ elapsedTime: s.elapsedTime + 1 })),
  setProjectId: (id) => set({ projectId: id }),
  setRecordingStartTimeMs: (value) => set({ recordingStartTimeMs: value }),
  setSourceType: (type) => set({ sourceType: type }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setSources: (sources) => set({ sources }),
  setIsLoadingSources: (loading) => set({ isLoadingSources: loading }),
  setCaptureCamera: (enabled) => set({ captureCamera: enabled }),
  setCaptureMicrophone: (enabled) => set({ captureMicrophone: enabled }),
  setCaptureSystemAudio: (enabled) => set({ captureSystemAudio: enabled }),
  setQualityPreset: (qualityPreset) => set({ qualityPreset }),
  setCodec: (codec) => set({ codec }),
  setHasPermission: (permission) => set({ hasPermission: permission }),
  setCameraReady: (ready) => set({ cameraReady: ready }),
  
  // Composite actions
  beginRecordingStart: () => set({
    state: "starting",
  }),

  startRecording: (projectId) => set({
    state: "recording",
    projectId,
    elapsedTime: 0,
  }),
  
  stopRecording: () => set({
    state: "idle",
    elapsedTime: 0,
    recordingStartTimeMs: null,
  }),
  
  resetRecording: () => set({
    state: "idle",
    elapsedTime: 0,
    projectId: null,
    recordingStartTimeMs: null,
  }),
}));
