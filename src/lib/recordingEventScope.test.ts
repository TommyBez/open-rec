import { describe, expect, it } from "vitest";
import {
  normalizeScopedProjectId,
  resolveScopedActiveProjectId,
  shouldHandleProjectScopedEvent,
} from "./recordingEventScope";

describe("recordingEventScope", () => {
  it("normalizes project ids by trimming and rejecting blanks", () => {
    expect(normalizeScopedProjectId(" project-1 ")).toBe("project-1");
    expect(normalizeScopedProjectId("   ")).toBeNull();
    expect(normalizeScopedProjectId(null)).toBeNull();
  });

  it("resolves active project id from first valid candidate", () => {
    expect(resolveScopedActiveProjectId(null, "  ", "primary-id", "secondary-id")).toBe(
      "primary-id"
    );
    expect(resolveScopedActiveProjectId(undefined, "fallback-id")).toBe("fallback-id");
    expect(resolveScopedActiveProjectId(null, "", "   ")).toBeNull();
  });

  it("accepts scoped events only for active/matching projects", () => {
    expect(shouldHandleProjectScopedEvent(null, "project-1")).toBe(false);
    expect(shouldHandleProjectScopedEvent("project-1", null)).toBe(true);
    expect(shouldHandleProjectScopedEvent("project-1", "project-1")).toBe(true);
    expect(shouldHandleProjectScopedEvent("project-1", " project-1 ")).toBe(true);
    expect(shouldHandleProjectScopedEvent("project-1", "project-2")).toBe(false);
  });
});
