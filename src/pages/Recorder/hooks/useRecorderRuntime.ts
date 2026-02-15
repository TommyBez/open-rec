import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRecordingStore } from "../../../stores";
import {
  DiskSpaceStatus,
  CaptureSource,
  RecordingOptions as RecordingOptionsType,
  StartRecordingResult,
} from "../../../types/project";
import {
  loadRecordingPreferences,
  saveRecordingPreferences,
} from "../../../lib/recordingPreferencesStore";
import {
  clearPendingRecordingSourceFallbackNotice,
  setPendingRecordingSourceFallbackNotice,
} from "../../../lib/recordingSourceFallbackNotice";
import {
  consumeTrayQuickRecordRequest,
  requestTrayQuickRecord,
} from "../../../lib/trayQuickRecord";
import {
  clearStoredCurrentProjectId,
  setStoredCurrentProjectId,
} from "../../../lib/currentProjectStorage";
import { formatBytesAsGiB, resolveMinimumFreeBytes } from "../../../lib/diskSpace";
import { toErrorMessage } from "../../../lib/errorMessage";
import { withTimeout } from "../../../lib/withTimeout";
import { useRecordingCountdown } from "./useRecordingCountdown";

interface UseRecorderRuntimeOptions {
  onRecordingStoppedNavigate: (projectId: string) => void;
}

interface ResolvedRecordingSource {
  source: CaptureSource;
  preferredDisplayOrdinal: number | null;
}

const START_RECORDING_TIMEOUT_MS = 15_000;

function describeDisplaySource(sourceId: string, sourceOrdinal?: number | null): string {
  if (typeof sourceOrdinal === "number" && Number.isFinite(sourceOrdinal)) {
    return `Display ${sourceOrdinal + 1}`;
  }
  return `display source ${sourceId}`;
}

function parseNumericSourceId(sourceId: string): number | null {
  const numericId = Number.parseInt(sourceId, 10);
  if (Number.isFinite(numericId)) {
    return numericId;
  }
  return null;
}

function sortDisplaySources(sources: CaptureSource[]): CaptureSource[] {
  return [...sources].sort((left, right) => {
    const leftNumericId = parseNumericSourceId(left.id);
    const rightNumericId = parseNumericSourceId(right.id);
    if (leftNumericId === null && rightNumericId === null) {
      return left.name.localeCompare(right.name);
    }
    if (leftNumericId === null) {
      return 1;
    }
    if (rightNumericId === null) {
      return -1;
    }
    return leftNumericId - rightNumericId;
  });
}

function resolveSelectedSourceOrdinal(
  sourceType: "display" | "window",
  selectedSource: CaptureSource | null,
  availableSources: CaptureSource[]
): number | null {
  if (sourceType !== "display" || !selectedSource) {
    return null;
  }
  const orderedDisplays = sortDisplaySources(
    availableSources.filter((source) => source.type === "display")
  );
  const sourceIndex = orderedDisplays.findIndex(
    (source) => source.id === selectedSource.id
  );
  if (sourceIndex < 0) {
    return null;
  }
  return sourceIndex;
}

function selectFallbackSource(
  availableSources: CaptureSource[],
  sourceType: "display" | "window"
): CaptureSource | null {
  if (availableSources.length === 0) {
    return null;
  }
  if (sourceType !== "display") {
    return availableSources[0];
  }
  const byNumericId = sortDisplaySources(availableSources);
  return byNumericId[0] ?? availableSources[0];
}

function resolvePreferredSource(
  availableSources: CaptureSource[],
  sourceType: "display" | "window",
  currentSourceId: string | null,
  preferredSourceId: string | null,
  preferredSourceOrdinal: number | null
): CaptureSource | null {
  if (availableSources.length === 0) {
    return null;
  }
  if (currentSourceId) {
    const currentSource = availableSources.find((source) => source.id === currentSourceId);
    if (currentSource) {
      return currentSource;
    }
  }
  if (preferredSourceId) {
    const preferredSource = availableSources.find((source) => source.id === preferredSourceId);
    if (preferredSource) {
      return preferredSource;
    }
  }
  if (
    sourceType === "display" &&
    preferredSourceOrdinal !== null &&
    preferredSourceOrdinal >= 0
  ) {
    const orderedDisplays = sortDisplaySources(
      availableSources.filter((source) => source.type === "display")
    );
    const preferredByOrdinal = orderedDisplays[preferredSourceOrdinal];
    if (preferredByOrdinal) {
      return preferredByOrdinal;
    }
  }
  return selectFallbackSource(availableSources, sourceType);
}

