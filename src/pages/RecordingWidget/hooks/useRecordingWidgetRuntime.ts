import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useRecordingStore, RecordingState } from "../../../stores";
import { BackendRecordingState, DiskSpaceStatus } from "../../../types/project";
import {
  clearStoredCurrentProjectId,
  getStoredCurrentProjectId,
  setStoredCurrentProjectId,
} from "../../../lib/currentProjectStorage";
import { toErrorMessage } from "../../../lib/errorMessage";
import { withTimeout } from "../../../lib/withTimeout";

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
    let cancelled = false;

    async function hydrateRecordingSession() {
      const storedProjectId = getStoredCurrentProjectId();
      const effectiveProjectId = projectId ?? storedProjectId;
      if (!effectiveProjectId) return;

      if (storedProjectId && !projectId) {
        setProjectId(storedProjectId);
      }

      if (state !== "idle") return;

      try {
        const backendState = await invoke<BackendRecordingState | null>("get_recording_state", {
          projectId: effectiveProjectId,
        });
        if (cancelled) return;

        if (backendState === "recording" || backendState === "paused") {
          setRecordingState(backendState);
          return;
        }

        clearStoredCurrentProjectId();
        setProjectId(null);
      } catch (error) {
        console.error("Failed to hydrate recording session state:", error);
      }
    }

    void hydrateRecordingSession();

    return () => {
      cancelled = true;
    };
  }, [projectId, setProjectId, state, setRecordingState]);

  useEffect(() => {
    const hasPersistedSession = Boolean(projectId ?? getStoredCurrentProjectId());
    if (!hasPersistedSession && state !== "idle") {
      resetRecording();
      setPermissionError(null);
    }
  }, [projectId, resetRecording, state]);

  useEffect(() => {
    const unlistenState = listen<{ state: RecordingState; projectId: string }>(
      "recording-state-changed",
      (event) => {
        setRecordingState(event.payload.state);
        if (event.payload.state === "idle") {
          clearStoredCurrentProjectId();
          setProjectId(null);
          return;
        }
        if (event.payload.projectId) {
          setStoredCurrentProjectId(event.payload.projectId);
          setProjectId(event.payload.projectId);
        }
      }
    );

    return () => {
      unlistenState.then((fn) => fn());
    };
  }, [setRecordingState, setProjectId]);

  useEffect(() => {
    const unlistenFinalizing = listen<{ projectId: string }>(
      "recording-finalizing",
      (event) => {
        const activeProjectId = projectId ?? getStoredCurrentProjectId();
        if (!activeProjectId || event.payload.projectId !== activeProjectId) return;
        setRecordingState("stopping");
      }
    );
    const unlistenStopped = listen<string>("recording-stopped", (stoppedProjectId) => {
      const activeProjectId = projectId ?? getStoredCurrentProjectId();
      if (!activeProjectId || stoppedProjectId.payload !== activeProjectId) return;
      clearStoredCurrentProjectId();
      resetRecording();
      setPermissionError(null);
    });

    return () => {
      unlistenFinalizing.then((fn) => fn());
      unlistenStopped.then((fn) => fn());
    };
  }, [projectId, resetRecording, setRecordingState]);

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
            current?.includes("permission was revoked") ||
            current?.includes("Unable to verify screen recording permission")
              ? null
              : current
          );
        }
      } catch (error) {
        console.error("Failed to check recording permission:", error);
        setPermissionError((current) =>
          current ??
          "Unable to verify screen recording permission. Check System Settings if controls become unresponsive."
        );
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [state]);

  async function stopRecording() {
    const currentProjectId = projectId ?? getStoredCurrentProjectId();
    if (!currentProjectId) {
      setPermissionError("No active recording session was found.");
      resetRecording();
      return false;
    }
    const fallbackState = state === "paused" ? "paused" : "recording";
    try {
      beginRecordingStop();
      await withTimeout(
        invoke("stop_screen_recording", { projectId: currentProjectId }),
        STOP_RECORDING_TIMEOUT_MS,
        "Stopping recording timed out."
      );
      clearStoredCurrentProjectId();
      resetRecording();
      setPermissionError(null);
      return true;
    } catch (error) {
      console.error("[RecordingWidget] Failed to stop recording:", error);
      setRecordingState(fallbackState);
      setPermissionError(toErrorMessage(error, "Failed to stop recording."));
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
        setPermissionError(
          toErrorMessage(error, "Auto-segmentation failed.")
        );
      } finally {
        autoSegmentInFlightRef.current = false;
      }
    })();
  }, [state, projectId, elapsedTime]);

  async function togglePause() {
    if (state === "stopping") return;
    const currentProjectId = projectId ?? getStoredCurrentProjectId();
    if (!currentProjectId) {
      setPermissionError("No active recording session was found.");
      return;
    }
    try {
      if (state === "recording") {
        await withTimeout(
          invoke("pause_recording", { projectId: currentProjectId }),
          PAUSE_RESUME_TIMEOUT_MS,
          "Pausing recording timed out."
        );
        setRecordingState("paused");
      } else {
        await withTimeout(
          invoke("resume_recording", { projectId: currentProjectId }),
          PAUSE_RESUME_TIMEOUT_MS,
          "Resuming recording timed out."
        );
        setRecordingState("recording");
      }
    } catch (error) {
      console.error("Failed to toggle pause:", error);
      setPermissionError(
        toErrorMessage(error, "Failed to pause/resume recording.")
      );
    }
  }

  useEffect(() => {
    const unlistenStartStop = listen("global-shortcut-start-stop", () => {
      const hasActiveProject = Boolean(projectId ?? getStoredCurrentProjectId());
      if (hasActiveProject && (state === "recording" || state === "paused")) {
        void stopRecording();
      }
    });
    const unlistenTogglePause = listen("global-shortcut-toggle-pause", () => {
      const hasActiveProject = Boolean(projectId ?? getStoredCurrentProjectId());
      if (hasActiveProject && (state === "recording" || state === "paused")) {
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
