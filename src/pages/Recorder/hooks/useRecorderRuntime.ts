import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRecordingStore } from "../../../stores";
import {
  CaptureSource,
  RecordingOptions as RecordingOptionsType,
  StartRecordingResult,
} from "../../../types/project";
import {
  loadRecordingPreferences,
  saveRecordingPreferences,
} from "../../../lib/recordingPreferencesStore";
import {
  consumeTrayQuickRecordRequest,
  requestTrayQuickRecord,
} from "../../../lib/trayQuickRecord";
import { toErrorMessage } from "../../../lib/errorMessage";
import { withTimeout } from "../../../lib/withTimeout";
import { useRecordingCountdown } from "./useRecordingCountdown";

interface DiskSpaceStatus {
  freeBytes: number;
  sufficient: boolean;
}

interface UseRecorderRuntimeOptions {
  onRecordingStoppedNavigate: (projectId: string) => void;
}

const START_RECORDING_TIMEOUT_MS = 15_000;

export function useRecorderRuntime({ onRecordingStoppedNavigate }: UseRecorderRuntimeOptions) {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diskWarning, setDiskWarning] = useState<string | null>(null);
  const [preferredSourceId, setPreferredSourceId] = useState<string | null>(null);
  const pendingTrayQuickRecordRef = useRef(false);
  const { countdown, startCountdown } = useRecordingCountdown();

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

  useEffect(() => {
    if (hasPermission) {
      void loadSources();
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
        void loadSources();
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

  useEffect(() => {
    const unlisten = listen<string>("recording-stopped", (event) => {
      setRecordingState("idle");
      setRecordingStartTimeMs(null);
      onRecordingStoppedNavigate(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [onRecordingStoppedNavigate, setRecordingState, setRecordingStartTimeMs]);

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
      const mockSources: CaptureSource[] =
        sourceType === "display"
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

      const result = await withTimeout(
        invoke<StartRecordingResult>("start_screen_recording", { options }),
        START_RECORDING_TIMEOUT_MS,
        "Recording start timed out"
      );

      setProjectId(result.projectId);
      setRecordingStartTimeMs(result.recordingStartTimeMs);
      startRecording(result.projectId);
      localStorage.setItem("currentProjectId", result.projectId);
      setErrorMessage(null);

      await invoke("open_recording_widget");
      const mainWindow = getCurrentWindow();
      await mainWindow.hide();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setProjectId(null);
      setRecordingStartTimeMs(null);
      setRecordingState("idle");
      localStorage.removeItem("currentProjectId");
      setErrorMessage(
        toErrorMessage(error, "Failed to start recording. Please try again.")
      );
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

  return {
    countdown,
    errorMessage,
    diskWarning,
    hasPermission,
    recordingState,
    isRecording,
    isActivelyRecording,
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
    cameraReady,
    setSourceType,
    setSelectedSource,
    setCaptureCamera,
    setCaptureMicrophone,
    setCaptureSystemAudio,
    setQualityPreset,
    setCodec,
    setCameraReady,
    requestPermission,
    handleStartRecording,
  };
}
