interface AudioMixControlsProps {
  hasMicrophoneTrack: boolean;
  systemVolume: number;
  microphoneVolume: number;
  microphoneNoiseGate: boolean;
  onSystemVolumeChange: (volume: number) => void;
  onMicrophoneVolumeChange: (volume: number) => void;
  onMicrophoneNoiseGateChange: (enabled: boolean) => void;
}

export function AudioMixControls({
  hasMicrophoneTrack,
  systemVolume,
  microphoneVolume,
  microphoneNoiseGate,
  onSystemVolumeChange,
  onMicrophoneVolumeChange,
  onMicrophoneNoiseGateChange,
}: AudioMixControlsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Sys
        <input
          type="number"
          min={0}
          max={2}
          step={0.05}
          value={systemVolume.toFixed(2)}
          onChange={(event) => onSystemVolumeChange(Number(event.target.value) || systemVolume)}
          className="w-11 bg-transparent text-right text-xs outline-none"
          title="System audio volume"
        />
      </label>
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Mic
        <input
          type="number"
          min={0}
          max={2}
          step={0.05}
          disabled={!hasMicrophoneTrack}
          value={microphoneVolume.toFixed(2)}
          onChange={(event) =>
            onMicrophoneVolumeChange(Number(event.target.value) || microphoneVolume)
          }
          className="w-11 bg-transparent text-right text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          title="Microphone volume"
        />
      </label>
      <label className="flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-xs text-foreground/80">
        Gate
        <input
          type="checkbox"
          checked={microphoneNoiseGate}
          disabled={!hasMicrophoneTrack}
          onChange={(event) => onMicrophoneNoiseGateChange(event.target.checked)}
          className="size-3.5 accent-primary disabled:cursor-not-allowed"
          title="Enable microphone noise gate"
        />
      </label>
    </div>
  );
}
