import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useRecordingStore, RecordingState } from "../../../stores";
import { withTimeout } from "../../../lib/withTimeout";

interface DiskSpaceStatus {
  sufficient: boolean;
}

const STOP_RECORDING_TIMEOUT_MS = 30_000;
const PAUSE_RESUME_TIMEOUT_MS = 10_000;

export function useRecordingWidgetRuntime() {
  const {
    state,
    elapsedTime,
    projectId,
    setRecordingState,
    incrementElapsedTime,
    setProjectId,
    beginRecordingStop,
    resetRecording,
  } = useRecordingStore();

  const intervalRef = useRef<number | null>(null);
  const autoStopForDiskRef = useRef(false);
  const lastAutoSegmentAtRef = useRef(0);
  const autoSegmentInFlightRef = useRef(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const storedProjectId = localStorage.getItem("currentProjectId");
    const effectiveProjectId = projectId ?? storedProjectId;
    if (storedProjectId && !projectId) {
      setProjectId(storedProjectId);
    }
    if (state === "idle" && effectiveProjectId) {
      setRecordingState("recording");
    }
  }, [projectId, setProjectId, state, setRecordingState]);

  useEffect(() => {
    const unlistenState = listen<{ state: RecordingState; projectId: string }>(
      "recording-state-changed",
      (event) => {
        setRecordingState(event.payload.state);
        if (event.payload.projectId) {
          setProjectId(event.payload.projectId);
        }
      }
    );

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, [setRecordingState, setProjectId]);

  useEffect(() => {
    if (state === "recording") {
      intervalRef.current = window.setInterval(() => {
        incrementElapsedTime();
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state, incrementElapsedTime]);

  useEffect(() => {
    if (state === "idle") return;
    const intervalId = window.setInterval(async () => {
      try {
        const stillGranted = await invoke<boolean>("check_permission");
        if (!stillGranted) {
          setPermissionError(
            "Screen recording permission was revoked. Stop recording and re-enable permission in System Settings."
          );
        } else {
          setPermissionError((current) =>
            current?.includes("permission was revoked") ? null : current
          );
        }
      } catch (error) {
        console.error("Failed to check recording permission:", error);
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [state]);

  async function stopRecording() {
    if (!projectId) return;
    const currentProjectId = projectId;
    const fallbackState = state === "paused" ? "paused" : "recording";
    try {
      beginRecordingStop();
      await withTimeout(
        invoke("stop_screen_recording", { projectId: currentProjectId }),
        STOP_RECORDING_TIMEOUT_MS,
        "Stopping recording timed out."
      );
      localStorage.removeItem("currentProjectId");
      resetRecording();
      setPermissionError(null);
      return true;
    } catch (error) {
      console.error("[RecordingWidget] Failed to stop recording:", error);
      setRecordingState(fallbackState);
      setPermissionError(String(error));
      return false;
    }
  }

  useEffect(() => {
    if (state !== "recording" && state !== "paused") return;
    const intervalId = window.setInterval(async () => {
      try {
        const diskStatus = await invoke<DiskSpaceStatus>("check_recording_disk_space");
        if (!diskStatus.sufficient && projectId && !autoStopForDiskRef.current) {
          autoStopForDiskRef.current = true;
          setPermissionError(
            "Recording stopped automatically because free disk space dropped below 5 GB."
          );
          const didStop = await stopRecording();
          if (!didStop) {
            autoStopForDiskRef.current = false;
          }
        }
      } catch (error) {
        console.error("Failed to check recording disk space:", error);
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [state, projectId]);

  useEffect(() => {
    if (state === "idle") {
      autoStopForDiskRef.current = false;
      lastAutoSegmentAtRef.current = 0;
      autoSegmentInFlightRef.current = false;
    }
  }, [state]);

  useEffect(() => {
    if (state !== "recording" || !projectId || elapsedTime < 300) return;
    if (elapsedTime - lastAutoSegmentAtRef.current < 300) return;
    if (autoSegmentInFlightRef.current) return;

    autoSegmentInFlightRef.current = true;
    void (async () => {
      try {
        await withTimeout(
          invoke("pause_recording", { projectId }),
          PAUSE_RESUME_TIMEOUT_MS,
          "Pause operation timed out during auto-segmentation."
        );
        await withTimeout(
          invoke("resume_recording", { projectId }),
          PAUSE_RESUME_TIMEOUT_MS,
          "Resume operation timed out during auto-segmentation."
        );
        lastAutoSegmentAtRef.current = elapsedTime;
      } catch (error) {
        console.error("Auto-segmentation failed:", error);
        setPermissionError(String(error));
      } finally {
        autoSegmentInFlightRef.current = false;
      }
    })();
  }, [state, projectId, elapsedTime]);

  async function togglePause() {
    if (state === "stopping") return;
    try {
      if (state === "recording") {
        await withTimeout(
          invoke("pause_recording", { projectId }),
          PAUSE_RESUME_TIMEOUT_MS,
          "Pausing recording timed out."
        );
        setRecordingState("paused");
      } else {
        await withTimeout(
          invoke("resume_recording", { projectId }),
          PAUSE_RESUME_TIMEOUT_MS,
          "Resuming recording timed out."
        );
        setRecordingState("recording");
      }
    } catch (error) {
      console.error("Failed to toggle pause:", error);
      setPermissionError(String(error));
    }
  }

  useEffect(() => {
    const unlistenStartStop = listen("global-shortcut-start-stop", () => {
      if (projectId && (state === "recording" || state === "paused")) {
        void stopRecording();
      }
    });
    const unlistenTogglePause = listen("global-shortcut-toggle-pause", () => {
      if (projectId && (state === "recording" || state === "paused")) {
        void togglePause();
      }
    });

    return () => {
      unlistenStartStop.then((fn) => fn());
      unlistenTogglePause.then((fn) => fn());
    };
  }, [projectId, state]);

  const isRecording = state === "recording";
  const isStopping = state === "stopping";
  const statusLabel = isStopping ? "Stopping" : isRecording ? "Live" : "Paused";

  return {
    elapsedTime,
    permissionError,
    isRecording,
    isStopping,
    statusLabel,
    togglePause,
    stopRecording,
  };
}
