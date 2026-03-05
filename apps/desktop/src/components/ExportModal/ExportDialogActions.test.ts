// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { ExportDialogActions } from "./ExportDialogActions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => undefined),
}));

describe("ExportDialogActions cancel interactions", () => {
  it("invokes cancel on mouse down while exporting", () => {
    const onCancelExport = vi.fn();
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(
        createElement(ExportDialogActions, {
          exportStatus: "exporting",
          jobId: "job-1",
          onClose,
          onRetry,
          onCancelExport,
        })
      );
    });

    const cancelButton = container.querySelector("button");
    if (!cancelButton) {
      throw new Error("Expected cancel button");
    }

    act(() => {
      cancelButton.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });

    expect(onCancelExport).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
