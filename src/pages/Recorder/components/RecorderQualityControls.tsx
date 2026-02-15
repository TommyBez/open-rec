interface RecorderQualityControlsProps {
  qualityPreset: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60";
  codec: "h264" | "hevc";
  onQualityPresetChange: (value: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60") => void;
  onCodecChange: (value: "h264" | "hevc") => void;
}

export function RecorderQualityControls({
  qualityPreset,
  codec,
  onQualityPresetChange,
  onCodecChange,
}: RecorderQualityControlsProps) {
  return (
    <div className="animate-fade-up-delay-3 space-y-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
        Recording Quality
      </span>
      <div className="grid grid-cols-2 gap-2">
        <select
          value={qualityPreset}
          onChange={(event) =>
            onQualityPresetChange(
              event.target.value as "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60"
            )
          }
          className="rounded-lg border border-border/60 bg-card/60 px-2 py-2 text-xs text-foreground/80 outline-none focus:border-primary/50"
        >
          <option value="720p30">720p @ 30 FPS</option>
          <option value="1080p30">1080p @ 30 FPS</option>
          <option value="1080p60">1080p @ 60 FPS</option>
          <option value="4k30">4K @ 30 FPS</option>
          <option value="4k60">4K @ 60 FPS</option>
        </select>
        <select
          value={codec}
          onChange={(event) => onCodecChange(event.target.value as "h264" | "hevc")}
          className="rounded-lg border border-border/60 bg-card/60 px-2 py-2 text-xs text-foreground/80 outline-none focus:border-primary/50"
        >
          <option value="h264">Codec: H.264</option>
          <option value="hevc">Codec: HEVC</option>
        </select>
      </div>
    </div>
  );
}
