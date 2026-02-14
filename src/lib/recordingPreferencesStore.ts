import { LazyStore } from "@tauri-apps/plugin-store";

export interface RecordingPreferences {
  sourceType: "display" | "window";
  captureCamera: boolean;
  captureMicrophone: boolean;
  captureSystemAudio: boolean;
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
