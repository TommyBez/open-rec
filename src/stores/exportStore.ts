import { create } from "zustand";

interface ExportStore {
  activeExportCount: number;
  incrementActiveExports: () => void;
  decrementActiveExports: () => void;
  resetActiveExports: () => void;
}

export const useExportStore = create<ExportStore>((set) => ({
  activeExportCount: 0,
  incrementActiveExports: () =>
    set((state) => ({ activeExportCount: state.activeExportCount + 1 })),
  decrementActiveExports: () =>
    set((state) => ({ activeExportCount: Math.max(0, state.activeExportCount - 1) })),
  resetActiveExports: () => set({ activeExportCount: 0 }),
}));
