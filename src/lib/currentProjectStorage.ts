const CURRENT_PROJECT_STORAGE_KEY = "currentProjectId";

export function getStoredCurrentProjectId(): string | null {
  try {
    return localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read current project id from storage:", error);
    return null;
  }
}

export function setStoredCurrentProjectId(projectId: string): void {
  try {
    localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
  } catch (error) {
    console.warn("Unable to persist current project id:", error);
  }
}

export function clearStoredCurrentProjectId(): void {
  try {
    localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear current project id from storage:", error);
  }
}
