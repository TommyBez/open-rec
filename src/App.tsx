import { Routes, Route, Navigate } from "react-router-dom";
import { RecorderPage } from "./pages/Recorder";
import { EditorPage } from "./pages/Editor";
import { RecordingWidget } from "./pages/RecordingWidget";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/recorder" replace />} />
      <Route path="/recorder" element={<RecorderPage />} />
      <Route path="/editor/:projectId" element={<EditorPage />} />
      <Route path="/recording-widget" element={<RecordingWidget />} />
    </Routes>
  );
}

export default App;
