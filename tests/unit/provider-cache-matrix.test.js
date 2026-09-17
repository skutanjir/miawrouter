import { describe, it, expect, beforeEach } from "vitest";
import { PROVIDERS } from "../../open-sse/providers/index.js";
import {
  CACHE_MODE,
  CACHE_MARKER,
  resolveCacheCapability,
  listCacheModes,
} from "../../open-sse/providers/cacheCapabilities.js";
import { begin, finish, countBreakpoints, _resetCacheState } from "../../open-sse/cache/l0.js";

/**
 * Capability-driven cache contract, applied to EVERY registered provider.
 *
 * The contract adapts to the mode the provider declares, instead of forcing one
 * vendor's dialect onto all of them:
 *
 *   explicit — L0 may insert breakpoint markers on a stable prefix, and a
 *              client-supplied marker survives untouched.
 *   implicit — the stable prefix is preserved, but NO marker field is added:
 *              the provider caches on its own and only reports usage.
 *   none     — same as implicit from the request side; nothing to inject.
 *   unknown  — conservative: never inject a vendor field we have no evidence for.
 *
 * A provider that declares no evidence (unknown) is NOT asserted to be
 * uncacheable — only that the router refrains from inventing cache fields.
 */

function bodyWithStablePrefix(tail = "latest tail") {
  return {
    model: "contract-model",
    system: [{ type: "text", text: "You are a coding agent." }],
    messages: [
      { role: "user", content: "first turn" },
      { role: "assistant", content: "ok" },
      { role: "user", content: tail },
    ],
    tools: [
      {
        type: "function",
        function: { name: "read_file", description: "read", parameters: { type: "object", properties: {} } },
      },
    ],
  };
}

/** Drive `turns` identical-prefix requests through L0 for one provider/format. */
function driveL0({ provider, format, turns = 2, tail = "latest tail" }) {
  const capability = resolveCacheCapability(provider, format);
  let out = null;
  for (let i = 0; i < turns; i++) {
    const body = bodyWithStablePrefix(tail);
    const state = begin(body);
    out = finish(body, state, {
      cacheKey: `${provider}:${format}:contract`,
      provider,
      model: "contract-model",
      capability,
    });
  }
  return { out, capability };
}

function formatOf(id) {
  return PROVIDERS[id]?.format || PROVIDERS[id]?.transport?.format || null;
}

/** Every provider id plus the format its transport resolves to. */
const ALL_PROVIDERS = Object.keys(PROVIDERS)
  .map((id) => ({ id, format: formatOf(id) }))
  .filter((p) => p.format);

describe("provider cache capability matrix", () => {
  it("covers every registered provider and resolves a mode for each", () => {
    expect(ALL_PROVIDERS.length).toBeGreaterThan(100);
    for (const { id, format } of ALL_PROVIDERS) {
      const cap = resolveCacheCapability(id, format);
      expect(Object.values(CACHE_MODE), `${id}`).toContain(cap.mode);
      expect(typeof cap.evidence).toBe("string");
    }
  });

  it("marks every non-explicit provider as marker-incapable", () => {
    for (const { id, format } of ALL_PROVIDERS) {
      const cap = resolveCacheCapability(id, format);
      if (cap.mode !== CACHE_MODE.EXPLICIT) {
        expect(cap.supportsCacheMarkers, `${id}/${format} must not inject markers`).toBe(false);
        expect(cap.marker, `${id}/${format}`).toBe(CACHE_MARKER.NONE);
      }
    }
  });

  it("never marks a provider explicit without a named marker dialect", () => {
    for (const { id, format } of ALL_PROVIDERS) {
      const cap = resolveCacheCapability(id, format);
      if (cap.supportsCacheMarkers) {
        expect(cap.marker, `${id}/${format}`).toBe(CACHE_MARKER.ANTHROPIC);
        expect(cap.mode).toBe(CACHE_MODE.EXPLICIT);
      }
    }
  });

  it("never downgrades unknown to none (unknown must stay unknown)", () => {
    for (const rec of listCacheModes()) {
      if (rec.evidence === "unknown" || !rec.evidence) {
        expect(rec.mode, `${rec.key} has no evidence so it must be unknown`).toBe(CACHE_MODE.UNKNOWN);
      }
    }
  });

  it("refuses to inject Anthropic cache_control into any non-explicit provider body", () => {
    const offenders = [];
    for (const { id, format } of ALL_PROVIDERS) {
      const { out, capability } = driveL0({ provider: id, format });
      const serialized = JSON.stringify(out.body);
      const injected = serialized.includes("cache_control");
      if (capability.supportsCacheMarkers) {
        // explicit providers are allowed (and expected) to carry breakpoints
        if (!injected && out.info.stable) offenders.push(`${id}: explicit provider got no breakpoints`);
      } else if (injected) {
        offenders.push(`${id}/${format}: injected cache_control into a ${capability.mode} provider`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the stable prefix byte-identical for implicit/unknown providers", () => {
    for (const { id, format } of ALL_PROVIDERS) {
      const capability = resolveCacheCapability(id, format);
      if (capability.supportsCacheMarkers) continue;
      const { out } = driveL0({ provider: id, format });
      expect(JSON.stringify(out.body.messages[0]), `${id} prefix message mutated`).toBe(
        JSON.stringify({ role: "user", content: "first turn" }),
      );
      expect(out.body.tools[0].cache_control, `${id} tool object mutated`).toBeUndefined();
    }
  });

  it("still injects breakpoints for an explicit-cache provider (no regression)", () => {
    const { out, capability } = driveL0({ provider: "anthropic", format: "claude" });
    expect(capability.mode).toBe(CACHE_MODE.EXPLICIT);
    expect(out.info.markerInserted).toBe(true);
    expect(out.info.breakpoints).toBeGreaterThan(0);
    expect(out.info.breakpoints).toBeLessThanOrEqual(4);
  });

  it("preserves a client-supplied marker verbatim on every provider", () => {
    const clientMarker = { type: "ephemeral", ttl: "1h" };
    for (const { id, format } of ALL_PROVIDERS) {
      const body = bodyWithStablePrefix();
      body.system = [{ type: "text", text: "sys", cache_control: clientMarker }];
      const state = begin(body);
      const out = finish(body, state, {
        cacheKey: `${id}:${format}:client-marker`,
        provider: id,
        model: "m",
        capability: resolveCacheCapability(id, format),
      });
      expect(out.body.system[0].cache_control, `${id} rewrote the client marker`).toEqual(clientMarker);
    }
  });
});

describe("cache mode accounting is exposed for observability", () => {
  beforeEach(() => _resetCacheState());

  it("reports a resolved mode on every probe event", () => {
    const modes = new Map();
    for (const { id, format } of ALL_PROVIDERS) {
      const capability = resolveCacheCapability(id, format);
      let seen = null;
      const body = bodyWithStablePrefix();
      const state = begin(body);
      finish(body, state, {
        cacheKey: `${id}:${format}:probe`,
        provider: id,
        model: "m",
        capability,
        onCacheEvent: (e) => { seen = e.cacheMode; },
      });
      expect(seen, `${id}/${format} probe`).toBe(capability.mode);
      modes.set(capability.mode, (modes.get(capability.mode) || 0) + 1);
    }
    // The matrix is a real distribution, not a single blanket value.
    expect(modes.size).toBeGreaterThan(1);
  });

  it("counts breakpoints correctly for an explicit provider", () => {
    const { out } = driveL0({ provider: "claude", format: "claude" });
    expect(countBreakpoints(out.body)).toBe(out.info.breakpoints);
  });
});
