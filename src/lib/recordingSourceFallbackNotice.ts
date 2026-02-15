type RecordingSourceType = "display" | "window";

export interface PendingRecordingSourceFallbackNotice {
  projectId: string;
  sourceType: RecordingSourceType;
  sourceId: string;
  sourceOrdinal?: number | null;
}

const PENDING_RECORDING_SOURCE_FALLBACK_KEY = "pendingRecordingSourceFallback";

let hasLoggedReadError = false;
let hasLoggedWriteError = false;
let hasLoggedRemoveError = false;

function normalizeSourceOrdinal(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const normalized = Math.floor(value);
  if (normalized < 0) {
    return null;
  }
  return normalized;
}

function normalizePendingNotice(
  notice: PendingRecordingSourceFallbackNotice
): PendingRecordingSourceFallbackNotice | null {
  const projectId = notice.projectId.trim();
  const sourceId = notice.sourceId.trim();
  if (projectId.length === 0 || sourceId.length === 0) {
    return null;
  }
  return {
    projectId,
    sourceType: notice.sourceType,
    sourceId,
    sourceOrdinal: normalizeSourceOrdinal(notice.sourceOrdinal),
  };
}

function parsePendingNotice(
  rawValue: string | null
): PendingRecordingSourceFallbackNotice | null {
  if (!rawValue) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }
    const projectId = Reflect.get(parsed, "projectId");
    const sourceType = Reflect.get(parsed, "sourceType");
    const sourceId = Reflect.get(parsed, "sourceId");
    const sourceOrdinal = Reflect.get(parsed, "sourceOrdinal");
    if (typeof projectId !== "string" || typeof sourceId !== "string") {
      return null;
    }
    if (sourceType !== "display" && sourceType !== "window") {
      return null;
    }
    const normalizedNotice = normalizePendingNotice({
      projectId,
      sourceType,
      sourceId,
      sourceOrdinal: normalizeSourceOrdinal(sourceOrdinal),
    });
    return normalizedNotice;
  } catch {
    return null;
  }
}

export function getPendingRecordingSourceFallbackNotice(): PendingRecordingSourceFallbackNotice | null {
  try {
    const rawValue = sessionStorage.getItem(PENDING_RECORDING_SOURCE_FALLBACK_KEY);
    const parsedNotice = parsePendingNotice(rawValue);
    if (rawValue && !parsedNotice) {
      clearPendingRecordingSourceFallbackNotice();
    }
    return parsedNotice;
  } catch (error) {
    if (!hasLoggedReadError) {
      console.warn("Unable to read pending source fallback notice:", error);
      hasLoggedReadError = true;
    }
    return null;
  }
}

export function setPendingRecordingSourceFallbackNotice(
  notice: PendingRecordingSourceFallbackNotice
): void {
  const normalizedNotice = normalizePendingNotice(notice);
  if (!normalizedNotice) {
    clearPendingRecordingSourceFallbackNotice();
    return;
  }
  try {
    sessionStorage.setItem(
      PENDING_RECORDING_SOURCE_FALLBACK_KEY,
      JSON.stringify(normalizedNotice)
    );
  } catch (error) {
    if (!hasLoggedWriteError) {
      console.warn("Unable to store pending source fallback notice:", error);
      hasLoggedWriteError = true;
    }
  }
}

export function clearPendingRecordingSourceFallbackNotice(): void {
  try {
    sessionStorage.removeItem(PENDING_RECORDING_SOURCE_FALLBACK_KEY);
  } catch (error) {
    if (!hasLoggedRemoveError) {
      console.warn("Unable to clear pending source fallback notice:", error);
      hasLoggedRemoveError = true;
    }
  }
}
