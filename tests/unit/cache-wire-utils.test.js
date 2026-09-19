import { describe, it, expect } from "vitest";
import {
  fmt,
  fmtBytes,
  computeEffectiveCacheLayers,
  getLayerStatus,
  normalizeState,
  createInitialState,
  parseCacheWireEvent,
} from "../../src/app/(dashboard)/dashboard/components/cacheWireUtils.js";

describe("cacheWireUtils - computeEffectiveCacheLayers", () => {
  it("defaults to standard configuration when settings are normal", () => {
    const settings = {
      cacheL1Enabled: true,
      cacheL2Enabled: true,
      cacheL3Enabled: true,
      privacyMode: "normal",
      semanticCacheModel: "text-embedding-3-small",
    };
    const effective = computeEffectiveCacheLayers(settings);
    expect(effective.L0).toBe(true);
    expect(effective.L1).toBe(true);
    expect(effective.L2).toBe(true);
    expect(effective.L3).toBe(true);
  });

  it("disables all cache layers (L1, L2, L3) under strict, private-no-cache, and local-only modes", () => {
    const modes = ["strict", "private-no-cache", "local-only"];
    for (const mode of modes) {
      const settings = {
        cacheL1Enabled: true,
        cacheL2Enabled: true,
        cacheL3Enabled: true,
        privacyMode: mode,
      };
      const effective = computeEffectiveCacheLayers(settings);
      expect(effective.L0).toBe(true); // L0 provider prompt cache remains capability/provider-driven
      expect(effective.L1).toBe(false);
      expect(effective.L2).toBe(false);
      expect(effective.L3).toBe(false);
      expect(effective.privacyMode).toBe(mode);
    }
  });

  it("in private-cache mode, allows L1 and L3 if configured, but disables non-local L2", () => {
    const remoteSettings = {
      cacheL1Enabled: true,
      cacheL2Enabled: true,
      cacheL3Enabled: true,
      privacyMode: "private-cache",
      semanticCacheModel: "text-embedding-3-small",
    };
    const remoteEffective = computeEffectiveCacheLayers(remoteSettings);
    expect(remoteEffective.L1).toBe(true);
    expect(remoteEffective.L2).toBe(false);
    expect(remoteEffective.L3).toBe(true);

    const localSettings = {
      cacheL1Enabled: true,
      cacheL2Enabled: true,
      cacheL3Enabled: true,
      privacyMode: "private-cache",
      semanticCacheModel: "ollama/all-minilm",
    };
    const localEffective = computeEffectiveCacheLayers(localSettings);
    expect(localEffective.L1).toBe(true);
    expect(localEffective.L2).toBe(true);
    expect(localEffective.L3).toBe(true);
  });
});

describe("cacheWireUtils - getLayerStatus", () => {
  it("returns correct layer statuses and streaming notices", () => {
    const state = {
      hits: { L0: 5, L1: 0, L2: 2 },
      events: 7,
      savings: { refs: 10, bytes: 2048 },
    };
    const config = {
      L0: true,
      L1: true,
      L2: true,
      L3: true,
      privacyMode: "normal",
    };

    const l0 = getLayerStatus("L0", state, config);
    expect(l0.enabled).toBe(true);
    expect(l0.statusLabel).toBe("5 hits");
    expect(l0.hasHits).toBe(true);

    const l1 = getLayerStatus("L1", state, config);
    expect(l1.enabled).toBe(true);
    expect(l1.statusLabel).toBe("No hits yet");
    expect(l1.notice).toContain("Non-streaming only");

    const l2 = getLayerStatus("L2", state, config);
    expect(l2.enabled).toBe(true);
    expect(l2.statusLabel).toBe("2 hits");
    expect(l2.notice).toContain("Non-streaming only");

    const l3 = getLayerStatus("L3", state, config);
    expect(l3.enabled).toBe(true);
    expect(l3.statusLabel).toBe("10 refs");
    expect(l3.subDetail).toBe("2.0 KB saved");
  });

  it("marks disabled layers clearly with privacy reason when overridden", () => {
    const state = { hits: { L0: 0, L1: 0, L2: 0 }, savings: { refs: 0, bytes: 0 } };
    const config = {
      L0: true,
      L1: false,
      L2: false,
      L3: false,
      privacyMode: "strict",
    };
    const l1 = getLayerStatus("L1", state, config);
    expect(l1.enabled).toBe(false);
    expect(l1.statusLabel).toBe("Disabled");
    expect(l1.reason).toBe("privacy: strict");
  });
});

