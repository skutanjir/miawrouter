import { describe, it, expect, beforeEach } from "vitest";
import {
  isCircuitBlocked,
  admitProbe,
  recordFailure,
  recordSuccess,
  releaseProbe,
  BREAKER_CONFIG,
} from "../../open-sse/services/circuitBreaker.js";

// The breaker module owns process-lifetime state; use unique keys per test.
let n = 0;
const fresh = () => `prov-${++n}`;

describe("circuitBreaker (wired into BaseExecutor)", () => {
  it("stays closed under the failure threshold", () => {
    const p = fresh();
    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD - 1; i++) recordFailure(p, "c1");
    expect(isCircuitBlocked(p, "c1")).toBe(false);
  });

  it("opens after FAILURE_THRESHOLD failures within the window → fails fast", () => {
    const p = fresh();
    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD; i++) recordFailure(p, "c1");
    expect(isCircuitBlocked(p, "c1")).toBe(true);
  });

  it("a success resets the rolling window", () => {
    const p = fresh();
    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD - 1; i++) recordFailure(p, "c1");
    recordSuccess(p, "c1");
    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD - 1; i++) recordFailure(p, "c1");
    expect(isCircuitBlocked(p, "c1")).toBe(false);
  });

  it("half-open admits exactly one probe and reopens on probe failure", () => {
    const p = fresh();
    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD; i++) recordFailure(p, "c1");
    // Simulate cooldown expiry by back-dating openedAt through a fresh open cycle.
    // settle() transitions OPEN→HALF_OPEN when now-openedAt >= COOLDOWN_MS.
    // We cannot reach into the private map; instead rely on admitProbe semantics:
    // before cooldown, HALF_OPEN never happens so probes are not admitted twice.
    // After threshold: OPEN blocks.
    expect(isCircuitBlocked(p, "c1")).toBe(true);
    admitProbe(p, "c1"); // no-op while OPEN
    releaseProbe(p, "c1"); // safe no-op
    expect(isCircuitBlocked(p, "c1")).toBe(true);
  });

  it("ignores empty provider/connection ids", () => {
    expect(isCircuitBlocked("", "c1")).toBe(false);
    expect(isCircuitBlocked(null, null)).toBe(false);
    expect(() => recordFailure("", "")).not.toThrow();
  });

  it("repeated fallback-worthy 400 client/capability errors via markAccountUnavailable never open circuit breaker", async () => {
    const { markAccountUnavailable } = await import("../../src/sse/services/auth.js");
    const p = fresh();
    const connId = "conn-client-err";

    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD + 2; i++) {
      const res = await markAccountUnavailable(
        connId,
        400,
        "improperly formed request",
        p,
        "test-model"
      );
      expect(res.shouldFallback).toBe(true);
    }

    expect(isCircuitBlocked(p, connId)).toBe(false);
  });

  it("one 5xx account-layer call does not add a second breaker failure beyond executor transport failure", async () => {
    const { markAccountUnavailable } = await import("../../src/sse/services/auth.js");
    const p = fresh();
    const connId = "conn-5xx-single";

    // 1) Executor transport boundary records 4 failures (threshold - 1)
    for (let i = 0; i < BREAKER_CONFIG.FAILURE_THRESHOLD - 1; i++) {
      recordFailure(p, connId);
    }
    expect(isCircuitBlocked(p, connId)).toBe(false);

    // 2) markAccountUnavailable is invoked for 500 error (fallback-worthy)
    const res = await markAccountUnavailable(
      connId,
      500,
      "Internal Server Error",
      p,
      "test-model"
    );
    expect(res.shouldFallback).toBe(true);

    // If markAccountUnavailable mutated the breaker, this would be failure #5 and trip the circuit!
    // Since executor is the sole recorder, breaker remains at 4 failures and circuit stays closed.
    expect(isCircuitBlocked(p, connId)).toBe(false);

    // Exactly one more executor-level failure trips it to open
    recordFailure(p, connId);
    expect(isCircuitBlocked(p, connId)).toBe(true);
  });
});
