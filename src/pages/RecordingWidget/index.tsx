import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./styles.css";

type RecordingState = "recording" | "paused";

export function RecordingWidget() {
  const [state, setState] = useState<RecordingState>("recording");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [projectId, setProjectId] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Get project ID from localStorage on mount
  useEffect(() => {
    const storedProjectId = localStorage.getItem("currentProjectId");
    if (storedProjectId) {
      setProjectId(storedProjectId);
    }
  }, []);

  // Listen for recording state updates from backend
  useEffect(() => {
    const unlistenState = listen<{ state: RecordingState; projectId: string }>(
      "recording-state-changed",
      (event) => {
        setState(event.payload.state);
        if (event.payload.projectId) {
          setProjectId(event.payload.projectId);
        }
      }
    );

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, []);

  // Timer for elapsed time
  useEffect(() => {
    if (state === "recording") {
      intervalRef.current = window.setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state]);

  async function togglePause() {
    try {
      if (state === "recording") {
        await invoke("pause_recording", { projectId });
        setState("paused");
      } else {
        await invoke("resume_recording", { projectId });
        setState("recording");
      }
    } catch (error) {
      console.error("Failed to toggle pause:", error);
    }
  }

  async function stopRecording() {
    if (!projectId) return;
    
    const currentProjectId = projectId;
    console.log("[RecordingWidget] Stopping recording, projectId:", currentProjectId);
    
    try {
      // Call backend to stop recording
      // The backend will:
      // 1. Stop the recording
      // 2. Show the main window
      // 3. Emit recording-stopped event (which main window listens for)
      // 4. Close this widget window
      await invoke("stop_screen_recording", { projectId: currentProjectId });
      console.log("[RecordingWidget] Recording stopped successfully");
      
      // Clear stored project ID
      localStorage.removeItem("currentProjectId");
    } catch (error) {
      console.error("[RecordingWidget] Failed to stop recording:", error);
    }
  }

  function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="recording-widget" data-tauri-drag-region>
      <div className="widget-content">
        {/* Recording indicator */}
        <div className={`recording-indicator ${state}`}>
          <div className="indicator-dot" />
        </div>

        {/* Timer */}
        <div className="timer">
          <span className="time">{formatTime(elapsedTime)}</span>
          <span className="state-label">
            {state === "recording" ? "Recording" : "Paused"}
          </span>
        </div>

        {/* Controls */}
        <div className="widget-controls">
          <button
            className="widget-btn pause-btn"
            onClick={togglePause}
            title={state === "recording" ? "Pause" : "Resume"}
          >
            {state === "recording" ? (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          
          <button
            className="widget-btn stop-btn"
            onClick={stopRecording}
            title="Stop Recording"
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
