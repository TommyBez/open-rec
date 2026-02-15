import { cn } from "@/lib/utils";

interface WaveformTrackProps {
  bars: Array<{ id: string; leftPercent: number; amplitude: number }>;
  barClassName: string;
  trackClassName: string;
}

export function WaveformTrack({ bars, barClassName, trackClassName }: WaveformTrackProps) {
  return (
    <div className={cn("relative h-10 w-full overflow-hidden rounded-lg", trackClassName)}>
      {bars.map((bar) => {
        const heightPercent = Math.max(8, Math.min(100, bar.amplitude * 100));
        return (
          <div
            key={bar.id}
            className={cn("absolute bottom-0 w-[0.9%] rounded-full opacity-90", barClassName)}
            style={{
              left: `${bar.leftPercent}%`,
              height: `${heightPercent}%`,
            }}
          />
        );
      })}
    </div>
  );
}
