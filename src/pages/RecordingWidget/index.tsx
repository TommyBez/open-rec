import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <div
      className="flex h-full cursor-move select-none items-center justify-center rounded-xl bg-[#1e1e1e]/95 px-3 py-2 backdrop-blur-xl"
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3">
        {/* Recording indicator */}
        <div className="flex size-3 items-center justify-center">
          <div
            className={cn(
              "size-2.5 rounded-full",
              state === "recording"
                ? "animate-pulse bg-red-500"
                : "bg-amber-500"
            )}
          />
        </div>

        {/* Timer */}
        <div className="flex min-w-[60px] flex-col items-start">
          <span className="font-mono text-base font-semibold tracking-wide text-white">
            {formatTime(elapsedTime)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#888]">
            {state === "recording" ? "Recording" : "Paused"}
          </span>
        </div>

        {/* Controls */}
        <div className="ml-2 flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={togglePause}
                className="text-white hover:bg-white/20"
              >
                {state === "recording" ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {state === "recording" ? "Pause" : "Resume"}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon-sm"
                onClick={stopRecording}
              >
                <Square className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop Recording</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
