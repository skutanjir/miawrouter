/**
 * Reusable capability-adaptive prompt-cache contract.
 *
 * Every provider declares its cache mode in
 * `open-sse/providers/cacheCapabilities.js`. This runner turns those
 * declarations into assertions, so no provider is forced into another vendor's
 * dialect:
 *
 *   explicit — after the prefix is observed twice, L0 may insert breakpoint
 *              markers on it.
 *   implicit — the stable prefix must survive byte-identical with NO marker
 *              field injected: the provider caches on its own.
 *   none     — same request-side discipline as implicit.
 *   unknown  — conservative: never inject a vendor field we have no evidence
 *              for, and never assert the provider lacks caching either.
 *
 * Two L0 semantics this contract pins down, because both are load-bearing:
 *
 *  1. STABILITY GATE — breakpoints are only inserted once the same prefix has
 *     been seen twice (STABLE_TURNS). A cold first turn must carry no marker.
 *  2. PREFIX IDENTITY — `cache_probe.prefixHash` is a cache_control-stripped
 *     hash of system + tools + message prefix. It must be identical when the
 *     prefix is unchanged and different when system, tools, their order, or
 *     prior history change. That hash is the cacheability contract.
 */

import { describe, it, expect } from "vitest";
import { begin, finish, countBreakpoints, _resetCacheState } from "../../open-sse/cache/l0.js";
import {
  CACHE_MODE,
  CACHE_MARKER,
  resolveCacheCapability,
  listCacheModes,
} from "../../open-sse/providers/cacheCapabilities.js";
import { canonicalizeUsage } from "../../open-sse/utils/usageTracking.js";

/** A tool-heavy coding request: stable prefix (system + tools + history) plus a mutable tail. */
export function cacheContractBody({ tail = "latest tail turn", system = "base", tools = "base", history = "base" } = {}) {
  const systems = {
    base: "You are a coding agent working in a repository.",
    changed: "You are a coding agent working in a repository. Be terse.",
  };
  const toolSets = {
    base: [
      { type: "function", function: { name: "read_file", description: "read a file", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "write_file", description: "write a file", parameters: { type: "object", properties: {} } } },
    ],
    reordered: [
      { type: "function", function: { name: "write_file", description: "write a file", parameters: { type: "object", properties: {} } } },
      { type: "function", function: { name: "read_file", description: "read a file", parameters: { type: "object", properties: {} } } },
    ],
    changed: [
      { type: "function", function: { name: "read_file", description: "read a file", parameters: { type: "object", properties: {} } } },
    ],
  };
  const histories = {
    base: [
      { role: "user", content: "first turn" },
      { role: "assistant", content: "ok" },
    ],
    changed: [
      { role: "user", content: "a different first turn" },
      { role: "assistant", content: "ok" },
    ],
  };
  return {
    model: "contract-model",
    system: [{ type: "text", text: systems[system] }],
    messages: [...histories[history], { role: "user", content: tail }],
    tools: toolSets[tools],
  };
}

/** One L0 pass. Returns the probe event so callers can read prefixHash/turns/stable. */
function driveOnce({ provider, format, body, cacheKey, capability = null, onCacheEvent = null }) {
  const cap = capability || resolveCacheCapability(provider, format);
  let probe = null;
  const state = begin(body);
  const out = finish(body, state, {
    cacheKey,
    provider,
    model: "contract-model",
    capability: cap,
    onCacheEvent: (e) => {
      if (e.type === "cache_probe") probe = e;
      onCacheEvent?.(e);
    },
  });
  return { out, capability: cap, probe };
}

/** Two passes over the same prefix — required before the stability gate opens. */
function driveWarm(opts) {
  driveOnce(opts);
  return driveOnce(opts);
}

