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
  return new Promise(async (resolve) => {
    const unlisteners: UnlistenFn[] = [];
    const cleanup = () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve({ ok: false, message: "Export timed out" });
    }, 30 * 60 * 1000);

    const onComplete = await listen<{ jobId: string; outputPath: string }>("export-complete", (event) => {
      if (event.payload.jobId !== jobId) return;
      cleanup();
      clearTimeout(timeoutId);
      resolve({ ok: true, message: event.payload.outputPath });
    });
    const onError = await listen<{ jobId: string; message: string }>("export-error", (event) => {
      if (event.payload.jobId !== jobId) return;
      cleanup();
      clearTimeout(timeoutId);
      resolve({ ok: false, message: event.payload.message });
    });
    const onCancelled = await listen<{ jobId: string }>("export-cancelled", (event) => {
      if (event.payload.jobId !== jobId) return;
      cleanup();
      clearTimeout(timeoutId);
      resolve({ ok: false, message: "Export cancelled" });
    });

    unlisteners.push(onComplete, onError, onCancelled);
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
    if (selectedProjectIds.length === 0 || isBatchExporting) return;

    setIsBatchExporting(true);
    setStopBatchRequested(false);
    stopBatchRequestedRef.current = false;
    setBatchHistory([]);
    setBatchStatus(`Preparing batch export (0/${selectedProjectIds.length})...`);

    let completed = 0;
    let failed = 0;

    for (let i = 0; i < selectedProjectIds.length; i++) {
      if (stopBatchRequestedRef.current) break;

      const projectId = selectedProjectIds[i];
      const projectName =
        projects.find((project) => project.id === projectId)?.name ?? `Project ${i + 1}`;
      setBatchStatus(`Exporting ${i + 1}/${selectedProjectIds.length}: ${projectName}`);
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
