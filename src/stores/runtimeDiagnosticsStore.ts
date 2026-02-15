import { create } from "zustand";

const MAX_DIAGNOSTIC_ENTRIES = 24;
const DIAGNOSTIC_DEDUPE_WINDOW_MS = 5_000;

export type RuntimeDiagnosticLevel = "info" | "warning" | "error";
type RuntimeDiagnosticSource = "recorder" | "export" | "system";

interface RuntimeDiagnosticMetadata {
  event: string;
  state?: string;
  status?: string;
  projectId?: string;
  jobId?: string;
}

export interface RuntimeDiagnosticEntry {
  id: string;
  source: RuntimeDiagnosticSource;
  level: RuntimeDiagnosticLevel;
  message: string;
  createdAtMs: number;
  sequence: number;
  metadata?: RuntimeDiagnosticMetadata;
}

interface RuntimeDiagnosticInput {
  source: RuntimeDiagnosticSource;
  level: RuntimeDiagnosticLevel;
  message: string;
  metadata?: RuntimeDiagnosticMetadata;
}

interface RuntimeDiagnosticLifecycleInput {
  source: RuntimeDiagnosticSource;
  event: string;
  summary: string;
  level?: RuntimeDiagnosticLevel;
  state?: string;
  status?: string;
  projectId?: string;
  jobId?: string;
}

interface RuntimeDiagnosticsStore {
  entries: RuntimeDiagnosticEntry[];
  appendEntry: (entry: RuntimeDiagnosticInput) => void;
  appendLifecycleEvent: (entry: RuntimeDiagnosticLifecycleInput) => void;
  clearEntries: () => void;
  nextSequence: number;
}

function buildEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useRuntimeDiagnosticsStore = create<RuntimeDiagnosticsStore>((set) => ({
  entries: [],
  nextSequence: 1,
  appendEntry: (entry) =>
    set((state) => {
      const nowMs = Date.now();
      const latestEntry = state.entries[0];
      const isDuplicate =
        latestEntry &&
        latestEntry.source === entry.source &&
        latestEntry.level === entry.level &&
        latestEntry.message === entry.message &&
        latestEntry.metadata?.event === entry.metadata?.event &&
        latestEntry.metadata?.state === entry.metadata?.state &&
        latestEntry.metadata?.status === entry.metadata?.status &&
        latestEntry.metadata?.projectId === entry.metadata?.projectId &&
        latestEntry.metadata?.jobId === entry.metadata?.jobId &&
        nowMs - latestEntry.createdAtMs < DIAGNOSTIC_DEDUPE_WINDOW_MS;
      if (isDuplicate) {
        return state;
      }
      const nextEntries = [
        {
          ...entry,
          id: buildEntryId(),
          createdAtMs: nowMs,
          sequence: state.nextSequence,
        },
        ...state.entries,
      ].slice(0, MAX_DIAGNOSTIC_ENTRIES);
      return {
        entries: nextEntries,
        nextSequence: state.nextSequence + 1,
      };
    }),
  appendLifecycleEvent: (entry) =>
    set((state) => {
      const nowMs = Date.now();
      const nextEntry: RuntimeDiagnosticInput = {
        source: entry.source,
        level: entry.level ?? "info",
        message: entry.summary,
        metadata: {
          event: entry.event,
          state: entry.state,
          status: entry.status,
          projectId: entry.projectId,
          jobId: entry.jobId,
        },
      };
      const latestEntry = state.entries[0];
      const isDuplicate =
        latestEntry &&
        latestEntry.source === nextEntry.source &&
        latestEntry.level === nextEntry.level &&
        latestEntry.message === nextEntry.message &&
        latestEntry.metadata?.event === nextEntry.metadata?.event &&
        latestEntry.metadata?.state === nextEntry.metadata?.state &&
        latestEntry.metadata?.status === nextEntry.metadata?.status &&
        latestEntry.metadata?.projectId === nextEntry.metadata?.projectId &&
        latestEntry.metadata?.jobId === nextEntry.metadata?.jobId &&
        nowMs - latestEntry.createdAtMs < DIAGNOSTIC_DEDUPE_WINDOW_MS;
      if (isDuplicate) {
        return state;
      }
      const entries = [
        {
          ...nextEntry,
          id: buildEntryId(),
          createdAtMs: nowMs,
          sequence: state.nextSequence,
        },
        ...state.entries,
      ].slice(0, MAX_DIAGNOSTIC_ENTRIES);
      return {
        entries,
        nextSequence: state.nextSequence + 1,
      };
    }),
  clearEntries: () => set({ entries: [], nextSequence: 1 }),
}));
