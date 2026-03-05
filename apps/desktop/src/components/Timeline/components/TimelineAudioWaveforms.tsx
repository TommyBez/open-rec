import { WaveformTrack } from "./WaveformTrack";

interface TimelineAudioWaveformsProps {
  screenWaveformBars: Array<{ id: string; leftPercent: number; amplitude: number }>;
  microphoneWaveformBars: Array<{ id: string; leftPercent: number; amplitude: number }>;
}

export function TimelineAudioWaveforms({
  screenWaveformBars,
  microphoneWaveformBars,
}: TimelineAudioWaveformsProps) {
  return (
    <>
      {screenWaveformBars.length > 0 && (
        <WaveformTrack
          bars={screenWaveformBars}
          barClassName="bg-sky-400/70"
          trackClassName="bg-sky-500/10"
        />
      )}
      {microphoneWaveformBars.length > 0 && (
        <WaveformTrack
          bars={microphoneWaveformBars}
          barClassName="bg-emerald-400/70"
          trackClassName="bg-emerald-500/10"
        />
      )}
    </>
  );
}
