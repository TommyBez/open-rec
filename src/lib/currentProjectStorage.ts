const CURRENT_PROJECT_STORAGE_KEY = "currentProjectId";

export function getStoredCurrentProjectId(): string | null {
  return localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
}

export function setStoredCurrentProjectId(projectId: string): void {
  localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, projectId);
}

export function clearStoredCurrentProjectId(): void {
  localStorage.removeItem(CURRENT_PROJECT_STORAGE_KEY);
}
