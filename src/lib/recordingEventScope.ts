export function normalizeScopedProjectId(projectId: string | null | undefined): string | null {
  if (!projectId) {
    return null;
  }
  const normalized = projectId.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveScopedActiveProjectId(
  ...candidateProjectIds: Array<string | null | undefined>
): string | null {
  for (const candidate of candidateProjectIds) {
    const normalized = normalizeScopedProjectId(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

export function shouldHandleProjectScopedEvent(
  activeProjectId: string | null | undefined,
  eventProjectId: string | null | undefined
): boolean {
  const normalizedActiveProjectId = normalizeScopedProjectId(activeProjectId);
  if (!normalizedActiveProjectId) {
    return false;
  }
  const normalizedEventProjectId = normalizeScopedProjectId(eventProjectId);
  if (!normalizedEventProjectId) {
    return true;
  }
  return normalizedEventProjectId === normalizedActiveProjectId;
}
