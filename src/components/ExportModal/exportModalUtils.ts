import type { ExportOptions as ExportOptionsType } from "../../types/project";

type Compression = ExportOptionsType["compression"];
type Resolution = ExportOptionsType["resolution"];

export type ExportPreset = "youtube-4k" | "web-discord" | "prores-master" | "custom";

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function calculateEstimatedSize(duration: number, options: ExportOptionsType): string {
  if (options.format === "mov") {
    const proresBitrates: Record<Resolution, number> = {
      "720p": 100,
      "1080p": 220,
      "4k": 650,
    };
    const sizeMB = (duration * proresBitrates[options.resolution]) / 8;
    return sizeMB >= 1000 ? `${(sizeMB / 1000).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
  }
  if (options.format === "wav") {
    const wavBitrateMbps = 1.536;
    const sizeMB = (duration * wavBitrateMbps) / 8;
    return sizeMB >= 1000 ? `${(sizeMB / 1000).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
  }
  if (options.format === "mp3") {
    const audioBitrates: Record<Compression, number> = {
      minimal: 0.32,
      social: 0.192,
      web: 0.128,
      potato: 0.096,
    };
    const sizeMB = (duration * audioBitrates[options.compression]) / 8;
    return sizeMB >= 1000 ? `${(sizeMB / 1000).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
  }

  const bitrates: Record<Compression, number> = {
    minimal: 20,
    social: 8,
    web: 4,
    potato: 1.5,
  };
  const sizeMB = (duration * bitrates[options.compression]) / 8;
  return sizeMB >= 1000 ? `${(sizeMB / 1000).toFixed(2)} GB` : `${sizeMB.toFixed(2)} MB`;
}

export function calculateEstimatedTime(duration: number, options: ExportOptionsType): string {
  if (options.format === "wav" || options.format === "mp3") {
    const seconds = Math.ceil(duration * 0.2);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
  }

  const multipliers: Record<Resolution, number> = {
    "720p": 0.3,
    "1080p": 0.5,
    "4k": 1.5,
  };
  const formatMultiplier = options.format === "mov" ? 1.8 : 1.0;
  const seconds = Math.ceil(duration * multipliers[options.resolution] * formatMultiplier);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
}

export function getPresetOptions(preset: Exclude<ExportPreset, "custom">): ExportOptionsType {
  switch (preset) {
    case "youtube-4k":
      return {
        format: "mp4",
        frameRate: 60,
        compression: "minimal",
        resolution: "4k",
      };
    case "web-discord":
      return {
        format: "mp4",
        frameRate: 30,
        compression: "web",
        resolution: "1080p",
      };
    case "prores-master":
      return {
        format: "mov",
        frameRate: 30,
        compression: "minimal",
        resolution: "4k",
      };
  }
}

export function detectActivePreset(options: ExportOptionsType): ExportPreset {
  const entries: Array<Exclude<ExportPreset, "custom">> = [
    "youtube-4k",
    "web-discord",
    "prores-master",
  ];
  const matched = entries.find((preset) => {
    const presetOptions = getPresetOptions(preset);
    return (
      presetOptions.format === options.format &&
      presetOptions.frameRate === options.frameRate &&
      presetOptions.compression === options.compression &&
      presetOptions.resolution === options.resolution
    );
  });
  return matched ?? "custom";
}
