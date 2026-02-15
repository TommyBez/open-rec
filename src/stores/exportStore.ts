import { create } from "zustand";

interface ExportStore {
  activeExportCount: number;
  registerExportJob: (jobId: string) => void;
  unregisterExportJob: (jobId: string) => void;
  replaceActiveExportJobs: (jobIds: string[]) => void;
  resetActiveExports: () => void;
  activeExportJobIds: string[];
}

export const useExportStore = create<ExportStore>((set) => ({
  activeExportCount: 0,
  activeExportJobIds: [],
  registerExportJob: (jobId) =>
    set((state) => {
      if (state.activeExportJobIds.includes(jobId)) {
        return state;
      }
      const activeExportJobIds = [...state.activeExportJobIds, jobId];
      return {
        activeExportJobIds,
        activeExportCount: activeExportJobIds.length,
      };
    }),
  unregisterExportJob: (jobId) =>
    set((state) => {
      if (!state.activeExportJobIds.includes(jobId)) {
        return state;
      }
      const activeExportJobIds = state.activeExportJobIds.filter((id) => id !== jobId);
      return {
        activeExportJobIds,
        activeExportCount: activeExportJobIds.length,
      };
    }),
  replaceActiveExportJobs: (jobIds) => {
    const uniqueJobIds = [...new Set(jobIds)];
    set({
      activeExportJobIds: uniqueJobIds,
      activeExportCount: uniqueJobIds.length,
    });
  },
  resetActiveExports: () => set({ activeExportCount: 0, activeExportJobIds: [] }),
}));
