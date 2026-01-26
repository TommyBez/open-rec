import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Project, ExportOptions as ExportOptionsType } from "../../types/project";
import { Button } from "../Button";
import "./styles.css";

interface ExportModalProps {
  project: Project;
  onClose: () => void;
}

type ExportTarget = "file" | "clipboard" | "link";
type ExportFormat = ExportOptionsType["format"];
type FrameRate = ExportOptionsType["frameRate"];
type Compression = ExportOptionsType["compression"];
type Resolution = ExportOptionsType["resolution"];

interface ExportOptions extends ExportOptionsType {
  target: ExportTarget;
}

export function ExportModal({ project, onClose }: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    target: "file",
    format: "mp4",
    frameRate: 30,
    compression: "social",
    resolution: "1080p",
  });
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Calculate estimated file size and time
  const estimatedSize = calculateEstimatedSize(project.duration, options);
  const estimatedTime = calculateEstimatedTime(project.duration, options);

  async function handleExport() {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      // Listen for progress updates
      const unlisten = await listen<number>("export-progress", (event) => {
        setProgress(event.payload);
      });

      await invoke("export_project", {
        projectId: project.id,
        options: {
          format: options.format,
          frameRate: options.frameRate,
          compression: options.compression,
          resolution: options.resolution,
        },
      });

      unlisten();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function formatResolution(): string {
    return `${project.resolution.width}×${project.resolution.height}`;
  }

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <header className="export-header">
          <h2>Export</h2>
        </header>

        <div className="export-content">
          {/* Export Target */}
          <div className="export-section">
            <label className="section-label">Export to</label>
            <div className="option-group">
              {(["file", "clipboard", "link"] as ExportTarget[]).map((target) => (
                <button
                  key={target}
                  className={`option-btn ${options.target === target ? "active" : ""}`}
                  onClick={() => setOptions({ ...options, target })}
                  disabled={target !== "file"} // Only file supported in v1
                >
                  <span className="option-icon">
                    {target === "file" && "📄"}
                    {target === "clipboard" && "📋"}
                    {target === "link" && "🔗"}
                  </span>
                  <span className="option-label">
                    {target === "file" && "File"}
                    {target === "clipboard" && "Clipboard"}
                    {target === "link" && "Shareable link"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="export-row">
            {/* Format */}
            <div className="export-section">
              <label className="section-label">Format</label>
              <div className="option-group compact">
                {(["mp4", "gif"] as ExportFormat[]).map((format) => (
                  <button
                    key={format}
                    className={`option-btn ${options.format === format ? "active" : ""}`}
                    onClick={() => setOptions({ ...options, format })}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Frame Rate */}
            <div className="export-section">
              <label className="section-label">Frame rate</label>
              <select
                className="export-select"
                value={options.frameRate}
                onChange={(e) =>
                  setOptions({ ...options, frameRate: Number(e.target.value) as FrameRate })
                }
              >
                <option value={24}>24 FPS</option>
                <option value={30}>30 FPS</option>
                <option value={60}>60 FPS</option>
              </select>
            </div>
          </div>

          {/* Compression */}
          <div className="export-section">
            <label className="section-label">Compression</label>
            <div className="option-group">
              {(["minimal", "social", "web", "potato"] as Compression[]).map((comp) => (
                <button
                  key={comp}
                  className={`option-btn ${options.compression === comp ? "active" : ""}`}
                  onClick={() => setOptions({ ...options, compression: comp })}
                >
                  {comp.charAt(0).toUpperCase() + comp.slice(1)}
                  {comp === "social" && " Media"}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="export-section">
            <label className="section-label">Resolution</label>
            <div className="option-group">
              {(["720p", "1080p", "4k"] as Resolution[]).map((res) => (
                <button
                  key={res}
                  className={`option-btn ${options.resolution === res ? "active" : ""}`}
                  onClick={() => setOptions({ ...options, resolution: res })}
                >
                  {res}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="export-footer">
          <div className="export-info">
            <span className="info-item">
              <span className="info-icon">🎬</span>
              {formatDuration(project.duration)}
            </span>
            <span className="info-item">
              <span className="info-icon">🖥</span>
              {formatResolution()}
            </span>
            <span className="info-item">
              <span className="info-icon">📦</span>
              {estimatedSize}
            </span>
            <span className="info-item">
              <span className="info-icon">⏱</span>
              ~{estimatedTime}
            </span>
          </div>

          {error && <div className="export-error">{error}</div>}

          {isExporting ? (
            <div className="export-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="progress-text">{Math.round(progress)}%</span>
            </div>
          ) : (
            <Button variant="primary" onClick={handleExport}>
              Export to 📄
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}

function calculateEstimatedSize(duration: number, options: ExportOptions): string {
  // Rough estimates based on compression preset
  const bitrates: Record<Compression, number> = {
    minimal: 20, // Mbps
    social: 8,
    web: 4,
    potato: 1.5,
  };

  const bitrate = bitrates[options.compression];
  const sizeMB = (duration * bitrate) / 8;

  if (sizeMB >= 1000) {
    return `${(sizeMB / 1000).toFixed(2)} GB`;
  }
  return `${sizeMB.toFixed(2)} MB`;
}

function calculateEstimatedTime(duration: number, options: ExportOptions): string {
  // Rough estimate: export time is roughly 0.5-2x the video duration
  const multipliers: Record<Resolution, number> = {
    "720p": 0.3,
    "1080p": 0.5,
    "4k": 1.5,
  };

  const seconds = Math.ceil(duration * multipliers[options.resolution]);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs}s`;
}
