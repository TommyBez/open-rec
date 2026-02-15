import { ExportOptions } from "../../../types/project";
import { Button } from "@/components/ui/button";

interface BatchExportToolbarProps {
  selectedCount: number;
  isBatchExporting: boolean;
  stopBatchRequested: boolean;
  batchOptions: ExportOptions;
  onBatchOptionsChange: (next: ExportOptions) => void;
  onStartBatchExport: () => void;
  onStopBatchExport: () => void;
}

export function BatchExportToolbar({
  selectedCount,
  isBatchExporting,
  stopBatchRequested,
  batchOptions,
  onBatchOptionsChange,
  onStartBatchExport,
  onStopBatchExport,
}: BatchExportToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2">
      <span className="text-xs text-muted-foreground">Selected: {selectedCount}</span>
      <select
        value={batchOptions.format}
        onChange={(event) =>
          onBatchOptionsChange({
            ...batchOptions,
            format: event.target.value as ExportOptions["format"],
          })
        }
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs"
      >
        <option value="mp4">MP4</option>
        <option value="mov">MOV</option>
        <option value="gif">GIF</option>
        <option value="mp3">MP3</option>
        <option value="wav">WAV</option>
      </select>
      <select
        value={batchOptions.resolution}
        disabled={batchOptions.format === "mp3" || batchOptions.format === "wav"}
        onChange={(event) =>
          onBatchOptionsChange({
            ...batchOptions,
            resolution: event.target.value as ExportOptions["resolution"],
          })
        }
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="720p">720p</option>
        <option value="1080p">1080p</option>
        <option value="4k">4K</option>
      </select>
      <select
        value={String(batchOptions.frameRate)}
        disabled={batchOptions.format === "mp3" || batchOptions.format === "wav"}
        onChange={(event) =>
          onBatchOptionsChange({
            ...batchOptions,
            frameRate: Number(event.target.value) as ExportOptions["frameRate"],
          })
        }
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="24">24 FPS</option>
        <option value="30">30 FPS</option>
        <option value="60">60 FPS</option>
      </select>
      <select
        value={batchOptions.compression}
        disabled={batchOptions.format !== "mp4" && batchOptions.format !== "mp3"}
        onChange={(event) =>
          onBatchOptionsChange({
            ...batchOptions,
            compression: event.target.value as ExportOptions["compression"],
          })
        }
        className="rounded-md border border-border/60 bg-background px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="minimal">Minimal</option>
        <option value="social">Social</option>
        <option value="web">Web</option>
        <option value="potato">Potato</option>
      </select>
      <Button size="sm" disabled={selectedCount === 0 || isBatchExporting} onClick={onStartBatchExport}>
        {isBatchExporting ? "Exporting..." : "Export Selected"}
      </Button>
      {isBatchExporting && (
        <Button size="sm" variant="outline" disabled={stopBatchRequested} onClick={onStopBatchExport}>
          {stopBatchRequested ? "Stopping..." : "Stop Queue"}
        </Button>
      )}
    </div>
  );
}
