import { useNavigate } from "react-router-dom";
import { PermissionDeniedView, PermissionLoadingView } from "./components/PermissionViews";
import { useRecorderRuntime } from "./hooks/useRecorderRuntime";
import { RecorderMainPanel } from "./components/RecorderMainPanel";

export function RecorderPage() {
  const navigate = useNavigate();
  const {
    countdown,
    errorMessage,
    diskWarning,
    hasPermission,
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
    qualityPreset, codec, cameraReady,
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
  } = useRecorderRuntime({
    onRecordingStoppedNavigate: (nextProjectId) => navigate(`/editor/${nextProjectId}`),
  });

  // Show permission request UI if permission not granted
  if (hasPermission === false) {
    return <PermissionDeniedView onRequestPermission={requestPermission} />;
  }

  // Show loading state while checking permission
  if (hasPermission === null) {
    return <PermissionLoadingView />;
  }

  return (
    <RecorderMainPanel
      selectedSource={selectedSource}
      countdown={countdown}
      errorMessage={errorMessage}
      diskWarning={diskWarning}
      sourceType={sourceType}
      sources={sources}
      isLoadingSources={isLoadingSources}
      captureCamera={captureCamera}
      isActivelyRecording={isActivelyRecording}
      projectId={projectId}
      recordingStartTimeMs={recordingStartTimeMs}
      captureMicrophone={captureMicrophone}
      captureSystemAudio={captureSystemAudio}
      cameraReady={cameraReady}
      qualityPreset={qualityPreset}
      codec={codec}
      isRecording={isRecording}
      onOpenVideos={() => navigate("/videos")}
      onSetSourceType={setSourceType}
      onSetSelectedSource={setSelectedSource}
      onSetCameraReady={setCameraReady}
      onToggleCamera={() => setCaptureCamera(!captureCamera)}
      onToggleMicrophone={() => setCaptureMicrophone(!captureMicrophone)}
      onToggleSystemAudio={() => setCaptureSystemAudio(!captureSystemAudio)}
      onQualityPresetChange={setQualityPreset}
      onCodecChange={setCodec}
      onStartRecording={handleStartRecording}
    />
  );
}
