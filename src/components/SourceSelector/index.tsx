import { useState, useRef, useEffect } from "react";
import { CaptureSource } from "../../pages/Recorder";
import "./styles.css";

interface SourceSelectorProps {
  sources: CaptureSource[];
  selectedSource: CaptureSource | null;
  onSelect: (source: CaptureSource) => void;
  isLoading?: boolean;
}

export function SourceSelector({
  sources,
  selectedSource,
  onSelect,
  isLoading = false,
}: SourceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="source-selector" ref={dropdownRef}>
      <button
        className="source-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
      >
        <span className="source-name">
          {isLoading ? "Loading..." : selectedSource?.name || "Select source"}
        </span>
        <span className="dropdown-arrow" />
      </button>

      {isOpen && (
        <div className="source-dropdown">
          {sources.map((source) => (
            <button
              key={source.id}
              className={`source-option ${selectedSource?.id === source.id ? "selected" : ""}`}
              onClick={() => {
                onSelect(source);
                setIsOpen(false);
              }}
            >
              <span className="source-option-icon">
                {source.type === "display" ? "🖥" : "▢"}
              </span>
              <span className="source-option-name">{source.name}</span>
              {selectedSource?.id === source.id && (
                <span className="check-icon">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
