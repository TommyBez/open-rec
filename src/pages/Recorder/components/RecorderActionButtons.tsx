import { Button } from "../../../components/Button";
import { RecordButton } from "../../../components/RecordButton";

interface RecorderActionButtonsProps {
  canStartRecording: boolean;
  isRecording: boolean;
  showOpenRecordingWidgetButton: boolean;
  showRetryFinalizationButton: boolean;
  onOpenRecordingWidget: () => void;
  onRetryFinalization: () => void;
  onStartRecording: () => void;
}

export function RecorderActionButtons({
  canStartRecording,
  isRecording,
  showOpenRecordingWidgetButton,
  showRetryFinalizationButton,
  onOpenRecordingWidget,
  onRetryFinalization,
  onStartRecording,
}: RecorderActionButtonsProps) {
  return (
    <div className="animate-fade-up-delay-4">
      <RecordButton onClick={onStartRecording} disabled={!canStartRecording || isRecording} />
      {showOpenRecordingWidgetButton && (
        <Button variant="secondary" className="mt-2 w-full" onClick={onOpenRecordingWidget}>
          Open Floating Controls
        </Button>
      )}
      {showRetryFinalizationButton && (
        <Button variant="secondary" className="mt-2 w-full" onClick={onRetryFinalization}>
          Retry Finalization
        </Button>
      )}
    </div>
  );
}
