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

function isDuplicateDiagnostic(
  latestEntry: RuntimeDiagnosticEntry | undefined,
  nextEntry: RuntimeDiagnosticInput,
  nowMs: number
): boolean {
  return Boolean(
    latestEntry &&
      latestEntry.source === nextEntry.source &&
      latestEntry.level === nextEntry.level &&
      latestEntry.message === nextEntry.message &&
      latestEntry.metadata?.event === nextEntry.metadata?.event &&
      latestEntry.metadata?.state === nextEntry.metadata?.state &&
      latestEntry.metadata?.status === nextEntry.metadata?.status &&
      latestEntry.metadata?.projectId === nextEntry.metadata?.projectId &&
      latestEntry.metadata?.jobId === nextEntry.metadata?.jobId &&
      nowMs - latestEntry.createdAtMs < DIAGNOSTIC_DEDUPE_WINDOW_MS
  );
}

function appendDiagnosticEntry(
  state: RuntimeDiagnosticsStore,
  nextEntry: RuntimeDiagnosticInput,
  nowMs: number
) {
  if (isDuplicateDiagnostic(state.entries[0], nextEntry, nowMs)) {
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
}

export const useRuntimeDiagnosticsStore = create<RuntimeDiagnosticsStore>((set) => ({
  entries: [],
  nextSequence: 1,
  appendEntry: (entry) =>
    set((state) => {
      const nowMs = Date.now();
      return appendDiagnosticEntry(state, entry, nowMs);
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
      return appendDiagnosticEntry(state, nextEntry, nowMs);
    }),
  clearEntries: () => set({ entries: [], nextSequence: 1 }),
}));
