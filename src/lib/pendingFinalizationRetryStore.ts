const PENDING_FINALIZATION_RETRY_PROJECT_ID_KEY =
  "openrec.pending-finalization-retry-project-id";

let hasLoggedPendingRetryReadWarning = false;

function normalizeProjectId(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getPendingFinalizationRetryProjectId(): string | null {
  try {
    return normalizeProjectId(
      window.localStorage.getItem(PENDING_FINALIZATION_RETRY_PROJECT_ID_KEY)
    );
  } catch (error) {
    if (!hasLoggedPendingRetryReadWarning) {
      console.warn("Unable to read pending finalization retry project id.", error);
      hasLoggedPendingRetryReadWarning = true;
    }
    return null;
  }
}

export function setPendingFinalizationRetryProjectId(projectId: string): void {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) {
    clearPendingFinalizationRetryProjectId();
    return;
  }
  try {
    window.localStorage.setItem(
      PENDING_FINALIZATION_RETRY_PROJECT_ID_KEY,
      normalizedProjectId
    );
  } catch (error) {
    if (!hasLoggedPendingRetryReadWarning) {
      console.warn("Unable to store pending finalization retry project id.", error);
      hasLoggedPendingRetryReadWarning = true;
    }
  }
}

export function clearPendingFinalizationRetryProjectId(): void {
  try {
    window.localStorage.removeItem(PENDING_FINALIZATION_RETRY_PROJECT_ID_KEY);
  } catch (error) {
    if (!hasLoggedPendingRetryReadWarning) {
      console.warn("Unable to clear pending finalization retry project id.", error);
      hasLoggedPendingRetryReadWarning = true;
    }
  }
}
