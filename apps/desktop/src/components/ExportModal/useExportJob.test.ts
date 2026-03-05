// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExportJob } from "./useExportJob";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Listener = (event: { payload: any }) => void;

const tauriMocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<Listener>>();
  let deferredExportResolve: (() => void) | null = null;
  let deferredExportEnabled = false;
  const invokeMock = vi.fn(async (command: string, args?: unknown) => {
    if (command === "export_project") {
      if (deferredExportEnabled) {
        return await new Promise<{ jobId: string; outputPath: string }>((resolve) => {
          deferredExportResolve = () => {
            deferredExportEnabled = false;
            deferredExportResolve = null;
            resolve({ jobId: "job-1", outputPath: "/tmp/exported.mp4" });
          };
        });
      }
      return { jobId: "job-1", outputPath: "/tmp/exported.mp4" };
    }
    if (command === "cancel_export") {
      void args;
      return;
    }
    if (command === "append_debug_log") {
      return;
    }
    throw new Error(`Unhandled invoke command: ${command}`);
  });
  const listenMock = vi.fn(async (eventName: string, callback: Listener) => {
    const existing = listeners.get(eventName) ?? new Set<Listener>();
    existing.add(callback);
    listeners.set(eventName, existing);
    return () => {
      const next = listeners.get(eventName);
      next?.delete(callback);
    };
  });
  const emit = (eventName: string, payload: any) => {
    const callbacks = listeners.get(eventName);
    if (!callbacks) return;
    for (const callback of [...callbacks]) {
      callback({ payload });
    }
  };
  const reset = () => {
    listeners.clear();
    invokeMock.mockClear();
    listenMock.mockClear();
    deferredExportEnabled = false;
    deferredExportResolve = null;
  };
  const deferNextExportStart = () => {
    deferredExportEnabled = true;
  };
  const resolveDeferredExportStart = () => {
    deferredExportResolve?.();
  };
  return { invokeMock, listenMock, emit, reset, deferNextExportStart, resolveDeferredExportStart };
});

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invokeMock,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: tauriMocks.listenMock,
}));

interface HookHarness {
  getSnapshot: () => ReturnType<typeof useExportJob>;
  unmount: () => void;
}

function mountHookHarness(): HookHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let snapshot: ReturnType<typeof useExportJob> | null = null;

  function Harness() {
    snapshot = useExportJob({
      projectId: "project-1",
      displayDuration: 12,
      options: {
        format: "mp4",
        frameRate: 30,
        compression: "social",
        resolution: "1080p",
      },
    });
    return null;
  }

  act(() => {
    root.render(createElement(Harness));
  });

  return {
    getSnapshot: () => {
      if (!snapshot) {
        throw new Error("Hook snapshot not available");
      }
      return snapshot;
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useExportJob cancellation race guards", () => {
  let harness: HookHarness;

  beforeEach(() => {
    tauriMocks.reset();
    harness = mountHookHarness();
  });

  afterEach(() => {
    harness.unmount();
  });

  it("preserves complete state for genuine successful exports", async () => {
    await act(async () => {
      await harness.getSnapshot().handleExport();
    });

    expect(harness.getSnapshot().exportStatus).toBe("exporting");
    expect(harness.getSnapshot().jobId).toBe("job-1");

    await act(async () => {
      tauriMocks.emit("export-complete", { jobId: "job-1", outputPath: "/tmp/exported.mp4" });
    });

    expect(harness.getSnapshot().exportStatus).toBe("complete");
    expect(harness.getSnapshot().outputPath).toBe("/tmp/exported.mp4");
    expect(harness.getSnapshot().progress).toBe(100);
  });

  it("ignores late export-complete events after cancellation is requested", async () => {
    await act(async () => {
      await harness.getSnapshot().handleExport();
    });

    await act(async () => {
      await harness.getSnapshot().handleCancelExport();
    });

    await act(async () => {
      tauriMocks.emit("export-complete", { jobId: "job-1", outputPath: "/tmp/exported.mp4" });
    });

    expect(harness.getSnapshot().exportStatus).not.toBe("complete");
    expect(harness.getSnapshot().outputPath).toBeNull();

    await act(async () => {
      tauriMocks.emit("export-cancelled", { jobId: "job-1" });
    });

    expect(harness.getSnapshot().exportStatus).toBe("idle");
    expect(harness.getSnapshot().error).toBe("Export cancelled");
    expect(harness.getSnapshot().jobId).toBeNull();
  });

  it("deduplicates repeated cancel requests for the same job", async () => {
    await act(async () => {
      await harness.getSnapshot().handleExport();
    });

    await act(async () => {
      await harness.getSnapshot().handleCancelExport();
      await harness.getSnapshot().handleCancelExport();
    });

    const cancelCalls = tauriMocks.invokeMock.mock.calls.filter(
      ([command]) => command === "cancel_export"
    );
    expect(cancelCalls).toHaveLength(1);
  });

  it("cancels once job id becomes available after early cancel intent", async () => {
    tauriMocks.deferNextExportStart();
    let exportPromise: Promise<void> | null = null;

    await act(async () => {
      exportPromise = harness.getSnapshot().handleExport();
    });

    expect(harness.getSnapshot().jobId).toBeNull();

    await act(async () => {
      await harness.getSnapshot().handleCancelExport();
    });

    expect(
      tauriMocks.invokeMock.mock.calls.filter(([command]) => command === "cancel_export")
    ).toHaveLength(0);

    await act(async () => {
      tauriMocks.resolveDeferredExportStart();
      if (exportPromise) {
        await exportPromise;
      }
    });

    const cancelCalls = tauriMocks.invokeMock.mock.calls.filter(
      ([command]) => command === "cancel_export"
    );
    expect(cancelCalls).toHaveLength(1);
    expect(cancelCalls[0]?.[1]).toEqual({ jobId: "job-1" });
  });
});
