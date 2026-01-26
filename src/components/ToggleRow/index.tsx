import "./styles.css";

interface ToggleRowProps {
  icon: "camera" | "microphone" | "speaker";
  label: string;
  enabled: boolean;
  onToggle: () => void;
}

const iconPaths: Record<string, string> = {
  camera: "M15 8v8H5V8h10m1-2H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4V7c0-.55-.45-1-1-1z",
  microphone: "M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z",
  speaker: "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
};

export function ToggleRow({ icon, label, enabled, onToggle }: ToggleRowProps) {
  return (
    <div className={`toggle-row ${enabled ? "enabled" : ""}`} onClick={onToggle}>
      <div className="toggle-icon">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d={iconPaths[icon]} />
        </svg>
      </div>
      <span className="toggle-label">{label}</span>
      <span className={`toggle-status ${enabled ? "on" : "off"}`}>
        {enabled ? "On" : "Off"}
      </span>
    </div>
  );
}
