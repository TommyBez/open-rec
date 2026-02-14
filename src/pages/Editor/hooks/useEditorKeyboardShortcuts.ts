import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";

interface UseEditorKeyboardShortcutsOptions {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  skipBackward: () => void;
  toggleTool: (tool: "cut" | "zoom" | "speed" | "annotation") => void;
  selectedZoomId: string | null;
  selectedSpeedId: string | null;
  selectedAnnotationId: string | null;
  selectedSegmentId: string | null;
  handleDeleteSelected: () => void;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
  createAnnotationAtPlayhead: (mode?: "outline" | "blur" | "text" | "arrow") => void;
  setJklRateMultiplier: Dispatch<SetStateAction<number>>;
}

export function useEditorKeyboardShortcuts({
  canUndo,
  canRedo,
  undo,
  redo,
  isPlaying,
  togglePlay,
  skipBackward,
  toggleTool,
  selectedZoomId,
  selectedSpeedId,
  selectedAnnotationId,
  selectedSegmentId,
  handleDeleteSelected,
  currentTime,
  duration,
  seek,
  createAnnotationAtPlayhead,
  setJklRateMultiplier,
}: UseEditorKeyboardShortcutsOptions) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable='true']")) {
        return;
      }

      const isModifier = e.metaKey || e.ctrlKey;
      if (isModifier && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if (isModifier && ((e.key === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        if (canRedo) redo();
      }
      if (isModifier) return;

      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        setJklRateMultiplier(1);
        if (isPlaying) togglePlay();
      }
      if (e.key.toLowerCase() === "l") {
        e.preventDefault();
        if (!isPlaying) {
          setJklRateMultiplier(1);
          togglePlay();
        } else {
          setJklRateMultiplier((current) => (current >= 4 ? 1 : current >= 2 ? 4 : 2));
        }
      }
      if (e.key.toLowerCase() === "j") {
        e.preventDefault();
        setJklRateMultiplier(1);
        if (isPlaying) togglePlay();
        skipBackward();
      }

      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        createAnnotationAtPlayhead(e.shiftKey ? "arrow" : "outline");
      }

      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        createAnnotationAtPlayhead("blur");
      }

      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        createAnnotationAtPlayhead("text");
      }

      if (e.key === "1") {
        e.preventDefault();
        toggleTool("cut");
      }

      if (e.key === "2") {
        e.preventDefault();
        toggleTool("zoom");
      }

      if (e.key === "3") {
        e.preventDefault();
        toggleTool("speed");
      }

      if (e.key === "4") {
        e.preventDefault();
        toggleTool("annotation");
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedZoomId || selectedSpeedId || selectedAnnotationId || selectedSegmentId) {
          e.preventDefault();
          handleDeleteSelected();
        }
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const frameStep = (e.shiftKey ? 10 : 1) / 30;
        seek(Math.max(0, currentTime - frameStep));
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const frameStep = (e.shiftKey ? 10 : 1) / 30;
        seek(Math.min(duration, currentTime + frameStep));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    canUndo,
    canRedo,
    undo,
    redo,
    isPlaying,
    togglePlay,
    skipBackward,
    createAnnotationAtPlayhead,
    toggleTool,
    selectedZoomId,
    selectedSpeedId,
    selectedAnnotationId,
    selectedSegmentId,
    handleDeleteSelected,
    currentTime,
    duration,
    seek,
    setJklRateMultiplier,
  ]);
}
