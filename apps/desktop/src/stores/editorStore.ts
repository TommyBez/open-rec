import { create } from "zustand";

export type EditorTool = "cut" | "zoom" | "speed" | "annotation" | null;

interface EditorStore {
  // Playback state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  
  // Tool selection
  selectedTool: EditorTool;
  
  // Selection state
  selectedSegmentId: string | null;
  selectedZoomId: string | null;
  selectedSpeedId: string | null;
  selectedAnnotationId: string | null;
  
  // Draft state for live preview
  zoomDraft: { scale: number; x: number; y: number } | null;
  speedDraft: { speed: number } | null;
  
  // UI state
  showExportModal: boolean;
  isLoading: boolean;
  
  // Actions
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setSelectedTool: (tool: EditorTool) => void;
  toggleTool: (tool: "cut" | "zoom" | "speed" | "annotation") => void;
  
  // Selection actions
  selectSegment: (id: string | null) => void;
  selectZoom: (id: string | null) => void;
  selectSpeed: (id: string | null) => void;
  selectAnnotation: (id: string | null) => void;
  clearSelection: () => void;
  
  // Draft actions
  setZoomDraft: (draft: { scale: number; x: number; y: number } | null) => void;
  setSpeedDraft: (draft: { speed: number } | null) => void;
  
  // UI actions
  setShowExportModal: (show: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  selectedTool: null as EditorTool,
  selectedSegmentId: null,
  selectedZoomId: null,
  selectedSpeedId: null,
  selectedAnnotationId: null,
  zoomDraft: null,
  speedDraft: null,
  showExportModal: false,
  isLoading: true,
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialState,
  
  // Actions
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  toggleTool: (tool) => set((state) => ({
    selectedTool: state.selectedTool === tool ? null : tool,
  })),
  
  // Selection actions - when selecting one type, clear others
  selectSegment: (id) => set(() => ({
    selectedSegmentId: id,
    selectedZoomId: null,
    selectedSpeedId: null,
    selectedAnnotationId: null,
  })),
  
  selectZoom: (id) => set(() => ({
    selectedZoomId: id,
    zoomDraft: null, // Clear draft when selection changes
    selectedSegmentId: null,
    selectedSpeedId: null,
    selectedAnnotationId: null,
  })),
  
  selectSpeed: (id) => set(() => ({
    selectedSpeedId: id,
    speedDraft: null, // Clear draft when selection changes
    selectedSegmentId: null,
    selectedZoomId: null,
    selectedAnnotationId: null,
  })),

  selectAnnotation: (id) => set(() => ({
    selectedAnnotationId: id,
    selectedSegmentId: null,
    selectedZoomId: null,
    selectedSpeedId: null,
  })),
  
  clearSelection: () => set({
    selectedSegmentId: null,
    selectedZoomId: null,
    selectedSpeedId: null,
    selectedAnnotationId: null,
    zoomDraft: null,
    speedDraft: null,
  }),
  
  // Draft actions
  setZoomDraft: (draft) => set({ zoomDraft: draft }),
  setSpeedDraft: (draft) => set({ speedDraft: draft }),
  
  // UI actions
  setShowExportModal: (show) => set({ showExportModal: show }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  
  // Reset
  reset: () => set(initialState),
}));
