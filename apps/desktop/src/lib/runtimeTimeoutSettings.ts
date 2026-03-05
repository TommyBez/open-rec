const RUNTIME_TIMEOUT_SETTINGS_KEY = "openrec.runtime-timeout-settings-v1";

const DEFAULT_RUNTIME_TIMEOUT_SETTINGS = {
  recorderStartRecordingTimeoutMs: 15_000,
  recorderStopFinalizationTimeoutMs: 180_000,
  recorderOpenWidgetTimeoutMs: 8_000,
  recorderHideWindowTimeoutMs: 5_000,
  widgetStopRecordingTimeoutMs: 150_000,
  widgetPauseResumeTimeoutMs: 10_000,
  widgetStoppingRecoveryTimeoutMs: 180_000,
} as const;

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 600_000;

export interface RuntimeTimeoutSettings {
  recorderStartRecordingTimeoutMs: number;
  recorderStopFinalizationTimeoutMs: number;
  recorderOpenWidgetTimeoutMs: number;
  recorderHideWindowTimeoutMs: number;
  widgetStopRecordingTimeoutMs: number;
  widgetPauseResumeTimeoutMs: number;
  widgetStoppingRecoveryTimeoutMs: number;
}

let hasLoggedSettingsReadWarning = false;
let hasLoggedSettingsParseWarning = false;

function clampTimeout(value: number): number {
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, value));
}

function normalizeTimeoutValue(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return clampTimeout(Math.round(value));
}

export function getDefaultRuntimeTimeoutSettings(): RuntimeTimeoutSettings {
  return { ...DEFAULT_RUNTIME_TIMEOUT_SETTINGS };
}

export function hasCustomRuntimeTimeoutSettings(
  settings: RuntimeTimeoutSettings
): boolean {
  const defaults = getDefaultRuntimeTimeoutSettings();
  return (
    settings.recorderStartRecordingTimeoutMs !== defaults.recorderStartRecordingTimeoutMs ||
    settings.recorderStopFinalizationTimeoutMs !== defaults.recorderStopFinalizationTimeoutMs ||
    settings.recorderOpenWidgetTimeoutMs !== defaults.recorderOpenWidgetTimeoutMs ||
    settings.recorderHideWindowTimeoutMs !== defaults.recorderHideWindowTimeoutMs ||
    settings.widgetStopRecordingTimeoutMs !== defaults.widgetStopRecordingTimeoutMs ||
    settings.widgetPauseResumeTimeoutMs !== defaults.widgetPauseResumeTimeoutMs ||
    settings.widgetStoppingRecoveryTimeoutMs !== defaults.widgetStoppingRecoveryTimeoutMs
  );
}

export function loadRuntimeTimeoutSettings(): RuntimeTimeoutSettings {
  const defaults = getDefaultRuntimeTimeoutSettings();
  try {
    const raw = window.localStorage.getItem(RUNTIME_TIMEOUT_SETTINGS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<RuntimeTimeoutSettings>;
    return {
      recorderStartRecordingTimeoutMs: normalizeTimeoutValue(
        parsed.recorderStartRecordingTimeoutMs,
        defaults.recorderStartRecordingTimeoutMs
      ),
      recorderStopFinalizationTimeoutMs: normalizeTimeoutValue(
        parsed.recorderStopFinalizationTimeoutMs,
        defaults.recorderStopFinalizationTimeoutMs
      ),
      recorderOpenWidgetTimeoutMs: normalizeTimeoutValue(
        parsed.recorderOpenWidgetTimeoutMs,
        defaults.recorderOpenWidgetTimeoutMs
      ),
      recorderHideWindowTimeoutMs: normalizeTimeoutValue(
        parsed.recorderHideWindowTimeoutMs,
        defaults.recorderHideWindowTimeoutMs
      ),
      widgetStopRecordingTimeoutMs: normalizeTimeoutValue(
        parsed.widgetStopRecordingTimeoutMs,
        defaults.widgetStopRecordingTimeoutMs
      ),
      widgetPauseResumeTimeoutMs: normalizeTimeoutValue(
        parsed.widgetPauseResumeTimeoutMs,
        defaults.widgetPauseResumeTimeoutMs
      ),
      widgetStoppingRecoveryTimeoutMs: normalizeTimeoutValue(
        parsed.widgetStoppingRecoveryTimeoutMs,
        defaults.widgetStoppingRecoveryTimeoutMs
      ),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      if (!hasLoggedSettingsParseWarning) {
        console.warn("Failed to parse runtime timeout settings. Using defaults.", error);
        hasLoggedSettingsParseWarning = true;
      }
      return defaults;
    }
    if (!hasLoggedSettingsReadWarning) {
      console.warn("Failed to load runtime timeout settings. Using defaults.", error);
      hasLoggedSettingsReadWarning = true;
    }
    return defaults;
  }
}
