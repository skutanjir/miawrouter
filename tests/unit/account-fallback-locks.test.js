import { describe, it, expect } from "vitest";
import {
  isModelLockActive,
  buildClearModelLocksUpdate,
} from "../../open-sse/services/accountFallback.js";

describe("accountFallback lock behavior", () => {
  it("does not let an expired model lock bypass an active account-level lock", () => {
    const now = Date.now();
    const expiredPast = new Date(now - 60000).toISOString();
    const activeFuture = new Date(now + 3600000).toISOString();

    const connection = {
      modelLock_gpt4: expiredPast,
      modelLock___all: activeFuture,
    };

    // Before fix: connection["modelLock_gpt4"] evaluated truthy, expiry was expiredPast,
    // so isModelLockActive returned false, allowing requests on a locked account!
    expect(isModelLockActive(connection, "gpt4")).toBe(true);
  });

  it("returns active when model-specific lock is active even if account-level lock is absent", () => {
    const activeFuture = new Date(Date.now() + 3600000).toISOString();
    const connection = {
      modelLock_claude: activeFuture,
    };
    expect(isModelLockActive(connection, "claude")).toBe(true);
    expect(isModelLockActive(connection, "gpt4")).toBe(false);
  });

  it("buildClearModelLocksUpdate does not throw on null or undefined connection", () => {
    expect(() => buildClearModelLocksUpdate(null)).not.toThrow();
    expect(buildClearModelLocksUpdate(null)).toEqual({});
    expect(() => buildClearModelLocksUpdate(undefined)).not.toThrow();
    expect(buildClearModelLocksUpdate(undefined)).toEqual({});
  });
});