describe("cacheWireUtils - parseCacheWireEvent & validation", () => {
  it("validates finite similarity and rejects NaN/Infinity/out-of-range", () => {
    const rawHitValid = {
      type: "cache_l2",
      action: "hit",
      similarity: 0.942,
    };
    const parsedValid = parseCacheWireEvent(rawHitValid);
    expect(parsedValid.label).toBe("L2 hit · 94.2%");

    const rawHitNaN = {
      type: "cache_l2",
      action: "hit",
      similarity: NaN,
    };
    const parsedNaN = parseCacheWireEvent(rawHitNaN);
    expect(parsedNaN.label).toBe("L2 hit");

    const rawHitInf = {
      type: "cache_l2",
      action: "hit",
      similarity: Infinity,
    };
    const parsedInf = parseCacheWireEvent(rawHitInf);
    expect(parsedInf.label).toBe("L2 hit");
  });

  it("clamps refs and bytesSaved >= 0 before accumulation", () => {
    const rawL3Negative = {
      type: "cache_l3",
      refs: -5,
      bytesSaved: -1024,
    };
    const parsed = parseCacheWireEvent(rawL3Negative);
    expect(parsed.refs).toBe(0);
    expect(parsed.bytesSaved).toBe(0);

    const rawL3Valid = {
      type: "cache_l3",
      refs: 3,
      bytesSaved: 4096,
    };
    const parsedValid = parseCacheWireEvent(rawL3Valid);
    expect(parsedValid.refs).toBe(3);
    expect(parsedValid.bytesSaved).toBe(4096);
  });

  it("extracts truthful outcome for misses, hits, probes, and dedup", () => {
    expect(parseCacheWireEvent({ type: "cache_l1", action: "miss" })?.outcome).toBe("miss");
    expect(parseCacheWireEvent({ type: "cache_l1", action: "hit" })?.outcome).toBe("hit");
    expect(parseCacheWireEvent({ type: "cache_l2", action: "miss" })?.outcome).toBe("miss");
    expect(parseCacheWireEvent({ type: "cache_l2", action: "hit" })?.outcome).toBe("hit");
    expect(parseCacheWireEvent({ type: "cache_usage", cacheRead: 500 })?.outcome).toBe("hit");
    expect(parseCacheWireEvent({ type: "cache_usage", cacheRead: 0 })?.outcome).toBe("miss");
    expect(parseCacheWireEvent({ type: "cache_probe" })?.outcome).toBe("probe");
    expect(parseCacheWireEvent({ type: "cache_l3", action: "dedup" })?.outcome).toBe("dedup");
  });

  it("handles malformed events gracefully returning null or sanitized structures", () => {
    expect(parseCacheWireEvent(null)).toBeNull();
    expect(parseCacheWireEvent(undefined)).toBeNull();
    expect(parseCacheWireEvent("not an object")).toBeNull();
    expect(parseCacheWireEvent(42)).toBeNull();
    expect(parseCacheWireEvent([])).toBeNull();
    expect(parseCacheWireEvent({})).toEqual({
      layer: null,
      kind: null,
      label: null,
      outcome: null,
      validSim: null,
      refs: 0,
      bytesSaved: 0,
    });
  });
});

