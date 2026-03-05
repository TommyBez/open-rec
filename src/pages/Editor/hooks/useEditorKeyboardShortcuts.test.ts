// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface KeyboardHarnessProps {
  canUndo?: boolean;
  canRedo?: boolean;
  undo?: () => void;
  redo?: () => void;
}

function mountKeyboardHarness(props: KeyboardHarnessProps = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const undo = props.undo ?? vi.fn();
  const redo = props.redo ?? vi.fn();

  function Harness() {
    useEditorKeyboardShortcuts({
      canUndo: props.canUndo ?? true,
      canRedo: props.canRedo ?? true,
      undo,
      redo,
      saveProjectNow: vi.fn(),
      isPlaying: false,
      togglePlay: vi.fn(),
      skipBackward: vi.fn(),
      toggleTool: vi.fn(),
      selectedZoomId: null,
      selectedSpeedId: null,
      selectedAnnotationId: null,
      selectedSegmentId: null,
      handleDeleteSelected: vi.fn(),
      duplicateSelectedAnnotation: vi.fn(),
      openProjectWindow: vi.fn(),
      nudgeSelectedAnnotation: vi.fn(),
      currentTime: 0,
      duration: 10,
      seek: vi.fn(),
      createAnnotationAtPlayhead: vi.fn(),
      setJklRateMultiplier: vi.fn(),
    });
    return null;
  }

  act(() => {
    root.render(createElement(Harness));
  });

  return {
    undo,
    redo,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("useEditorKeyboardShortcuts redo key handling", () => {
  const mounts: Array<{ unmount: () => void }> = [];

  afterEach(() => {
    while (mounts.length > 0) {
      mounts.pop()?.unmount();
    }
  });

  it("triggers redo for Ctrl+Shift+Z with uppercase key", () => {
    const harness = mountKeyboardHarness();
    mounts.push(harness);

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Z",
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        })
      );
    });

    expect(harness.redo).toHaveBeenCalledTimes(1);
  });

  it("triggers redo for Ctrl+Y", () => {
    const harness = mountKeyboardHarness();
    mounts.push(harness);

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "y",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    expect(harness.redo).toHaveBeenCalledTimes(1);
  });

  it("still triggers redo callback even when canRedo flag is false", () => {
    const harness = mountKeyboardHarness({ canRedo: false });
    mounts.push(harness);

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "y",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    expect(harness.redo).toHaveBeenCalledTimes(1);
  });

  it("still triggers undo callback even when canUndo flag is false", () => {
    const harness = mountKeyboardHarness({ canUndo: false });
    mounts.push(harness);

    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "z",
          ctrlKey: true,
          bubbles: true,
        })
      );
    });

    expect(harness.undo).toHaveBeenCalledTimes(1);
  });
});
