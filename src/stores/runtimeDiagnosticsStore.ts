import { create } from "zustand";

const MAX_DIAGNOSTIC_ENTRIES = 24;
const DIAGNOSTIC_DEDUPE_WINDOW_MS = 5_000;

export type RuntimeDiagnosticLevel = "info" | "warning" | "error";

export interface RuntimeDiagnosticEntry {
  id: string;
  source: "recorder" | "export" | "system";
  level: RuntimeDiagnosticLevel;
  message: string;
  createdAtMs: number;
}

interface RuntimeDiagnosticsStore {
  entries: RuntimeDiagnosticEntry[];
  appendEntry: (entry: Omit<RuntimeDiagnosticEntry, "id" | "createdAtMs">) => void;
  clearEntries: () => void;
}

function buildEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useRuntimeDiagnosticsStore = create<RuntimeDiagnosticsStore>((set) => ({
  entries: [],
  appendEntry: (entry) =>
    set((state) => {
      const nowMs = Date.now();
      const latestEntry = state.entries[0];
      const isDuplicate =
        latestEntry &&
        latestEntry.source === entry.source &&
        latestEntry.level === entry.level &&
        latestEntry.message === entry.message &&
        nowMs - latestEntry.createdAtMs < DIAGNOSTIC_DEDUPE_WINDOW_MS;
      if (isDuplicate) {
        return state;
      }
      const nextEntries = [
        {
          ...entry,
          id: buildEntryId(),
          createdAtMs: nowMs,
        },
        ...state.entries,
      ].slice(0, MAX_DIAGNOSTIC_ENTRIES);
      return { entries: nextEntries };
    }),
  clearEntries: () => set({ entries: [] }),
}));
