import { create } from "zustand";
import { CaptureSource } from "../types/project";

export type RecordingState = "idle" | "recording" | "paused";

interface RecordingStore {
  // Recording state
  state: RecordingState;
  elapsedTime: number;
  projectId: string | null;
  
  // Source selection
  sourceType: "display" | "window";
  selectedSource: CaptureSource | null;
  sources: CaptureSource[];
  isLoadingSources: boolean;
  
  // Input options
  captureCamera: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
  
  // Permission state
  hasPermission: boolean | null;
  
  // Camera state
  cameraReady: boolean;
  
  // Actions
  setRecordingState: (state: RecordingState) => void;
  setElapsedTime: (time: number) => void;
  incrementElapsedTime: () => void;
  setProjectId: (id: string | null) => void;
  setSourceType: (type: "display" | "window") => void;
  setSelectedSource: (source: CaptureSource | null) => void;
  setSources: (sources: CaptureSource[]) => void;
  setIsLoadingSources: (loading: boolean) => void;
  setCaptureCamera: (enabled: boolean) => void;
  setCaptureMicrophone: (enabled: boolean) => void;
  setCaptureSystemAudio: (enabled: boolean) => void;
  setHasPermission: (permission: boolean | null) => void;
  setCameraReady: (ready: boolean) => void;
  
  // Composite actions
  startRecording: (projectId: string) => void;
  stopRecording: () => void;
  resetRecording: () => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  // Initial state
  state: "idle",
  elapsedTime: 0,
  projectId: null,
  sourceType: "display",
  selectedSource: null,
  sources: [],
  isLoadingSources: false,
  captureCamera: false,
  captureMicrophone: false,
  captureSystemAudio: false,
  hasPermission: null,
  cameraReady: false,
  
  // Actions
  setRecordingState: (state) => set({ state }),
  setElapsedTime: (time) => set({ elapsedTime: time }),
  incrementElapsedTime: () => set((s) => ({ elapsedTime: s.elapsedTime + 1 })),
  setProjectId: (id) => set({ projectId: id }),
  setSourceType: (type) => set({ sourceType: type }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setSources: (sources) => set({ sources }),
  setIsLoadingSources: (loading) => set({ isLoadingSources: loading }),
  setCaptureCamera: (enabled) => set({ captureCamera: enabled }),
  setCaptureMicrophone: (enabled) => set({ captureMicrophone: enabled }),
  setCaptureSystemAudio: (enabled) => set({ captureSystemAudio: enabled }),
  setHasPermission: (permission) => set({ hasPermission: permission }),
  setCameraReady: (ready) => set({ cameraReady: ready }),
  
  // Composite actions
  startRecording: (projectId) => set({
    state: "recording",
    projectId,
    elapsedTime: 0,
  }),
  
  stopRecording: () => set({
    state: "idle",
    elapsedTime: 0,
  }),
  
  resetRecording: () => set({
    state: "idle",
    elapsedTime: 0,
    projectId: null,
  }),
}));
