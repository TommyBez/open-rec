import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Monitor, AppWindow } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SourceSelector } from "../../components/SourceSelector";
import { MicrophoneRecorder } from "../../components/MicrophoneRecorder";
import { CameraPreview } from "../../components/CameraPreview";
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
import { PermissionDeniedView, PermissionLoadingView } from "./components/PermissionViews";
import { RecorderHeader } from "./components/RecorderHeader";
import { RecorderInputSources } from "./components/RecorderInputSources";
import { RecorderQualityControls } from "./components/RecorderQualityControls";
import { CountdownOverlay } from "./components/CountdownOverlay";
import { useRecordingCountdown } from "./hooks/useRecordingCountdown";

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
  const pendingTrayQuickRecordRef = useRef(false);
  const { countdown, startCountdown } = useRecordingCountdown();
  
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

    startCountdown(startRecordingSession);
  }

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
      <RecorderHeader ready={!!selectedSource} onOpenVideos={() => navigate("/videos")} />

      <main className="relative z-10 flex flex-1 flex-col gap-4">
        {countdown !== null && <CountdownOverlay value={countdown} />}
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

        <RecorderInputSources
          captureCamera={captureCamera}
          cameraReady={cameraReady}
          captureMicrophone={captureMicrophone}
          captureSystemAudio={captureSystemAudio}
          onToggleCamera={() => setCaptureCamera(!captureCamera)}
          onToggleMicrophone={() => setCaptureMicrophone(!captureMicrophone)}
          onToggleSystemAudio={() => setCaptureSystemAudio(!captureSystemAudio)}
        />

        <RecorderQualityControls
          qualityPreset={qualityPreset}
          codec={codec}
          onQualityPresetChange={setQualityPreset}
          onCodecChange={setCodec}
        />

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
