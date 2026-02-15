import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { RecorderPage } from "./pages/Recorder";
import { EditorPage } from "./pages/Editor";
import { RecordingWidget } from "./pages/RecordingWidget";
import { VideoSelectionPage } from "./pages/VideoSelection";
import { useExportStore } from "./stores";
import { requestTrayQuickRecord } from "./lib/trayQuickRecord";

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
}

interface RecordingStopFailedEvent {
  projectId: string;
  message: string;
}

function notifyUser(title: string, body: string) {
  try {
    sendNotification({ title, body });
  } catch (error) {
    console.error("Failed to dispatch desktop notification:", error);
  }
}

function App() {
  const navigate = useNavigate();
  const isMainWindow = getCurrentWindow().label === "main";
  const { registerExportJob, unregisterExportJob } = useExportStore();

  useEffect(() => {
    let cancelled = false;
    async function ensureNotificationPermission() {
      if (!isMainWindow) {
        return;
      }
      const granted = await isPermissionGranted();
      if (!granted && !cancelled) {
        await requestPermission();
      }
    }

    ensureNotificationPermission().catch(console.error);
    const unlistenCompletePromise = listen<ExportCompleteEvent>("export-complete", (event) => {
      unregisterExportJob(event.payload.jobId);
      if (!isMainWindow) {
        return;
      }
      notifyUser(
        "Export complete",
        event.payload.outputPath.split("/").pop() ?? "Your file is ready."
      );
    });
    const unlistenErrorPromise = listen<ExportErrorEvent>("export-error", (event) => {
      unregisterExportJob(event.payload.jobId);
      if (!isMainWindow) {
        return;
      }
      notifyUser("Export failed", event.payload.message);
    });
    const unlistenStartedPromise = listen<ExportLifecycleEvent>("export-started", (event) => {
      registerExportJob(event.payload.jobId);
    });
    const unlistenCancelledPromise = listen<ExportLifecycleEvent>("export-cancelled", (event) => {
      unregisterExportJob(event.payload.jobId);
    });
    const unlistenRecordingStopFailedPromise = listen<RecordingStopFailedEvent>(
      "recording-stop-failed",
      (event) => {
        if (!isMainWindow) {
          return;
        }
        notifyUser(
          "Recording finalization failed",
          event.payload.message ||
            "Recording stopped, but post-processing failed. Check your recordings list."
        );
      }
    );
    const unlistenTrayRecorderPromise = isMainWindow
      ? listen("tray-open-recorder", () => {
          navigate("/recorder");
        })
      : Promise.resolve(() => undefined);
    const unlistenTrayProjectsPromise = isMainWindow
      ? listen("tray-open-projects", () => {
          navigate("/videos");
        })
      : Promise.resolve(() => undefined);
    const unlistenTrayQuickRecordPromise = isMainWindow
      ? listen("tray-quick-record", () => {
          requestTrayQuickRecord();
          navigate("/recorder");
        })
      : Promise.resolve(() => undefined);

    return () => {
      cancelled = true;
      unlistenCompletePromise.then((unlisten) => unlisten());
      unlistenErrorPromise.then((unlisten) => unlisten());
      unlistenStartedPromise.then((unlisten) => unlisten());
      unlistenCancelledPromise.then((unlisten) => unlisten());
      unlistenRecordingStopFailedPromise.then((unlisten) => unlisten());
      unlistenTrayRecorderPromise.then((unlisten) => unlisten());
      unlistenTrayProjectsPromise.then((unlisten) => unlisten());
      unlistenTrayQuickRecordPromise.then((unlisten) => unlisten());
    };
  }, [isMainWindow, navigate, registerExportJob, unregisterExportJob]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recorder" replace />} />
      <Route path="/recorder" element={<RecorderPage />} />
      <Route path="/editor/:projectId" element={<EditorPage />} />
      <Route path="/recording-widget" element={<RecordingWidget />} />
      <Route path="/videos" element={<VideoSelectionPage />} />
    </Routes>
  );
}

export default App;
