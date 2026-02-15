import { beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultRuntimeTimeoutSettings,
  hasCustomRuntimeTimeoutSettings,
  loadRuntimeTimeoutSettings,
} from "./runtimeTimeoutSettings";

const SETTINGS_KEY = "openrec.runtime-timeout-settings-v1";

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: localStorageMock },
    configurable: true,
  });
  return storage;
}

describe("runtimeTimeoutSettings", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("returns defaults when no persisted value exists", () => {
    const settings = loadRuntimeTimeoutSettings();
    expect(settings).toEqual(getDefaultRuntimeTimeoutSettings());
    expect(hasCustomRuntimeTimeoutSettings(settings)).toBe(false);
  });

  it("loads persisted values and clamps invalid ranges", () => {
    const storage = installLocalStorageMock();
    storage.set(
      SETTINGS_KEY,
      JSON.stringify({
        recorderStartRecordingTimeoutMs: 500,
        recorderStopFinalizationTimeoutMs: 200_000,
        recorderOpenWidgetTimeoutMs: 700_000,
        recorderHideWindowTimeoutMs: 6_100.7,
        widgetStopRecordingTimeoutMs: "not-a-number",
        widgetPauseResumeTimeoutMs: 9_500,
        widgetStoppingRecoveryTimeoutMs: 0,
      })
    );

    const settings = loadRuntimeTimeoutSettings();
    expect(settings).toEqual({
      recorderStartRecordingTimeoutMs: 1_000,
      recorderStopFinalizationTimeoutMs: 200_000,
      recorderOpenWidgetTimeoutMs: 600_000,
      recorderHideWindowTimeoutMs: 6_101,
      widgetStopRecordingTimeoutMs: 150_000,
      widgetPauseResumeTimeoutMs: 9_500,
      widgetStoppingRecoveryTimeoutMs: 1_000,
    });
    expect(hasCustomRuntimeTimeoutSettings(settings)).toBe(true);
  });
});
