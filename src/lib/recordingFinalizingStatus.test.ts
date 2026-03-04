import { describe, expect, it } from "vitest";
import {
  getRecordingFinalizingMessage,
  getRecordingWidgetStatusLabel,
} from "./recordingFinalizingStatus";

describe("recordingFinalizingStatus", () => {
  it("maps recorder finalization statuses to user-facing messages", () => {
    expect(getRecordingFinalizingMessage("stopping-capture")).toBe(
      "Stopping active capture streams…"
    );
    expect(getRecordingFinalizingMessage("concatenating-segments")).toBe(
      "Finalizing recording segments…"
    );
    expect(getRecordingFinalizingMessage("verifying-duration")).toBe(
      "Verifying recording duration…"
    );
    expect(getRecordingFinalizingMessage("verifying-dimensions")).toBe(
      "Verifying recording resolution…"
    );
    expect(getRecordingFinalizingMessage("saving-project")).toBe(
      "Saving project metadata…"
    );
    expect(getRecordingFinalizingMessage("refreshing-ui")).toBe(
      "Refreshing recorder views…"
    );
  });

  it("maps widget status labels to concise indicators", () => {
    expect(getRecordingWidgetStatusLabel("stopping-capture")).toBe("Stopping");
    expect(getRecordingWidgetStatusLabel("concatenating-segments")).toBe("Merging");
    expect(getRecordingWidgetStatusLabel("verifying-duration")).toBe("Verifying");
    expect(getRecordingWidgetStatusLabel("verifying-dimensions")).toBe("Verifying");
    expect(getRecordingWidgetStatusLabel("saving-project")).toBe("Saving");
    expect(getRecordingWidgetStatusLabel("refreshing-ui")).toBe("Syncing");
  });

  it("falls back safely when status is missing", () => {
    expect(getRecordingFinalizingMessage(null)).toBe("Stopping recording…");
    expect(getRecordingWidgetStatusLabel(null)).toBe("Stopping");
  });
});
