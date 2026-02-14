import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Monitor, AppWindow, FolderOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SourceSelector } from "../../components/SourceSelector";
import { ToggleRow } from "../../components/ToggleRow";
import { MicrophoneRecorder } from "../../components/MicrophoneRecorder";
import { CameraPreview } from "../../components/CameraPreview";
import { BrandLogo } from "../../components/BrandLogo";
import { StatusIndicator } from "../../components/StatusIndicator";
import { SourceTypeButton } from "../../components/SourceTypeButton";
import { RecordButton } from "../../components/RecordButton";
import { useRecordingStore } from "../../stores";
import {
  CaptureSource,
  RecordingOptions as RecordingOptionsType,
  StartRecordingResult,
} from "../../types/project";
import {
  loadRecordingPreferences,
  saveRecordingPreferences,
} from "../../lib/recordingPreferencesStore";
import {
  consumeTrayQuickRecordRequest,
  requestTrayQuickRecord,
} from "../../lib/trayQuickRecord";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PermissionDeniedView, PermissionLoadingView } from "./components/PermissionViews";

interface DiskSpaceStatus {
  freeBytes: number;
  minimumRequiredBytes: number;
  sufficient: boolean;
}

export function RecorderPage() {
  const navigate = useNavigate();
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diskWarning, setDiskWarning] = useState<string | null>(null);
  const [preferredSourceId, setPreferredSourceId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const pendingTrayQuickRecordRef = useRef(false);
  
  // Use zustand store for state management
  const {
    state: recordingState,
    projectId,
    recordingStartTimeMs,
    sourceType,
    selectedSource,
    sources,
    isLoadingSources,
    captureCamera,
    captureMicrophone,
    captureSystemAudio,
    qualityPreset,
    codec,
    hasPermission,
    cameraReady,
    setSourceType,
    setSelectedSource,
    setSources,
    setIsLoadingSources,
    setCaptureCamera,
    setCaptureMicrophone,
    setCaptureSystemAudio,
    setQualityPreset,
    setCodec,
    setHasPermission,
    setCameraReady,
    beginRecordingStart,
    startRecording,
    setProjectId,
    setRecordingStartTimeMs,
    setRecordingState,
  } = useRecordingStore();

  const isRecording = ["starting", "recording", "paused"].includes(recordingState);
  const isActivelyRecording = recordingState === "recording";

  // Resize window to compact size on mount
  useEffect(() => {
    async function resizeWindow() {
      try {
        const window = getCurrentWindow();
        await window.setSize(new LogicalSize(380, 580));
        await window.center();
      } catch (error) {
        console.error("Failed to resize window:", error);
      }
    }
    resizeWindow();
  }, []);

  // Check permission on mount
  useEffect(() => {
    checkPermission();
    void checkDiskSpace();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void checkDiskSpace();
    }, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // Hydrate persisted recording preferences from plugin store
  useEffect(() => {
    let cancelled = false;

    async function hydratePreferences() {
      const persisted = await loadRecordingPreferences();
      if (!persisted || cancelled) {
        setPreferencesLoaded(true);
        return;
      }

      setSourceType(persisted.sourceType);
      setPreferredSourceId(persisted.selectedSourceId ?? null);
      setCaptureCamera(persisted.captureCamera);
      setCaptureMicrophone(persisted.captureMicrophone);
      setCaptureSystemAudio(persisted.captureSystemAudio);
      setQualityPreset(persisted.qualityPreset ?? "1080p30");
      setCodec(persisted.codec ?? "h264");
      setPreferencesLoaded(true);
    }

    hydratePreferences();
    return () => {
      cancelled = true;
    };
  }, [
    setCaptureCamera,
    setCaptureMicrophone,
    setCaptureSystemAudio,
    setSourceType,
    setQualityPreset,
    setCodec,
  ]);

  // Persist preferences to plugin store
  useEffect(() => {
    if (!preferencesLoaded) return;
    void saveRecordingPreferences({
      sourceType,
      selectedSourceId: selectedSource?.id ?? null,
      captureCamera,
      captureMicrophone,
      captureSystemAudio,
      qualityPreset,
      codec,
    });
  }, [
    preferencesLoaded,
    sourceType,
    selectedSource,
    captureCamera,
    captureMicrophone,
    captureSystemAudio,
    qualityPreset,
    codec,
  ]);

  // Load capture sources when permission/source type/preferred source change
  useEffect(() => {
    if (hasPermission) {
      loadSources();
    }
  }, [sourceType, hasPermission, preferredSourceId]);

  async function checkPermission() {
    try {
      const granted = await invoke<boolean>("check_permission");
      setHasPermission(granted);
    } catch (error) {
      console.error("Failed to check permission:", error);
      setHasPermission(false);
      setErrorMessage("Unable to check screen recording permission.");
    }
  }

  async function requestPermission() {
    try {
      const granted = await invoke<boolean>("request_permission");
      setHasPermission(granted);
      if (granted) {
        loadSources();
      }
    } catch (error) {
      console.error("Failed to request permission:", error);
      setErrorMessage("Unable to request screen recording permission.");
    }
  }

  async function checkDiskSpace() {
    try {
      const status = await invoke<DiskSpaceStatus>("check_recording_disk_space");
      if (!status.sufficient) {
        setDiskWarning(
          `Low disk space: ${(status.freeBytes / (1024 ** 3)).toFixed(2)} GB available. Recording requires at least 5 GB free.`
        );
      } else {
        setDiskWarning(null);
      }
    } catch (error) {
      console.error("Failed to check disk space:", error);
    }
  }

  // Listen for recording stopped event to navigate to editor
  useEffect(() => {
    const unlisten = listen<string>("recording-stopped", (event) => {
      setRecordingState("idle");
      setRecordingStartTimeMs(null);
      // Navigate to editor with the project ID
      navigate(`/editor/${event.payload}`);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [navigate, setRecordingState]);

  // Start recording using global shortcut when app is idle
  useEffect(() => {
    const unlisten = listen("global-shortcut-start-stop", () => {
      if (recordingState === "idle" && selectedSource && countdown === null) {
        void handleStartRecording();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [recordingState, selectedSource, countdown]);

  useEffect(() => {
    const unlisten = listen("tray-quick-record", () => {
      requestTrayQuickRecord();
      pendingTrayQuickRecordRef.current = true;
      setErrorMessage(null);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (consumeTrayQuickRecordRequest()) {
      pendingTrayQuickRecordRef.current = true;
      setErrorMessage(null);
    }
  }, []);

  useEffect(() => {
    if (!pendingTrayQuickRecordRef.current) return;
    if (recordingState !== "idle" || countdown !== null) return;
    if (hasPermission === false) {
      pendingTrayQuickRecordRef.current = false;
      setErrorMessage("Cannot quick-record because screen recording permission is not granted.");
      return;
    }
    if (hasPermission === null || isLoadingSources || !selectedSource) return;
    pendingTrayQuickRecordRef.current = false;
    void handleStartRecording();
  }, [countdown, hasPermission, isLoadingSources, recordingState, selectedSource]);

  async function loadSources() {
    setIsLoadingSources(true);
    try {
      const result = await invoke<CaptureSource[]>("list_capture_sources", {
        sourceType,
      });
      setSources(result);
      const stillAvailable = selectedSource
        ? result.find((source) => source.id === selectedSource.id)
        : undefined;
      const preferredSource = preferredSourceId
        ? result.find((source) => source.id === preferredSourceId)
        : undefined;
      if (stillAvailable) {
        setSelectedSource(stillAvailable);
      } else if (preferredSource) {
        setSelectedSource(preferredSource);
      } else if (result.length > 0) {
        setSelectedSource(result[0]);
      } else {
        setSelectedSource(null);
      }
    } catch (error) {
      console.error("Failed to load capture sources:", error);
      setErrorMessage("Could not load capture sources. Check permissions and retry.");
      // For development, use mock data
      const mockSources: CaptureSource[] = sourceType === "display" 
        ? [{ id: "main", name: "Built-in Display", type: "display" }]
        : [
            { id: "1", name: "Cursor", type: "window" },
            { id: "2", name: "Safari", type: "window" },
            { id: "3", name: "Finder", type: "window" },
          ];
      setSources(mockSources);
      if (mockSources.length > 0 && !selectedSource) {
        const preferredMock = preferredSourceId
          ? mockSources.find((source) => source.id === preferredSourceId)
          : undefined;
        setSelectedSource(preferredMock ?? mockSources[0]);
      }
    } finally {
      setIsLoadingSources(false);
    }
  }

  async function startRecordingSession() {
    if (!selectedSource) return;

    beginRecordingStart();
    try {
      const options: RecordingOptionsType = {
        sourceId: selectedSource.id,
        sourceType: selectedSource.type,
        captureCamera,
        captureMicrophone,
        captureSystemAudio,
        qualityPreset,
        codec,
      };
      
      const result = await Promise.race([
        invoke<StartRecordingResult>("start_screen_recording", { options }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Recording start timed out")), 15000)
        ),
      ]);
      
      // Store project ID for camera recording and in localStorage for widget
      setProjectId(result.projectId);
      setRecordingStartTimeMs(result.recordingStartTimeMs);
      startRecording(result.projectId);
      localStorage.setItem("currentProjectId", result.projectId);
      setErrorMessage(null);
      
      // Open the recording widget window
      await invoke("open_recording_widget");
      
      // Hide the main window while recording
      const mainWindow = getCurrentWindow();
      await mainWindow.hide();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setProjectId(null);
      setRecordingStartTimeMs(null);
      setRecordingState("idle");
      setErrorMessage(String(error));
    }
  }

  async function handleStartRecording() {
    if (countdown !== null || !selectedSource) return;
    try {
      const status = await invoke<DiskSpaceStatus>("check_recording_disk_space");
      if (!status.sufficient) {
        setErrorMessage(
          `Insufficient disk space. ${(status.freeBytes / (1024 ** 3)).toFixed(2)} GB available, 5 GB required.`
        );
        return;
      }
    } catch (error) {
      console.error("Failed to check disk space before recording:", error);
    }

    setCountdown(3);
    let value = 3;
    countdownIntervalRef.current = window.setInterval(async () => {
      value -= 1;
      if (value <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        setCountdown(null);
        await startRecordingSession();
      } else {
        setCountdown(value);
      }
    }, 1000);
  }

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    function handleCancelCountdown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setCountdown(null);
    }
    window.addEventListener("keydown", handleCancelCountdown);
    return () => window.removeEventListener("keydown", handleCancelCountdown);
  }, [countdown]);

  // Show permission request UI if permission not granted
  if (hasPermission === false) {
    return <PermissionDeniedView onRequestPermission={requestPermission} />;
  }

  // Show loading state while checking permission
  if (hasPermission === null) {
    return <PermissionLoadingView />;
  }

  return (
    <div className="studio-grain relative flex h-full flex-col overflow-hidden bg-background p-5">
      {/* Atmospheric background - subtle red glow at top when ready to record */}
      <div 
        className={cn(
          "pointer-events-none absolute inset-0 transition-opacity duration-700",
          selectedSource 
            ? "bg-[radial-gradient(ellipse_at_top,oklch(0.25_0.08_25)_0%,transparent_60%)] opacity-50"
            : "bg-[radial-gradient(ellipse_at_top,oklch(0.20_0.02_285)_0%,transparent_50%)] opacity-40"
        )}
      />
      
      {/* Header */}
      <header className="relative z-10 mb-6 flex items-center justify-between animate-fade-up">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate("/videos")}
                className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="My Recordings"
              >
                <FolderOpen className="size-5" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent>My Recordings</TooltipContent>
          </Tooltip>
          <StatusIndicator ready={!!selectedSource} />
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col gap-4">
        {countdown !== null && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/40 backdrop-blur-sm">
            <span className="text-7xl font-semibold tracking-tight text-white drop-shadow-lg">
              {countdown}
            </span>
            <span className="text-xs text-white/80">Press Esc to cancel</span>
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {errorMessage}
          </div>
        )}
        {diskWarning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
            {diskWarning}
          </div>
        )}
        {/* Source Selector Panel */}
        <div className="studio-panel animate-fade-up-delay-1 rounded-xl p-1">
          <div className="flex gap-1">
            <SourceTypeButton
              active={sourceType === "display"}
              onClick={() => setSourceType("display")}
              icon={<Monitor className="size-4" />}
              label="Screen"
            />
            <SourceTypeButton
              active={sourceType === "window"}
              onClick={() => setSourceType("window")}
              icon={<AppWindow className="size-4" />}
              label="Window"
            />
          </div>
        </div>

        {/* Source Dropdown */}
        <div className="animate-fade-up-delay-2">
          <SourceSelector
            sources={sources}
            selectedSource={selectedSource}
            onSelect={setSelectedSource}
            isLoading={isLoadingSources}
          />
        </div>

        {/* Camera Preview */}
        <AnimatePresence>
          {captureCamera && (
            <motion.div
              className="my-1 flex justify-center"
              initial={{ opacity: 0, scale: 0.8, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
              }}
            >
              <CameraPreview
                enabled={captureCamera}
                isRecording={isActivelyRecording}
                projectId={projectId}
                recordingStartTimeMs={recordingStartTimeMs}
                onCameraReady={setCameraReady}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        <MicrophoneRecorder
          enabled={captureMicrophone}
          isRecording={isActivelyRecording}
          projectId={projectId}
          recordingStartTimeMs={recordingStartTimeMs}
        />

        {/* Input Sources */}
        <div className="animate-fade-up-delay-3 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
            Input Sources
          </span>
          <div className="flex flex-col gap-1.5">
            <ToggleRow
              icon="camera"
              label="Camera"
              sublabel={captureCamera ? (cameraReady ? "Ready" : "Loading...") : "Off"}
              enabled={captureCamera}
              onToggle={() => setCaptureCamera(!captureCamera)}
            />
            <ToggleRow
              icon="microphone"
              label="Microphone"
              sublabel={captureMicrophone ? "Ready" : "Off"}
              enabled={captureMicrophone}
              onToggle={() => setCaptureMicrophone(!captureMicrophone)}
            />
            <ToggleRow
              icon="speaker"
              label="System Audio"
              sublabel={captureSystemAudio ? "Ready" : "Off"}
              enabled={captureSystemAudio}
              onToggle={() => setCaptureSystemAudio(!captureSystemAudio)}
            />
          </div>
        </div>

        <div className="animate-fade-up-delay-3 space-y-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
            Recording Quality
          </span>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={qualityPreset}
              onChange={(event) =>
                setQualityPreset(
                  event.target.value as "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60"
                )
              }
              className="rounded-lg border border-border/60 bg-card/60 px-2 py-2 text-xs text-foreground/80 outline-none focus:border-primary/50"
            >
              <option value="720p30">720p @ 30 FPS</option>
              <option value="1080p30">1080p @ 30 FPS</option>
              <option value="1080p60">1080p @ 60 FPS</option>
              <option value="4k30">4K @ 30 FPS</option>
              <option value="4k60">4K @ 60 FPS</option>
            </select>
            <select
              value={codec}
              onChange={(event) => setCodec(event.target.value as "h264" | "hevc")}
              className="rounded-lg border border-border/60 bg-card/60 px-2 py-2 text-xs text-foreground/80 outline-none focus:border-primary/50"
            >
              <option value="h264">Codec: H.264</option>
              <option value="hevc">Codec: HEVC</option>
            </select>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Record Button */}
        <div className="animate-fade-up-delay-4">
          <RecordButton
            onClick={handleStartRecording}
            disabled={!selectedSource || isRecording}
          />
        </div>
      </main>
    </div>
  );
}
