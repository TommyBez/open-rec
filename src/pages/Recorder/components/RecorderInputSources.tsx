import { ToggleRow } from "../../../components/ToggleRow";

interface RecorderInputSourcesProps {
  captureCamera: boolean;
  cameraReady: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
  onToggleCamera: () => void;
  onToggleMicrophone: () => void;
  onToggleSystemAudio: () => void;
}

export function RecorderInputSources({
  captureCamera,
  cameraReady,
  captureMicrophone,
  captureSystemAudio,
  onToggleCamera,
  onToggleMicrophone,
  onToggleSystemAudio,
}: RecorderInputSourcesProps) {
  return (
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
          onToggle={onToggleCamera}
        />
        <ToggleRow
          icon="microphone"
          label="Microphone"
          sublabel={captureMicrophone ? "Ready" : "Off"}
          enabled={captureMicrophone}
          onToggle={onToggleMicrophone}
        />
        <ToggleRow
          icon="speaker"
          label="System Audio"
          sublabel={captureSystemAudio ? "Ready" : "Off"}
          enabled={captureSystemAudio}
          onToggle={onToggleSystemAudio}
        />
      </div>
    </div>
  );
}
