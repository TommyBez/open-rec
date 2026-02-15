import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExportStore } from "./exportStore";

describe("exportStore", () => {
  beforeEach(() => {
    useExportStore.getState().resetActiveExports();
    vi.restoreAllMocks();
  });

  it("registers jobs with default start time when omitted", () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1000);
    useExportStore.getState().registerExportJob("job-a");

    const state = useExportStore.getState();
    expect(state.activeExportCount).toBe(1);
    expect(state.activeExportJobIds).toEqual(["job-a"]);
    expect(state.activeExportJobs).toEqual([{ jobId: "job-a", startedAtMs: 1000 }]);
    nowSpy.mockRestore();
  });

  it("preserves explicit start times and prevents duplicate registration", () => {
    useExportStore.getState().registerExportJob("job-a", 5000);
    useExportStore.getState().registerExportJob("job-a", 9000);

    const state = useExportStore.getState();
    expect(state.activeExportCount).toBe(1);
    expect(state.activeExportJobs).toEqual([{ jobId: "job-a", startedAtMs: 5000 }]);
  });

  it("replaces active jobs while preserving known start times", () => {
    useExportStore.getState().registerExportJob("job-a", 1111);
    useExportStore.getState().registerExportJob("job-b", 2222);

    vi.spyOn(Date, "now").mockReturnValue(9999);
    useExportStore
      .getState()
      .replaceActiveExportJobs(["job-b", "job-c", "job-c", "job-a"]);

    const state = useExportStore.getState();
    expect(state.activeExportJobIds).toEqual(["job-b", "job-c", "job-a"]);
    expect(state.activeExportCount).toBe(3);
    expect(state.activeExportJobs).toEqual([
      { jobId: "job-b", startedAtMs: 2222 },
      { jobId: "job-c", startedAtMs: 9999 },
      { jobId: "job-a", startedAtMs: 1111 },
    ]);
  });

  it("unregisters jobs and resets state", () => {
    useExportStore.getState().registerExportJob("job-a", 1111);
    useExportStore.getState().registerExportJob("job-b", 2222);
    useExportStore.getState().unregisterExportJob("job-a");

    expect(useExportStore.getState().activeExportJobIds).toEqual(["job-b"]);
    expect(useExportStore.getState().activeExportCount).toBe(1);

    useExportStore.getState().resetActiveExports();
    expect(useExportStore.getState().activeExportCount).toBe(0);
    expect(useExportStore.getState().activeExportJobIds).toEqual([]);
    expect(useExportStore.getState().activeExportJobs).toEqual([]);
  });
});
