const CURRENT_PROJECT_STORAGE_KEY = "currentProjectId";
let hasLoggedReadError = false;
let hasLoggedWriteError = false;
let hasLoggedRemoveError = false;

export function getStoredCurrentProjectId(): string | null {
  try {
    return localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
  } catch (error) {
    if (!hasLoggedReadError) {
      console.warn("Unable to read current project id from storage:", error);
      hasLoggedReadError = true;
    }
    return null;
  }
}

export function setStoredCurrentProjectId(projectId: string): void {
  try {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
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
