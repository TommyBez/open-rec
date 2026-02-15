import { create } from "zustand";

interface ExportJobMeta {
  jobId: string;
  startedAtMs: number;
}

interface ExportStore {
  activeExportCount: number;
  registerExportJob: (jobId: string, startedAtMs?: number) => void;
  unregisterExportJob: (jobId: string) => void;
  replaceActiveExportJobs: (jobIds: string[]) => void;
  resetActiveExports: () => void;
  activeExportJobIds: string[];
  activeExportJobs: ExportJobMeta[];
}

function buildExportJobMetadata(
  jobIds: string[],
  previousStartedAtById: Map<string, number>,
  nowMs: number
): ExportJobMeta[] {
  return jobIds.map((jobId) => ({
    jobId,
    startedAtMs: previousStartedAtById.get(jobId) ?? nowMs,
  }));
}

function areJobIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

export const useExportStore = create<ExportStore>((set) => ({
  activeExportCount: 0,
  activeExportJobIds: [],
  activeExportJobs: [],
  registerExportJob: (jobId, startedAtMs) =>
    set((state) => {
      if (state.activeExportJobIds.includes(jobId)) {
        return state;
      }
      const resolvedStartedAtMs = startedAtMs ?? Date.now();
      const activeExportJobIds = [...state.activeExportJobIds, jobId];
      const activeExportJobs = [
        ...state.activeExportJobs,
        {
          jobId,
          startedAtMs: resolvedStartedAtMs,
        },
      ];
      return {
        activeExportJobIds,
        activeExportJobs,
        activeExportCount: activeExportJobIds.length,
      };
    }),
  unregisterExportJob: (jobId) =>
    set((state) => {
      if (!state.activeExportJobIds.includes(jobId)) {
        return state;
      }
      const activeExportJobIds = state.activeExportJobIds.filter((id) => id !== jobId);
      const activeExportJobs = state.activeExportJobs.filter((job) => job.jobId !== jobId);
      return {
        activeExportJobIds,
        activeExportJobs,
        activeExportCount: activeExportJobIds.length,
      };
    }),
  replaceActiveExportJobs: (jobIds) => {
    const uniqueJobIds = [...new Set(jobIds)];
    set((state) => {
      if (areJobIdsEqual(state.activeExportJobIds, uniqueJobIds)) {
        return state;
      }
      const previousStartedAtById = new Map(
        state.activeExportJobs.map((job) => [job.jobId, job.startedAtMs])
      );
      const nowMs = Date.now();
      const activeExportJobs = buildExportJobMetadata(
        uniqueJobIds,
        previousStartedAtById,
        nowMs
      );
      return {
        activeExportJobIds: uniqueJobIds,
        activeExportJobs,
        activeExportCount: uniqueJobIds.length,
      };
    });
  },
  resetActiveExports: () =>
    set({
      activeExportCount: 0,
      activeExportJobIds: [],
      activeExportJobs: [],
    }),
}));
