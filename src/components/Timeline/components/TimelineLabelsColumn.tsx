import { Film, Timer, ZoomIn } from "lucide-react";
import { TrackLabel } from "./TrackLabel";

interface TimelineLabelsColumnProps {
  showAnnotations: boolean;
  showScreenWaveform: boolean;
  showMicrophoneWaveform: boolean;
}

export function TimelineLabelsColumn({
  showAnnotations,
  showScreenWaveform,
  showMicrophoneWaveform,
}: TimelineLabelsColumnProps) {
  return (
    <div className="flex w-16 shrink-0 flex-col gap-2">
      <TrackLabel icon={<Film className="size-3.5" strokeWidth={1.75} />} label="Clips" />
      <TrackLabel icon={<ZoomIn className="size-3.5" strokeWidth={1.75} />} label="Zoom" />
      <TrackLabel icon={<Timer className="size-3.5" strokeWidth={1.75} />} label="Speed" />
      {showAnnotations && (
        <TrackLabel icon={<Timer className="size-3.5" strokeWidth={1.75} />} label="Annot" />
      )}
      {showScreenWaveform && (
        <TrackLabel icon={<Film className="size-3.5" strokeWidth={1.75} />} label="Sys Aud" />
      )}
      {showMicrophoneWaveform && (
        <TrackLabel icon={<Film className="size-3.5" strokeWidth={1.75} />} label="Mic Aud" />
      )}
    </div>
  );
}