export function useRecorderRuntime({ onRecordingStoppedNavigate }: UseRecorderRuntimeOptions) {
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diskWarning, setDiskWarning] = useState<string | null>(null);
  const [preferredDisplaySourceId, setPreferredDisplaySourceId] = useState<string | null>(null);
  const [preferredDisplaySourceOrdinal, setPreferredDisplaySourceOrdinal] = useState<number | null>(null);
  const [preferredWindowSourceId, setPreferredWindowSourceId] = useState<string | null>(null);
  const pendingTrayQuickRecordRef = useRef(false);
  const loadSourcesInFlightRef = useRef(false);
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
  const preferredSourceId =
    sourceType === "display" ? preferredDisplaySourceId : preferredWindowSourceId;
  const preferredSourceOrdinal =
    sourceType === "display" ? preferredDisplaySourceOrdinal : null;

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
      const fallbackSelectedSourceId = persisted.selectedSourceId ?? null;
      setPreferredDisplaySourceId(
        persisted.selectedDisplaySourceId ??
          (persisted.sourceType === "display" ? fallbackSelectedSourceId : null)
      );
      setPreferredDisplaySourceOrdinal(
        persisted.selectedDisplaySourceOrdinal ??
          (persisted.sourceType === "display"
            ? persisted.selectedSourceOrdinal ?? null
            : null)
      );
      setPreferredWindowSourceId(
        persisted.selectedWindowSourceId ??
          (persisted.sourceType === "window" ? fallbackSelectedSourceId : null)
      );
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
    if (!selectedSource || selectedSource.type !== "display") {
      return;
    }
    const nextOrdinal = resolveSelectedSourceOrdinal(sourceType, selectedSource, sources);
    setPreferredDisplaySourceOrdinal(nextOrdinal);
  }, [selectedSource, sourceType, sources]);

  useEffect(() => {
    if (!selectedSource || selectedSource.type !== sourceType) {
      return;
    }
    if (sourceType === "display") {
      if (preferredDisplaySourceId !== selectedSource.id) {
        setPreferredDisplaySourceId(selectedSource.id);
      }
      return;
    }
    if (preferredWindowSourceId !== selectedSource.id) {
      setPreferredWindowSourceId(selectedSource.id);
    }
  }, [
    preferredDisplaySourceId,
    preferredWindowSourceId,
    selectedSource,
    sourceType,
  ]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    void saveRecordingPreferences({
      sourceType,
      selectedSourceId: selectedSource?.id ?? preferredSourceId ?? null,
      selectedSourceOrdinal:
        sourceType === "display" ? preferredSourceOrdinal : null,
      selectedDisplaySourceId: preferredDisplaySourceId,
      selectedDisplaySourceOrdinal: preferredDisplaySourceOrdinal,
      selectedWindowSourceId: preferredWindowSourceId,
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
    preferredDisplaySourceId,
    preferredDisplaySourceOrdinal,
    preferredWindowSourceId,
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
  }, [sourceType, hasPermission, preferredSourceId, preferredSourceOrdinal]);

  useEffect(() => {
    if (!hasPermission || recordingState !== "idle") {
      return;
    }
    const refreshIntervalId = window.setInterval(() => {
      void loadSources();
    }, 15000);
    return () => {
      window.clearInterval(refreshIntervalId);
    };
  }, [
    hasPermission,
    recordingState,
    sourceType,
    preferredSourceId,
    preferredSourceOrdinal,
  ]);

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
        const minimumRequiredGb = formatBytesAsGiB(resolveMinimumFreeBytes(status));
        setDiskWarning(
          `Low disk space: ${formatBytesAsGiB(status.freeBytes)} GB available. Recording requires at least ${minimumRequiredGb} GB free.`
        );
      } else {
        setDiskWarning(null);
      }
    } catch (error) {
      console.error("Failed to check disk space:", error);
      setDiskWarning("Unable to verify available disk space.");
    }
  }

  useEffect(() => {
    const unlisten = listen<string>("recording-stopped", (event) => {
      const stoppedProjectId = event.payload.trim();
      setRecordingState("idle");
      setProjectId(null);
      setRecordingStartTimeMs(null);
      clearStoredCurrentProjectId();
      clearPendingRecordingSourceFallbackNotice();
      if (stoppedProjectId.length > 0) {
        onRecordingStoppedNavigate(stoppedProjectId);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [
    onRecordingStoppedNavigate,
    setProjectId,
    setRecordingState,
    setRecordingStartTimeMs,
  ]);

  useEffect(() => {
    const unlisten = listen("global-shortcut-start-stop", () => {
      if (recordingState === "idle" && countdown === null) {
        void handleStartRecording();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [countdown, recordingState]);

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
    const unlisten = listen<{
      sourceType: "display" | "window";
      sourceId: string;
      sourceOrdinal?: number | null;
    }>("recording-source-fallback", (event) => {
      if (event.payload.sourceType !== "display") {
        return;
      }
      setPreferredDisplaySourceId(event.payload.sourceId);
      if (typeof event.payload.sourceOrdinal === "number") {
        setPreferredDisplaySourceOrdinal(event.payload.sourceOrdinal);
      }
      setErrorMessage(
        `Selected display became unavailable. Recorder switched to ${describeDisplaySource(
          event.payload.sourceId,
          event.payload.sourceOrdinal
        )}.`
      );
      const matchingSource = sources.find(
        (source) =>
          source.type === "display" && source.id === event.payload.sourceId
      );
      if (matchingSource) {
        setSelectedSource(matchingSource);
      } else {
        void loadSources();
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setSelectedSource, sources]);

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
    if (hasPermission === null || isLoadingSources) return;
    pendingTrayQuickRecordRef.current = false;
    void handleStartRecording();
  }, [countdown, hasPermission, isLoadingSources, recordingState]);

  async function loadSources() {
    if (loadSourcesInFlightRef.current) {
      return;
    }
    loadSourcesInFlightRef.current = true;
    setIsLoadingSources(true);
    try {
      const result = await invoke<CaptureSource[]>("list_capture_sources", {
        sourceType,
      });
      setSources(result);
      const currentSourceId =
        selectedSource?.type === sourceType ? selectedSource.id : null;
      const preferredSourceStillAvailable = preferredSourceId
        ? result.some((source) => source.id === preferredSourceId)
        : true;
      const resolvedSource = resolvePreferredSource(
        result,
        sourceType,
        currentSourceId,
        preferredSourceId,
        preferredSourceOrdinal
      );
      setSelectedSource(resolvedSource);
      if (
        currentSourceId &&
        resolvedSource &&
        resolvedSource.id !== currentSourceId &&
        sourceType === "display"
      ) {
        setErrorMessage(
          `Display "${selectedSource?.name ?? currentSourceId}" is unavailable. Switched to "${resolvedSource.name}".`
        );
      } else if (
        sourceType === "display" &&
        resolvedSource &&
        preferredSourceId &&
        !preferredSourceStillAvailable &&
        resolvedSource.id !== preferredSourceId
      ) {
        setErrorMessage(
          `Saved display is unavailable. Switched to "${resolvedSource.name}".`
        );
      }
    } catch (error) {
      console.error("Failed to load capture sources:", error);
      setErrorMessage("Could not load capture sources. Check permissions and retry.");
      setSources([]);
      setSelectedSource(null);
    } finally {
      loadSourcesInFlightRef.current = false;
      setIsLoadingSources(false);
    }
  }

  async function resolveAvailableSourceForRecording(): Promise<ResolvedRecordingSource | null> {
    try {
      const availableSources = await invoke<CaptureSource[]>("list_capture_sources", {
        sourceType,
      });
      setSources(availableSources);
      const currentSourceId =
        selectedSource?.type === sourceType ? selectedSource.id : null;
      const preferredSourceStillAvailable = preferredSourceId
        ? availableSources.some((source) => source.id === preferredSourceId)
        : true;
      const resolvedSource = resolvePreferredSource(
        availableSources,
        sourceType,
        currentSourceId,
        preferredSourceId,
        preferredSourceOrdinal
      );
      setSelectedSource(resolvedSource);
      if (!resolvedSource) {
        setErrorMessage(
          sourceType === "display"
            ? "No displays are available for capture."
            : "No windows are available for capture."
        );
        return null;
      }
      if (
        currentSourceId &&
        resolvedSource.id !== currentSourceId &&
        sourceType === "display"
      ) {
        setErrorMessage(
          `Display "${selectedSource?.name ?? currentSourceId}" was disconnected. Recording will use "${resolvedSource.name}".`
        );
      } else if (
        sourceType === "display" &&
        preferredSourceId &&
        !preferredSourceStillAvailable &&
        resolvedSource.id !== preferredSourceId
      ) {
        setErrorMessage(
          `Saved display is unavailable. Recording will use "${resolvedSource.name}".`
        );
      } else {
        setErrorMessage(null);
      }
      return {
        source: resolvedSource,
        preferredDisplayOrdinal: resolveSelectedSourceOrdinal(
          sourceType,
          resolvedSource,
          availableSources
        ),
      };
    } catch (error) {
      console.error("Failed to refresh capture sources before recording:", error);
      setErrorMessage("Unable to refresh available capture sources before recording.");
      return null;
    }
  }

  async function startRecordingSession() {
    const resolvedSource = await resolveAvailableSourceForRecording();
    if (!resolvedSource) return;

    beginRecordingStart();
    try {
      const options: RecordingOptionsType = {
        sourceId: resolvedSource.source.id,
        sourceType: resolvedSource.source.type,
        preferredDisplayOrdinal:
          resolvedSource.source.type === "display"
            ? resolvedSource.preferredDisplayOrdinal
            : null,
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

      const resolvedCaptureSource = sources.find(
        (source) =>
          source.id === result.resolvedSourceId &&
          source.type === resolvedSource.source.type
      );
      if (resolvedCaptureSource) {
        setSelectedSource(resolvedCaptureSource);
      }

      setProjectId(result.projectId);
      setRecordingStartTimeMs(result.recordingStartTimeMs);
      startRecording(result.projectId);
      setStoredCurrentProjectId(result.projectId);
      if (result.fallbackSource?.sourceId) {
        setPendingRecordingSourceFallbackNotice({
          projectId: result.projectId,
          sourceType: "display",
          sourceId: result.fallbackSource.sourceId,
          sourceOrdinal: result.fallbackSource.sourceOrdinal ?? null,
        });
      } else {
        clearPendingRecordingSourceFallbackNotice();
      }
      setErrorMessage(null);

      await invoke("open_recording_widget");
      const mainWindow = getCurrentWindow();
      await mainWindow.hide();
    } catch (error) {
      console.error("Failed to start recording:", error);
      setProjectId(null);
      setRecordingStartTimeMs(null);
      setRecordingState("idle");
      clearStoredCurrentProjectId();
      clearPendingRecordingSourceFallbackNotice();
      setErrorMessage(
        toErrorMessage(error, "Failed to start recording. Please try again.")
      );
    }
  }

  async function handleStartRecording() {
    if (countdown !== null) return;
    try {
      const status = await invoke<DiskSpaceStatus>("check_recording_disk_space");
      if (!status.sufficient) {
        const minimumRequiredGb = formatBytesAsGiB(resolveMinimumFreeBytes(status));
        setErrorMessage(
          `Insufficient disk space. ${formatBytesAsGiB(status.freeBytes)} GB available, ${minimumRequiredGb} GB required.`
        );
        return;
      }
    } catch (error) {
      console.error("Failed to check disk space before recording:", error);
      setErrorMessage("Unable to verify available disk space before recording.");
      return;
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