/** Every assertion a provider must satisfy for its declared mode. */
export function runCacheContract(provider, format) {
  const capability = resolveCacheCapability(provider, format);
  const isExplicit = capability.mode === CACHE_MODE.EXPLICIT;
  const label = `${provider}/${format} (${capability.mode})`;
  const key = (s) => `${label}:${s}`;

  it(`${label}: declares a coherent capability record`, () => {
    expect(Object.values(CACHE_MODE)).toContain(capability.mode);
    expect(typeof capability.evidence).toBe("string");
    expect(capability.evidence.length).toBeGreaterThan(0);
    if (capability.supportsCacheMarkers) {
      expect(capability.mode).toBe(CACHE_MODE.EXPLICIT);
      expect(capability.marker).toBe(CACHE_MARKER.ANTHROPIC);
    } else {
      expect(capability.marker).toBe(CACHE_MARKER.NONE);
    }
  });

  it(`${label}: honors the two-turn stability gate before injecting markers`, () => {
    _resetCacheState();
    const cold = driveOnce({ provider, format, body: cacheContractBody(), cacheKey: key("gate") });
    expect(cold.out.info.stable).toBe(false);
    expect(cold.out.info.markerInserted, "a cold prefix must never be marked").toBe(false);
    expect(cold.probe.breakpoints).toBe(0);

    const warm = driveOnce({ provider, format, body: cacheContractBody(), cacheKey: key("gate") });
    expect(warm.out.info.stable).toBe(true);
    if (isExplicit) {
      expect(warm.out.info.markerInserted, "explicit provider must be marked once stable").toBe(true);
      expect(warm.out.info.breakpoints).toBeGreaterThan(0);
      expect(warm.out.info.breakpoints).toBeLessThanOrEqual(4);
    } else {
      expect(warm.out.info.markerInserted, "non-explicit provider must never be marked").toBe(false);
      expect(warm.probe.breakpoints).toBe(0);
    }
  });

  it(`${label}: never leaks a marker field into a non-explicit body`, () => {
    _resetCacheState();
    const warm = driveWarm({ provider, format, body: cacheContractBody(), cacheKey: key("leak") });
    const serialized = JSON.stringify(warm.out.body);
    if (isExplicit) {
      expect(serialized).toContain("cache_control");
    } else {
      expect(serialized, "no vendor cache field may be invented").not.toContain("cache_control");
      expect(serialized).not.toContain("cachedContent");
      expect(serialized).not.toContain("prompt_cache");
    }
  });

  it(`${label}: identical repeated prompt keeps an identical prefix hash`, () => {
    _resetCacheState();
    const first = driveOnce({ provider, format, body: cacheContractBody({ tail: "turn 1" }), cacheKey: key("repeat") });
    const second = driveOnce({ provider, format, body: cacheContractBody({ tail: "turn 2" }), cacheKey: key("repeat") });
    expect(second.probe.prefixHash).toBe(first.probe.prefixHash);
    expect(second.probe.turns).toBeGreaterThan(first.probe.turns);
    expect(second.out.info.stable).toBe(true);
  });

  it(`${label}: a stable prefix plus a new tail preserves the prefix`, () => {
    _resetCacheState();
    const first = driveOnce({ provider, format, body: cacheContractBody({ tail: "old tail" }), cacheKey: key("append") });
    const grown = driveOnce({ provider, format, body: cacheContractBody({ tail: "brand new tail" }), cacheKey: key("append") });
    const tail = grown.out.body.messages[grown.out.body.messages.length - 1];
    expect(tail.content).toBe("brand new tail");
    expect(grown.probe.prefixHash, "an appended tail must not disturb the prefix").toBe(first.probe.prefixHash);
    expect(grown.out.info.restored, "no saver ran, so nothing needs restoring").toBe(false);
  });

  it(`${label}: changing the system prompt changes the prefix hash`, () => {
    _resetCacheState();
    const base = driveOnce({ provider, format, body: cacheContractBody({ system: "base" }), cacheKey: key("sys") });
    const changed = driveOnce({ provider, format, body: cacheContractBody({ system: "changed" }), cacheKey: key("sys") });
    expect(changed.probe.prefixHash).not.toBe(base.probe.prefixHash);
    expect(changed.probe.turns, "a rewritten prefix resets the stability gate").toBe(1);
    expect(changed.out.body.system[0].text).toContain("Be terse");
  });

  it(`${label}: changing the tool set changes the prefix hash`, () => {
    _resetCacheState();
    const base = driveOnce({ provider, format, body: cacheContractBody({ tools: "base" }), cacheKey: key("tools") });
    const changed = driveOnce({ provider, format, body: cacheContractBody({ tools: "changed" }), cacheKey: key("tools") });
    expect(changed.probe.prefixHash).not.toBe(base.probe.prefixHash);
    expect(changed.out.body.tools.length).toBe(1);
  });

  it(`${label}: tool reordering changes the prefix hash`, () => {
    _resetCacheState();
    const base = driveOnce({ provider, format, body: cacheContractBody({ tools: "base" }), cacheKey: key("toolorder") });
    const reordered = driveOnce({ provider, format, body: cacheContractBody({ tools: "reordered" }), cacheKey: key("toolorder") });
    expect(reordered.probe.prefixHash, "tool order is part of the cacheable prefix").not.toBe(base.probe.prefixHash);
    expect(reordered.out.body.tools[0].function.name).toBe("write_file");
  });

  it(`${label}: changing prior history changes the prefix hash`, () => {
    _resetCacheState();
    const base = driveOnce({ provider, format, body: cacheContractBody({ history: "base" }), cacheKey: key("history") });
    const changed = driveOnce({ provider, format, body: cacheContractBody({ history: "changed" }), cacheKey: key("history") });
    expect(changed.probe.prefixHash).not.toBe(base.probe.prefixHash);
    expect(changed.out.body.messages[0].content).toBe("a different first turn");
  });

  it(`${label}: a client-supplied marker is never rewritten`, () => {
    const clientMarker = { type: "ephemeral", ttl: "1h" };
    const body = cacheContractBody();
    body.system = [{ type: "text", text: "sys", cache_control: clientMarker }];
    const { out } = driveWarm({ provider, format, body, cacheKey: key("client") });
    expect(out.body.system[0].cache_control).toEqual(clientMarker);
  });

  it(`${label}: keeps the marker count within Anthropic's ceiling`, () => {
    _resetCacheState();
    const warm = driveWarm({ provider, format, body: cacheContractBody(), cacheKey: key("cap") });
    expect(countBreakpoints(warm.out.body)).toBeLessThanOrEqual(4);
    expect(warm.probe.breakpoints).toBe(countBreakpoints(warm.out.body));
  });

  it(`${label}: probe event reports the declared mode`, () => {
    const warm = driveWarm({ provider, format, body: cacheContractBody(), cacheKey: key("probe") });
    expect(warm.probe.cacheMode).toBe(capability.mode);
  });
}

/** Usage-side half of the contract, independent of marker support. */
export function runUsageContract(provider, format, cases) {
  describe(`${provider}/${format} usage contract`, () => {
    for (const [name, { payload, expect: expected }] of Object.entries(cases || {})) {
      it(`canonicalizes ${name}`, () => {
        const out = canonicalizeUsage(payload);
        for (const [k, v] of Object.entries(expected)) {
          expect(out[k], `${name}.${k}`).toBe(v);
        }
      });
    }
  });
}

/** Wrap `runCacheContract` in a describe block and return the resolved capability. */
export function describeCacheContract(provider, format) {
  describe(`cache contract: ${provider}`, () => {
    runCacheContract(provider, format);
  });
  return resolveCacheCapability(provider, format);
}

/** Declarations must never turn "no evidence" into "unsupported". */
export function assertCapabilityDeclarations() {
  it("unknown evidence is always mode unknown", () => {
    for (const rec of listCacheModes()) {
      if (!rec.evidence || rec.evidence === "unknown") {
        expect(rec.mode, `${rec.key} must stay unknown without evidence`).toBe(CACHE_MODE.UNKNOWN);
      }
    }
  });
}
