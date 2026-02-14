import { useEffect, useRef } from "react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Loader2, Pause, Play, Square } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRecordingStore, RecordingState } from "../../stores";
import { cn } from "@/lib/utils";

interface DiskSpaceStatus {
  freeBytes: number;
  minimumRequiredBytes: number;
  sufficient: boolean;
}

export function RecordingWidget() {
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

  // Get project ID from localStorage on mount (fallback for when store is reset)
  useEffect(() => {
    const storedProjectId = localStorage.getItem("currentProjectId");
    if (storedProjectId && !projectId) {
      setProjectId(storedProjectId);
    }
    // Set initial recording state if not already set
    if (state === "idle") {
      setRecordingState("recording");
    }
  }, [projectId, setProjectId, state, setRecordingState]);

  // Listen for recording state updates from backend
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

  // Timer for elapsed time
  useEffect(() => {
    if (state === "recording") {
      intervalRef.current = window.setInterval(() => {
        incrementElapsedTime();
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
  }, [state, incrementElapsedTime]);

  // Permission monitoring during active recording sessions
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

  // Disk space monitoring to auto-stop when free space is low
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
          await stopRecording();
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
    }
  }, [state]);

  // Auto-segment every 5 minutes to reduce data-loss risk
  useEffect(() => {
    if (state !== "recording" || !projectId || elapsedTime < 300) return;
    if (elapsedTime - lastAutoSegmentAtRef.current < 300) return;
    if (autoSegmentInFlightRef.current) return;

    autoSegmentInFlightRef.current = true;
    void (async () => {
      try {
        await invoke("pause_recording", { projectId });
        await invoke("resume_recording", { projectId });
        lastAutoSegmentAtRef.current = elapsedTime;
      } catch (error) {
        console.error("Auto-segmentation failed:", error);
      } finally {
        autoSegmentInFlightRef.current = false;
      }
    })();
  }, [state, projectId, elapsedTime]);

  // Global shortcuts while recording widget is active
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

  async function togglePause() {
    if (state === "stopping") return;
    try {
      if (state === "recording") {
        await invoke("pause_recording", { projectId });
        setRecordingState("paused");
      } else {
        await invoke("resume_recording", { projectId });
        setRecordingState("recording");
      }
    } catch (error) {
      console.error("Failed to toggle pause:", error);
      setPermissionError(String(error));
    }
  }

  async function stopRecording() {
    if (!projectId) return;
    
    const currentProjectId = projectId;
    console.log("[RecordingWidget] Stopping recording, projectId:", currentProjectId);
    
    try {
      beginRecordingStop();
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
      
      // Reset recording state in store
      resetRecording();
      setPermissionError(null);
    } catch (error) {
      console.error("[RecordingWidget] Failed to stop recording:", error);
      setRecordingState("paused");
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

  const isRecording = state === "recording";
  const isStopping = state === "stopping";
  const statusLabel = isStopping ? "Stopping" : isRecording ? "Live" : "Paused";

  return (
    <div
      className="studio-grain relative flex h-full cursor-move select-none items-center justify-center overflow-hidden rounded-xl bg-background"
      data-tauri-drag-region
    >
      {/* Atmospheric background - red glow when recording, amber when paused */}
      <div 
        className={cn(
          "pointer-events-none absolute inset-0 transition-all duration-500",
          isRecording
            ? "bg-[radial-gradient(ellipse_at_center,oklch(0.25_0.12_25)_0%,transparent_70%)] opacity-60"
            : "bg-[radial-gradient(ellipse_at_center,oklch(0.25_0.10_75)_0%,transparent_70%)] opacity-40"
        )}
      />
      
      {/* Main panel */}
      <div className="studio-panel relative z-10 flex items-center gap-3 rounded-lg px-3 py-2">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="relative flex size-3 items-center justify-center">
            <div
              className={cn(
                "size-2.5 rounded-full transition-all duration-300",
                isRecording
                  ? "animate-pulse bg-primary shadow-[0_0_8px_oklch(0.62_0.24_25/0.8)]"
                  : "bg-accent"
              )}
            />
            {/* Outer glow ring for recording state */}
            {isRecording && (
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
            )}
          </div>
        </div>

        {/* Timer display */}
        <div className="flex min-w-[65px] flex-col items-start">
          <span 
            className={cn(
              "font-mono text-base font-semibold tabular-nums tracking-wide transition-colors duration-300",
              isRecording ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {formatTime(elapsedTime)}
          </span>
          <span 
            className={cn(
              "text-[9px] font-semibold uppercase tracking-widest transition-colors duration-300",
              isRecording
                ? "text-primary" 
                : "text-accent"
            )}
          >
            {statusLabel}
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border/50" />

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Pause/Resume button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={togglePause}
                disabled={isStopping}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md transition-all duration-200",
                  isRecording
                    ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                    : "bg-accent/20 text-accent hover:bg-accent/30",
                  isStopping && "cursor-not-allowed opacity-40"
                )}
              >
                {isRecording ? (
                  <Pause className="size-4" strokeWidth={2} />
                ) : (
                  <Play className="size-4" strokeWidth={2} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {isRecording ? "Pause (⌘⇧P)" : "Resume (⌘⇧P)"}
            </TooltipContent>
          </Tooltip>
          
          {/* Stop button - prominent red styling */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={stopRecording}
                disabled={isStopping}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_0_12px_oklch(0.62_0.24_25/0.4)] transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_0_16px_oklch(0.62_0.24_25/0.6)] active:scale-95",
                  isStopping && "cursor-not-allowed opacity-70"
                )}
              >
                {isStopping ? (
                  <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
                ) : (
                  <Square className="size-3.5" strokeWidth={2.5} fill="currentColor" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              Stop Recording (⌘⇧2)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      {permissionError && (
        <div className="absolute -bottom-11 left-0 right-0 rounded-md border border-destructive/40 bg-background/95 px-2 py-1 text-[10px] text-destructive shadow-lg">
          {permissionError}
        </div>
      )}
    </div>
  );
}
