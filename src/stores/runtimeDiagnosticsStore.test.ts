import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRuntimeDiagnosticsStore } from "./runtimeDiagnosticsStore";

describe("runtimeDiagnosticsStore", () => {
  beforeEach(() => {
    useRuntimeDiagnosticsStore.setState({ entries: [], nextSequence: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("assigns sequence ids and appends newest-first", () => {
    const appendEntry = useRuntimeDiagnosticsStore.getState().appendEntry;

    appendEntry({ source: "recorder", level: "warning", message: "first warning" });
    appendEntry({ source: "export", level: "info", message: "second info" });

    const entries = useRuntimeDiagnosticsStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe("second info");
    expect(entries[0].sequence).toBe(2);
    expect(entries[1].message).toBe("first warning");
    expect(entries[1].sequence).toBe(1);
  });

  it("deduplicates identical events within the dedupe window", () => {
    const appendEntry = useRuntimeDiagnosticsStore.getState().appendEntry;
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(10_000);
    appendEntry({
      source: "recorder",
      level: "warning",
      message: "same warning",
      metadata: { event: "event-a", projectId: "project-1" },
    });
    nowSpy.mockReturnValue(10_100);
    appendEntry({
      source: "recorder",
      level: "warning",
      message: "same warning",
      metadata: { event: "event-a", projectId: "project-1" },
    });

    const state = useRuntimeDiagnosticsStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.nextSequence).toBe(2);
  });

  it("allows the same event after dedupe window expires", () => {
    const appendEntry = useRuntimeDiagnosticsStore.getState().appendEntry;
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(10_000);
    appendEntry({
      source: "recorder",
      level: "warning",
      message: "same warning",
      metadata: { event: "event-a", projectId: "project-1" },
    });
    nowSpy.mockReturnValue(20_500);
    appendEntry({
      source: "recorder",
      level: "warning",
      message: "same warning",
      metadata: { event: "event-a", projectId: "project-1" },
    });

    const state = useRuntimeDiagnosticsStore.getState();
    expect(state.entries).toHaveLength(2);
    expect(state.entries[0].sequence).toBe(2);
    expect(state.nextSequence).toBe(3);
  });

  it("maps lifecycle events to metadata with default info level", () => {
    const appendLifecycleEvent = useRuntimeDiagnosticsStore.getState().appendLifecycleEvent;
    appendLifecycleEvent({
      source: "system",
      event: "recording-finalization-retry-status",
      summary: "Retry started",
      projectId: "project-42",
      status: "started",
    });

    const entry = useRuntimeDiagnosticsStore.getState().entries[0];
    expect(entry.level).toBe("info");
    expect(entry.metadata?.event).toBe("recording-finalization-retry-status");
    expect(entry.metadata?.projectId).toBe("project-42");
    expect(entry.metadata?.status).toBe("started");
  });

  it("caps diagnostic history length", () => {
    const appendEntry = useRuntimeDiagnosticsStore.getState().appendEntry;
    for (let index = 0; index < 30; index += 1) {
      appendEntry({
        source: "export",
        level: "info",
        message: `entry-${index}`,
      });
    }

    const state = useRuntimeDiagnosticsStore.getState();
    expect(state.entries).toHaveLength(24);
    expect(state.entries[0].message).toBe("entry-29");
    expect(state.entries[state.entries.length - 1]?.message).toBe("entry-6");
    expect(state.nextSequence).toBe(31);
  });
});
