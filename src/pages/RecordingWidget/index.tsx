import { WidgetPanel } from "./components/WidgetPanel";
import { useRecordingWidgetRuntime } from "./hooks/useRecordingWidgetRuntime";

export function RecordingWidget() {
  const {
    elapsedTime,
    permissionError,
    isRecording,
    isStopping,
    statusLabel,
    togglePause,
    stopRecording,
  } = useRecordingWidgetRuntime();

  return (
    <WidgetPanel
      elapsedTime={elapsedTime}
      isRecording={isRecording}
      isStopping={isStopping}
      statusLabel={statusLabel}
      permissionError={permissionError}
      onTogglePause={togglePause}
      onStopRecording={stopRecording}
    />
  );
}
