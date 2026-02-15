import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { NavigateFunction } from "react-router-dom";
import { requestTrayQuickRecord } from "../lib/trayQuickRecord";
import { useExportStore, useRuntimeDiagnosticsStore } from "../stores";

const EXPORT_JOB_SYNC_INTERVAL_MS = 30_000;

interface ExportCompleteEvent {
  jobId: string;
  outputPath: string;
}

interface ExportErrorEvent {
  jobId: string;
  message: string;
}

interface ExportLifecycleEvent {
  jobId: string;
  startedAtMs?: number;
}

interface RecordingStopFailedEvent {
  message: string;
}

function notifyUser(title: string, body: string) {
  Promise.resolve(sendNotification({ title, body })).catch((error: unknown) => {
    console.error("Failed to dispatch desktop notification:", error);
  });
}

export function useAppRuntimeEvents(navigate: NavigateFunction) {
  const isMainWindow = getCurrentWindow().label === "main";
  const { registerExportJob, unregisterExportJob, replaceActiveExportJobs } =
    useExportStore();
  const appendDiagnostic = useRuntimeDiagnosticsStore((state) => state.appendEntry);

  useEffect(() => {
    let cancelled = false;
    let syncInFlight = false;

    async function syncActiveExportJobs() {
      if (syncInFlight) {
        return;
      }
      syncInFlight = true;
      try {
        const activeJobIds = await invoke<string[]>("list_active_export_jobs");
        if (cancelled) return;
        replaceActiveExportJobs(activeJobIds);
      } catch (error) {
        console.error("Failed to sync active export jobs:", error);
      } finally {
        syncInFlight = false;
      }
    }

    async function ensureNotificationPermission() {
      if (!isMainWindow) return;
      const granted = await isPermissionGranted();
      if (!granted && !cancelled) {
        await requestPermission();
      }
    }

    ensureNotificationPermission().catch(console.error);
    syncActiveExportJobs().catch(console.error);
    const refreshActiveExports = () => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void syncActiveExportJobs();
    };
    window.addEventListener("focus", refreshActiveExports);
    window.addEventListener("visibilitychange", refreshActiveExports);
    const syncIntervalId = window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      void syncActiveExportJobs();
    }, EXPORT_JOB_SYNC_INTERVAL_MS);
    const unlistenCompletePromise = listen<ExportCompleteEvent>("export-complete", (event) => {
      unregisterExportJob(event.payload.jobId);
      appendDiagnostic({
        source: "export",
        level: "info",
        message: `Export completed (${event.payload.jobId}).`,
      });
      if (!isMainWindow) return;
      notifyUser(
        "Export complete",
        event.payload.outputPath.split("/").pop() ?? "Your file is ready."
      );
    });
    const unlistenErrorPromise = listen<ExportErrorEvent>("export-error", (event) => {
      unregisterExportJob(event.payload.jobId);
      appendDiagnostic({
        source: "export",
        level: "error",
        message: `Export failed (${event.payload.jobId}): ${event.payload.message}`,
      });
      if (!isMainWindow) return;
      notifyUser("Export failed", event.payload.message);
    });
    const unlistenStartedPromise = listen<ExportLifecycleEvent>("export-started", (event) => {
      registerExportJob(event.payload.jobId, event.payload.startedAtMs);
    });
    const unlistenCancelledPromise = listen<ExportLifecycleEvent>("export-cancelled", (event) => {
      unregisterExportJob(event.payload.jobId);
    });
    const unlistenStopFailedPromise = listen<RecordingStopFailedEvent>(
      "recording-stop-failed",
      (event) => {
        appendDiagnostic({
          source: "system",
          level: "error",
          message:
            event.payload.message ||
            "Recording stopped, but post-processing failed. Check your recordings list.",
        });
        if (!isMainWindow) return;
        notifyUser(
          "Recording finalization failed",
          event.payload.message ||
            "Recording stopped, but post-processing failed. Check your recordings list."
        );
      }
    );
    const unlistenTrayRecorderPromise = isMainWindow
      ? listen("tray-open-recorder", () => navigate("/recorder"))
      : Promise.resolve(() => undefined);
    const unlistenTrayProjectsPromise = isMainWindow
      ? listen("tray-open-projects", () => navigate("/videos"))
      : Promise.resolve(() => undefined);
    const unlistenTrayQuickRecordPromise = isMainWindow
      ? listen("tray-quick-record", () => {
          requestTrayQuickRecord();
          navigate("/recorder");
        })
      : Promise.resolve(() => undefined);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshActiveExports);
      window.removeEventListener("visibilitychange", refreshActiveExports);
      window.clearInterval(syncIntervalId);
      unlistenCompletePromise.then((unlisten) => unlisten());
      unlistenErrorPromise.then((unlisten) => unlisten());
      unlistenStartedPromise.then((unlisten) => unlisten());
      unlistenCancelledPromise.then((unlisten) => unlisten());
      unlistenStopFailedPromise.then((unlisten) => unlisten());
      unlistenTrayRecorderPromise.then((unlisten) => unlisten());
      unlistenTrayProjectsPromise.then((unlisten) => unlisten());
      unlistenTrayQuickRecordPromise.then((unlisten) => unlisten());
    };
  }, [
    isMainWindow,
    navigate,
    appendDiagnostic,
    registerExportJob,
    replaceActiveExportJobs,
    unregisterExportJob,
  ]);
}
