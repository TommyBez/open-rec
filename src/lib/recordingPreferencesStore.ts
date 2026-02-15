import { LazyStore } from "@tauri-apps/plugin-store";

export interface RecordingPreferences {
  sourceType: "display" | "window";
  selectedSourceId?: string | null;
  selectedSourceOrdinal?: number | null;
  captureCamera: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
  qualityPreset: "720p30" | "1080p30" | "1080p60" | "4k30" | "4k60";
  codec: "h264" | "hevc";
}

const store = new LazyStore("recording-preferences.json");
const PREF_KEY = "recordingPreferences";

export async function loadRecordingPreferences(): Promise<RecordingPreferences | null> {
  try {
    await store.init();
    const value = await store.get<RecordingPreferences>(PREF_KEY);
    return value ?? null;
  } catch (error) {
    console.error("Failed to load recording preferences from plugin store:", error);
    return null;
  }
}

export async function saveRecordingPreferences(
  preferences: RecordingPreferences
): Promise<void> {
  try {
    await store.init();
    await store.set(PREF_KEY, preferences);
  } catch (error) {
    console.error("Failed to save recording preferences to plugin store:", error);
  }
}
