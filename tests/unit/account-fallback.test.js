import { describe, expect, it } from "vitest";
import {
  buildModelRotationUpdate,
  getModelRotationState,
  checkFallbackError,
} from "../../open-sse/services/accountFallback.js";

describe("per-model account rotation state", () => {
  it("does not retry malformed or invalid requests on another account", () => {
    for (const status of [400, 422, 499]) {
      expect(checkFallbackError(status, "invalid request")).toMatchObject({ shouldFallback: false, cooldownMs: 0 });
    }
    expect(checkFallbackError(429, "rate limit").shouldFallback).toBe(true);
  });
  it("prefers the model-specific cursor and preserves other model cursors", () => {
    const connection = {
      lastUsedAt: "2026-01-01T00:00:00.000Z",
      consecutiveUseCount: 1,
      modelRotation: {
        "claude-sonnet-4-6": {
          lastUsedAt: "2026-09-10T10:00:00.000Z",
          consecutiveUseCount: 2,
        },
      },
    };

    expect(getModelRotationState(connection, "claude-sonnet-4-6")).toEqual({
      lastUsedAt: "2026-09-10T10:00:00.000Z",
      consecutiveUseCount: 2,
    });
    expect(buildModelRotationUpdate(connection, "gemini-3.8-flash-high", {
      lastUsedAt: "2026-09-10T10:01:00.000Z",
      consecutiveUseCount: 1,
    })).toEqual({
      modelRotation: {
        "claude-sonnet-4-6": {
          lastUsedAt: "2026-09-10T10:00:00.000Z",
          consecutiveUseCount: 2,
        },
        "gemini-3.8-flash-high": {
          lastUsedAt: "2026-09-10T10:01:00.000Z",
          consecutiveUseCount: 1,
        },
      },
    });
  });

  it("falls back to legacy account rotation fields for old connections", () => {
    expect(getModelRotationState({
      lastUsedAt: "2026-09-10T10:00:00.000Z",
      consecutiveUseCount: 3,
    }, "gemini-3.8-flash-high")).toEqual({
      lastUsedAt: "2026-09-10T10:00:00.000Z",
      consecutiveUseCount: 3,
    });
  });
});
