import { describe, expect, it } from "vitest";
import { isMissingFinalizationRetryContextMessage } from "./finalizationRetry";

describe("finalizationRetry", () => {
  it("detects missing retry context errors", () => {
    expect(
      isMissingFinalizationRetryContextMessage(
        "No failed finalization context is available for retry."
      )
    ).toBe(true);
    expect(
      isMissingFinalizationRetryContextMessage(
        "Error: No failed finalization context is available for retry."
      )
    ).toBe(true);
  });

  it("ignores unrelated retry failures", () => {
    expect(
      isMissingFinalizationRetryContextMessage(
        "Recording finalization retry timed out after 120 seconds."
      )
    ).toBe(false);
    expect(isMissingFinalizationRetryContextMessage("")).toBe(false);
    expect(isMissingFinalizationRetryContextMessage(null)).toBe(false);
  });
});
