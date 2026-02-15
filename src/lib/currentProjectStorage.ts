const CURRENT_PROJECT_STORAGE_KEY = "currentProjectId";
let hasLoggedReadError = false;
let hasLoggedWriteError = false;
let hasLoggedRemoveError = false;

export function getStoredCurrentProjectId(): string | null {
  try {
    const value = localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
    if (value === null) {
      return null;
    }
    const normalized = value.trim();
    if (normalized.length === 0) {
      localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch (error) {
    if (!hasLoggedReadError) {
      console.warn("Unable to read current project id from storage:", error);
      hasLoggedReadError = true;
    }
    return null;
  }
}

export function setStoredCurrentProjectId(projectId: string): void {
  const normalized = projectId.trim();
  if (normalized.length === 0) {
    clearStoredCurrentProjectId();
    return;
  }
  try {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, normalized);
  } catch (error) {
    if (!hasLoggedWriteError) {
      console.warn("Unable to persist current project id:", error);
      hasLoggedWriteError = true;
    }
  }
}

export function clearStoredCurrentProjectId(): void {
  try {
    localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
  } catch (error) {
    if (!hasLoggedRemoveError) {
      console.warn("Unable to clear current project id from storage:", error);
      hasLoggedRemoveError = true;
    }
  }
}
