interface TimeMarkersProps {
  markers: Array<{ time: number; label: string }>;
  timelineDuration: number;
}

export function TimeMarkers({ markers, timelineDuration }: TimeMarkersProps) {
  return (
    <div className="relative mb-1 ml-[72px] h-5">
      {markers.map((marker) => (
        <div
          key={marker.time}
          className="absolute -translate-x-1/2"
          style={{ left: `${(marker.time / timelineDuration) * 100}%` }}
        >
          <span className="font-mono text-[10px] text-muted-foreground/50">{marker.label}</span>
        </div>
      ))}
    </div>
  );
}
