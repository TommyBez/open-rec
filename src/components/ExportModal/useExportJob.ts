import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExportOptions as ExportOptionsType } from "../../types/project";

interface ExportStartResult {
  jobId: string;
  outputPath: string;
}

interface ExportProgressEvent {
  jobId: string;
  progressSeconds: number;
}

interface ExportCompleteEvent {
  jobId: string;
  outputPath: string;
}

interface ExportErrorEvent {
  jobId: string;
  message: string;
}

type ExportStatus = "idle" | "exporting" | "complete" | "error";

interface UseExportJobOptions {
  projectId: string;
  displayDuration: number;
  options: ExportOptionsType;
  onSaveProject?: () => Promise<void>;
}

export function useExportJob({
  projectId,
  displayDuration,
  options,
  onSaveProject,
}: UseExportJobOptions) {
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const cancelRequestedJobIdRef = useRef<string | null>(null);
  const cancelledJobIdsRef = useRef<Set<string>>(new Set());
  const pendingCancelRequestRef = useRef(false);
  const unlistenRefs = useRef<UnlistenFn[]>([]);

  const cleanupListeners = useCallback(() => {
    unlistenRefs.current.forEach((unlisten) => unlisten());
    unlistenRefs.current = [];
    jobIdRef.current = null;
  }, []);

  const resetState = useCallback(() => {
    setExportStatus("idle");
    setProgress(0);
    setCurrentTime(0);
    setError(null);
    setOutputPath(null);
    setJobId(null);
    jobIdRef.current = null;
    cancelRequestedJobIdRef.current = null;
    cancelledJobIdsRef.current.clear();
    pendingCancelRequestRef.current = false;
  }, []);

  const requestCancelForJob = useCallback(async (activeJobId: string) => {
    if (
      cancelRequestedJobIdRef.current === activeJobId ||
      cancelledJobIdsRef.current.has(activeJobId)
    ) {
      return;
    }
    cancelRequestedJobIdRef.current = activeJobId;
    cancelledJobIdsRef.current.add(activeJobId);
    pendingCancelRequestRef.current = false;
    await invoke("cancel_export", { jobId: activeJobId });
  }, []);

  useEffect(() => () => cleanupListeners(), [cleanupListeners]);

  const handleExport = useCallback(async () => {
    setExportStatus("exporting");
    setProgress(0);
    setCurrentTime(0);
    setError(null);
    setOutputPath(null);
    setJobId(null);
    jobIdRef.current = null;
    cancelRequestedJobIdRef.current = null;
    cancelledJobIdsRef.current.clear();
    pendingCancelRequestRef.current = false;
    cleanupListeners();

    try {
      if (onSaveProject) await onSaveProject();

      const unlistenProgress = await listen<ExportProgressEvent>("export-progress", (event) => {
        if (!jobIdRef.current || event.payload.jobId !== jobIdRef.current) return;
        const currentTimeSeconds = event.payload.progressSeconds;
        const percent = Math.min((currentTimeSeconds / displayDuration) * 100, 99);
        setCurrentTime(currentTimeSeconds);
        setProgress(percent);
      });
      unlistenRefs.current.push(unlistenProgress);

      const unlistenComplete = await listen<ExportCompleteEvent>("export-complete", (event) => {
        if (
          cancelRequestedJobIdRef.current === event.payload.jobId ||
          cancelledJobIdsRef.current.has(event.payload.jobId)
        ) {
          return;
        }
        if (!jobIdRef.current || event.payload.jobId !== jobIdRef.current) return;
        setProgress(100);
        setExportStatus("complete");
        setOutputPath(event.payload.outputPath);
        setJobId(null);
        jobIdRef.current = null;
      });
      unlistenRefs.current.push(unlistenComplete);

      const unlistenError = await listen<ExportErrorEvent>("export-error", (event) => {
        if (
          cancelRequestedJobIdRef.current === event.payload.jobId ||
          cancelledJobIdsRef.current.has(event.payload.jobId)
        ) {
          return;
        }
        if (!jobIdRef.current || event.payload.jobId !== jobIdRef.current) return;
        setExportStatus("error");
        setError(event.payload.message);
        setJobId(null);
        jobIdRef.current = null;
      });
      unlistenRefs.current.push(unlistenError);

      const unlistenCancelled = await listen<{ jobId: string }>("export-cancelled", (event) => {
        if (!jobIdRef.current || event.payload.jobId !== jobIdRef.current) return;
        cancelledJobIdsRef.current.add(event.payload.jobId);
        setExportStatus("idle");
        setProgress(0);
        setCurrentTime(0);
        setError("Export cancelled");
        setJobId(null);
        jobIdRef.current = null;
        cancelRequestedJobIdRef.current = null;
      });
      unlistenRefs.current.push(unlistenCancelled);

      const result = await invoke<ExportStartResult>("export_project", {
        projectId,
        options: {
          format: options.format,
          frameRate: options.frameRate,
          compression: options.compression,
          resolution: options.resolution,
        },
      });
      setJobId(result.jobId);
      jobIdRef.current = result.jobId;
      if (pendingCancelRequestRef.current) {
        try {
          await requestCancelForJob(result.jobId);
        } catch (error) {
          setExportStatus("error");
          setError(error instanceof Error ? error.message : "Failed to cancel export");
          setJobId(null);
          jobIdRef.current = null;
        }
      }
    } catch (err) {
      setExportStatus("error");
      setError(err instanceof Error ? err.message : "Export failed");
      setJobId(null);
      jobIdRef.current = null;
      cancelRequestedJobIdRef.current = null;
      pendingCancelRequestRef.current = false;
    }
  }, [cleanupListeners, displayDuration, onSaveProject, options, projectId, requestCancelForJob]);

  const handleCancelExport = useCallback(async () => {
    const activeJobId = jobIdRef.current ?? jobId;
    if (!activeJobId) {
      pendingCancelRequestRef.current = true;
      return;
    }
    try {
      await requestCancelForJob(activeJobId);
    } catch (err) {
      setExportStatus("error");
      setError(err instanceof Error ? err.message : "Failed to cancel export");
    }
  }, [jobId, requestCancelForJob]);

  return {
    exportStatus,
    progress,
    currentTime,
    error,
    outputPath,
    jobId,
    resetState,
    cleanupListeners,
    handleExport,
    handleCancelExport,
  };
}
