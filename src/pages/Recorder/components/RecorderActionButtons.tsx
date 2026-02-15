import { Button } from "../../../components/Button";
import { RecordButton } from "../../../components/RecordButton";

interface RecorderActionButtonsProps {
  canStartRecording: boolean;
  isRecording: boolean;
  showOpenRecordingWidgetButton: boolean;
  onOpenRecordingWidget: () => void;
  onStartRecording: () => void;
}

export function RecorderActionButtons({
  canStartRecording,
  isRecording,
  showOpenRecordingWidgetButton,
  onOpenRecordingWidget,
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
    </div>
  );
}
