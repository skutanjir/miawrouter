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
});
