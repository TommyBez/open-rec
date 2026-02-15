import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { RecorderPage } from "./pages/Recorder";
import { EditorPage } from "./pages/Editor";
import { RecordingWidget } from "./pages/RecordingWidget";
import { VideoSelectionPage } from "./pages/VideoSelection";
import { useAppRuntimeEvents } from "./hooks/useAppRuntimeEvents";

function App() {
  const navigate = useNavigate();
  useAppRuntimeEvents(navigate);

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
