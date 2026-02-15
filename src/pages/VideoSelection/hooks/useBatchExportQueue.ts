import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { ExportOptions, Project } from "../../../types/project";

interface UseBatchExportQueueOptions {
  selectedProjectIds: string[];
  projects: Project[];
}

const defaultBatchOptions: ExportOptions = {
  format: "mp4",
  frameRate: 30,
  compression: "social",
  resolution: "1080p",
};

async function waitForExportResult(jobId: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const unlisteners: UnlistenFn[] = [];
    let timeoutId: number | null = null;
    let settled = false;

    const cleanup = () => {
      unlisteners.forEach((unlisten) => unlisten());
    };

    const settle = (result: { ok: boolean; message: string }) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      cleanup();
      resolve(result);
    };

    timeoutId = window.setTimeout(() => {
      settle({ ok: false, message: "Export timed out" });
    }, 30 * 60 * 1000);

    void Promise.allSettled([
      listen<{ jobId: string; outputPath: string }>("export-complete", (event) => {
        if (event.payload.jobId !== jobId) return;
        settle({ ok: true, message: event.payload.outputPath });
      }),
      listen<{ jobId: string; message: string }>("export-error", (event) => {
        if (event.payload.jobId !== jobId) return;
        settle({ ok: false, message: event.payload.message });
      }),
      listen<{ jobId: string }>("export-cancelled", (event) => {
        if (event.payload.jobId !== jobId) return;
        settle({ ok: false, message: "Export cancelled" });
      }),
    ])
      .then((listenerResults) => {
        const handles = listenerResults
          .filter((result): result is PromiseFulfilledResult<UnlistenFn> => result.status === "fulfilled")
          .map((result) => result.value);
        const hasRegistrationError = listenerResults.some(
          (result) => result.status === "rejected"
        );
        if (hasRegistrationError) {
          handles.forEach((unlisten) => unlisten());
          settle({ ok: false, message: "Failed to attach export listeners" });
          return;
        }
        if (settled) {
          handles.forEach((unlisten) => unlisten());
          return;
        }
        unlisteners.push(...handles);
      })
      .catch((error) => {
        console.error("Failed to attach batch export listeners unexpectedly:", error);
        settle({ ok: false, message: "Failed to attach export listeners" });
      });
  });
}

export function useBatchExportQueue({ selectedProjectIds, projects }: UseBatchExportQueueOptions) {
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [currentBatchJobId, setCurrentBatchJobId] = useState<string | null>(null);
  const [stopBatchRequested, setStopBatchRequested] = useState(false);
  const stopBatchRequestedRef = useRef(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [batchHistory, setBatchHistory] = useState<string[]>([]);
  const [batchOptions, setBatchOptions] = useState<ExportOptions>(defaultBatchOptions);

  async function startBatchExport() {
    const queueProjectIds = Array.from(
      new Set(selectedProjectIds.map((id) => id.trim()).filter((id) => id.length > 0))
    );
    if (queueProjectIds.length === 0 || isBatchExporting) return;
    const projectLookup = new Map(projects.map((project) => [project.id, project]));

    setIsBatchExporting(true);
    setStopBatchRequested(false);
    stopBatchRequestedRef.current = false;
    setBatchHistory([]);
    setBatchStatus(`Preparing batch export (0/${queueProjectIds.length})...`);

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < queueProjectIds.length; i++) {
      if (stopBatchRequestedRef.current) break;

      const projectId = queueProjectIds[i];
      const project = projectLookup.get(projectId);
      const projectName = project?.name ?? `Project ${i + 1}`;
      if (!project) {
        failed += 1;
        setBatchHistory((history) => [...history, `✗ ${projectName} (project missing locally)`]);
        continue;
      }

      setBatchStatus(`Exporting ${i + 1}/${queueProjectIds.length}: ${projectName}`);
      try {
        const started = await invoke<{ jobId: string }>("export_project", {
          projectId,
          options: batchOptions,
        });
        setCurrentBatchJobId(started.jobId);
        const result = await waitForExportResult(started.jobId);
        setCurrentBatchJobId(null);
        if (result.ok) {
          completed += 1;
          setBatchHistory((history) => [...history, `✓ ${projectName}`]);
        } else {
          failed += 1;
          setBatchHistory((history) => [...history, `✗ ${projectName} (${result.message})`]);
        }
      } catch (error) {
        failed += 1;
        setBatchHistory((history) => [...history, `✗ ${projectName} (failed to start)`]);
        console.error("Batch export failed for project:", projectId, error);
      }
    }

    if (stopBatchRequestedRef.current) {
      setBatchStatus(`Batch export stopped: ${completed} succeeded, ${failed} failed.`);
    } else {
      setBatchStatus(`Batch export finished: ${completed} succeeded, ${failed} failed.`);
    }
    setStopBatchRequested(false);
    setCurrentBatchJobId(null);
    setIsBatchExporting(false);
  }

  async function stopBatchExport() {
    setStopBatchRequested(true);
    stopBatchRequestedRef.current = true;
    if (!currentBatchJobId) return;
    try {
      await invoke("cancel_export", { jobId: currentBatchJobId });
    } catch (error) {
      console.error("Failed to stop current batch export job:", error);
    }
  }

  return {
    batchOptions,
    setBatchOptions,
    isBatchExporting,
    stopBatchRequested,
    batchStatus,
    batchHistory,
    startBatchExport,
    stopBatchExport,
  };
}
