import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingFinalizationRetryProjectId,
  getPendingFinalizationRetryProjectId,
  setPendingFinalizationRetryProjectId,
} from "./pendingFinalizationRetryStore";

const STORAGE_KEY = "openrec.pending-finalization-retry-project-id";

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
  Object.defineProperty(globalThis, "window", {
    value: { localStorage: localStorageMock },
    configurable: true,
  });
  return storage;
}

describe("pendingFinalizationRetryStore", () => {
  beforeEach(() => {
    installLocalStorageMock();
  });

  it("stores and reads normalized project ids", () => {
    setPendingFinalizationRetryProjectId("  project-123  ");
    expect(getPendingFinalizationRetryProjectId()).toBe("project-123");
  });

  it("clears project id when value is blank", () => {
    const storage = installLocalStorageMock();
    storage.set(STORAGE_KEY, "existing");

    setPendingFinalizationRetryProjectId("   ");
    expect(getPendingFinalizationRetryProjectId()).toBeNull();
  });

  it("clears value explicitly", () => {
    setPendingFinalizationRetryProjectId("project-abc");
    clearPendingFinalizationRetryProjectId();
    expect(getPendingFinalizationRetryProjectId()).toBeNull();
  });
});
