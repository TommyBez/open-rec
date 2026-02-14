import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Routes, Route, Navigate } from "react-router-dom";
import { RecorderPage } from "./pages/Recorder";
import { EditorPage } from "./pages/Editor";
import { RecordingWidget } from "./pages/RecordingWidget";
import { VideoSelectionPage } from "./pages/VideoSelection";

function App() {
  useEffect(() => {
    let cancelled = false;
    async function ensureNotificationPermission() {
      const granted = await isPermissionGranted();
      if (!granted && !cancelled) {
        await requestPermission();
      }
    }

    ensureNotificationPermission().catch(console.error);
    const unlistenCompletePromise = listen<string>("export-complete", (event) => {
      sendNotification({
        title: "Export complete",
        body: event.payload.split("/").pop() ?? "Your file is ready.",
      });
    });
    const unlistenErrorPromise = listen<string>("export-error", (event) => {
      sendNotification({
        title: "Export failed",
        body: event.payload,
      });
    });

    return () => {
      cancelled = true;
      unlistenCompletePromise.then((unlisten) => unlisten());
      unlistenErrorPromise.then((unlisten) => unlisten());
    };
  }, []);

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
