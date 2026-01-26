import { useRef, useEffect, useState } from "react";
import { Segment, ZoomEffect, SpeedEffect } from "../../types/project";
import "./styles.css";

interface TimelineProps {
  duration: number;
  currentTime: number;
  segments: Segment[];
  zoom: ZoomEffect[];
  speed?: SpeedEffect[];
  onSeek: (time: number) => void;
  selectedTool: "cut" | "zoom" | "speed";
  onToolChange: (tool: "cut" | "zoom" | "speed") => void;
  onToggleSegment?: (segmentId: string) => void;
  onDeleteZoom?: (zoomId: string) => void;
}

export function Timeline({
  duration,
  currentTime,
  segments,
  zoom,
  speed = [],
  onSeek,
  selectedTool,
  onToolChange,
  onToggleSegment,
  onDeleteZoom,
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  // Generate time markers
  const markers: { time: number; label: string }[] = [];
  const interval = duration > 300 ? 60 : duration > 60 ? 30 : 10;
  for (let t = 0; t <= duration; t += interval) {
    const mins = Math.floor(t / 60);
    const secs = t % 60;
    markers.push({
      time: t,
      label: `${mins}:${secs.toString().padStart(2, "0")}`,
    });
  }

  function handleTimelineClick(e: React.MouseEvent) {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(Math.max(0, Math.min(duration, newTime)));
  }

  function handleMouseDown(e: React.MouseEvent) {
    setIsDragging(true);
    handleTimelineClick(e);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (isDragging) {
      handleTimelineClick(e);
    }
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleSegmentClick(e: React.MouseEvent, segmentId: string) {
    e.stopPropagation();
    if (onToggleSegment) {
      onToggleSegment(segmentId);
    }
  }

  function handleZoomDelete(e: React.MouseEvent, zoomId: string) {
    e.stopPropagation();
    if (onDeleteZoom) {
      onDeleteZoom(zoomId);
    }
  }

  useEffect(() => {
    function handleGlobalMouseUp() {
      setIsDragging(false);
    }
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  const playheadPosition = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="timeline-container">
      {/* Time markers */}
      <div className="time-markers">
        {markers.map((marker) => (
          <div
            key={marker.time}
            className="time-marker"
            style={{ left: `${(marker.time / duration) * 100}%` }}
          >
            <span className="marker-label">{marker.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline tracks */}
      <div
        ref={timelineRef}
        className="timeline-tracks"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Clip track */}
        <div className="track clip-track">
          {segments.map((segment) => (
            <div
              key={segment.id}
              className={`segment ${segment.enabled ? "enabled" : "disabled"}`}
              style={{
                left: `${(segment.startTime / duration) * 100}%`,
                width: `${((segment.endTime - segment.startTime) / duration) * 100}%`,
              }}
              onClick={(e) => handleSegmentClick(e, segment.id)}
              title={segment.enabled ? "Click to disable segment" : "Click to enable segment"}
            >
              <span className="segment-label">Clip</span>
              <span className="segment-duration">
                {Math.round(segment.endTime - segment.startTime)}s
              </span>
            </div>
          ))}
        </div>

        {/* Zoom track */}
        <div className="track zoom-track">
          {zoom.length > 0 ? (
            zoom.map((effect) => (
              <div
                key={effect.id}
                className="zoom-effect"
                style={{
                  left: `${(effect.startTime / duration) * 100}%`,
                  width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
                }}
              >
                <span className="effect-label">Zoom</span>
                <span className="effect-value">{effect.scale}x</span>
                <button 
                  className="effect-delete"
                  onClick={(e) => handleZoomDelete(e, effect.id)}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <div className="track-placeholder">
              <span>Zoom</span>
            </div>
          )}
        </div>

        {/* Speed track */}
        <div className="track speed-track">
          {speed.length > 0 ? (
            speed.map((effect) => (
              <div
                key={effect.id}
                className="speed-effect"
                style={{
                  left: `${(effect.startTime / duration) * 100}%`,
                  width: `${((effect.endTime - effect.startTime) / duration) * 100}%`,
                }}
              >
                <span className="effect-label">Speed</span>
                <span className="effect-value">{effect.speed}x</span>
              </div>
            ))
          ) : (
            <div className="track-placeholder">
              <span>Speed</span>
            </div>
          )}
        </div>

        {/* Playhead */}
        <div
          className="playhead"
          style={{ left: `${playheadPosition}%` }}
        >
          <div className="playhead-head" />
          <div className="playhead-line" />
        </div>
      </div>

      {/* Timeline toolbar */}
      <div className="timeline-toolbar">
        <div className="tool-buttons">
          <button
            className={`tool-btn ${selectedTool === "cut" ? "active" : ""}`}
            onClick={() => onToolChange("cut")}
            title="Cut tool"
          >
            ✂️ Cut
          </button>
          <button
            className={`tool-btn ${selectedTool === "zoom" ? "active" : ""}`}
            onClick={() => onToolChange("zoom")}
            title="Zoom tool"
          >
            🔍 Zoom
          </button>
          <button
            className={`tool-btn ${selectedTool === "speed" ? "active" : ""}`}
            onClick={() => onToolChange("speed")}
            title="Speed tool"
          >
            ⚡ Speed
          </button>
        </div>
        <div className="timeline-zoom">
          <button onClick={() => setScale(Math.max(0.5, scale - 0.25))}>−</button>
          <span>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(Math.min(4, scale + 0.25))}>+</button>
        </div>
      </div>
    </div>
  );
}