describe("cacheWireUtils - state normalization & backward compatibility", () => {
  it("creates initial state with zeroed lookups, misses, and hits", () => {
    const s = createInitialState();
    expect(s.hits).toEqual({ L0: 0, L1: 0, L2: 0 });
    expect(s.misses).toEqual({ L0: 0, L1: 0, L2: 0 });
    expect(s.lookups).toEqual({ L0: 0, L1: 0, L2: 0 });
    expect(s.events).toBe(0);
  });

  it("normalizes v3 valid state correctly", () => {
    const raw = {
      hits: { L0: 2, L1: 4, L2: 0 },
      misses: { L0: 1, L1: 2, L2: 1 },
      lookups: { L0: 3, L1: 6, L2: 1 },
      events: 10,
      savings: { refs: 5, bytes: 1024 },
      interlock: { restored: 1, stable: 2, breakpoints: 4 },
      latest: "latest event line",
    };
    const normalized = normalizeState(raw);
    expect(normalized).not.toBeNull();
    expect(normalized.hits.L0).toBe(2);
    expect(normalized.misses.L1).toBe(2);
    expect(normalized.lookups.L0).toBe(3);
    expect(normalized.events).toBe(10);
  });

  it("rejects stale v2 shape without misses/lookups and triggers safe migration reset", () => {
    const staleV2 = {
      hits: { L0: 10, L1: 5, L2: 2 },
      events: 20,
      savings: { refs: 1, bytes: 50 },
      interlock: { restored: 0, stable: 1, breakpoints: 2 },
      latest: "old v2 line",
    };
    // Should return null so storage resets rather than corrupting state
    expect(normalizeState(staleV2)).toBeNull();
  });

  it("handles corrupted/malformed state inputs safely", () => {
    expect(normalizeState(null)).toBeNull();
    expect(normalizeState(undefined)).toBeNull();
    expect(normalizeState("string")).toBeNull();
    expect(normalizeState(123)).toBeNull();
    expect(normalizeState([])).toBeNull();
  });
});

describe("cacheWireUtils - Layer health distinction & truthful metrics", () => {
  it("distinguishes loading, error, disabled, privacy restricted, and active", () => {
    // 1. Loading state (config is null)
    const loadingStatus = getLayerStatus("L1", { hits: {}, misses: {}, lookups: {} }, null);
    expect(loadingStatus.statusLabel).toBe("Loading…");
    expect(loadingStatus.badgeText).toBe("loading");
    expect(loadingStatus.enabled).toBe(false);

    // 2. Error state (config fetch failed)
    const errorStatus = getLayerStatus("L1", { hits: {}, misses: {}, lookups: {} }, { error: true });
    expect(errorStatus.statusLabel).toBe("Error");
    expect(errorStatus.badgeText).toBe("error");
    expect(errorStatus.reason).toBe("config fetch error");

    // 3. Disabled in settings
    const disabledStatus = getLayerStatus(
      "L1",
      { hits: {}, misses: {}, lookups: {} },
      { L1: false, privacyMode: "normal", loaded: true }
    );
    expect(disabledStatus.statusLabel).toBe("Disabled");
    expect(disabledStatus.reason).toBe("disabled in settings");

    // 4. Privacy restricted
    const privacyStatus = getLayerStatus(
      "L1",
      { hits: {}, misses: {}, lookups: {} },
      { L1: false, privacyMode: "strict", loaded: true }
    );
    expect(privacyStatus.statusLabel).toBe("Disabled");
    expect(privacyStatus.reason).toBe("privacy: strict");

    // 5. Active with no events (truthful zero/idle, no guessing)
    const activeIdle = getLayerStatus(
      "L1",
      { hits: { L1: 0 }, misses: { L1: 0 }, lookups: { L1: 0 } },
      { L1: true, privacyMode: "normal", loaded: true }
    );
    expect(activeIdle.enabled).toBe(true);
    expect(activeIdle.hitRate).toBeNull(); // Never guess hit rate with 0 lookups
    expect(activeIdle.statusLabel).toBe("No hits yet");

    // 6. Active with hits and misses: truthful hit rate computed
    const activeWithMetrics = getLayerStatus(
      "L1",
      { hits: { L1: 3 }, misses: { L1: 1 }, lookups: { L1: 4 } },
      { L1: true, privacyMode: "normal", loaded: true }
    );
    expect(activeWithMetrics.enabled).toBe(true);
    expect(activeWithMetrics.hitRate).toBe(75);
    expect(activeWithMetrics.badgeText).toBe("75% hit");
    expect(activeWithMetrics.statusLabel).toBe("3 hits · 1 misses");

    // 7. L3 Dedup truthfully reports no hit rate
    const l3Status = getLayerStatus(
      "L3",
      { savings: { refs: 5, bytes: 2048 } },
      { L3: true, privacyMode: "normal", loaded: true }
    );
    expect(l3Status.hitRate).toBeNull();
    expect(l3Status.subDetail).toBe("2.0 KB saved");
  });
});
