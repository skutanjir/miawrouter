/**
 * Applies the reusable cache contract (tests/helpers/cacheContract.js) to one
 * representative provider per cache mode, plus every explicit-cache provider.
 *
 * The full 111-provider sweep lives in provider-cache-matrix.test.js; this file
 * proves the contract RUNNER itself adapts to each mode instead of asserting one
 * vendor's dialect everywhere.
 */

import { describe, it, expect } from "vitest";
import { PROVIDERS } from "../../open-sse/providers/index.js";
import { CACHE_MODE, resolveCacheCapability } from "../../open-sse/providers/cacheCapabilities.js";
import { canonicalizeUsage } from "../../open-sse/utils/usageTracking.js";
import { emitCacheUsage, connectionRef } from "../../open-sse/cache/l0.js";
import {
  describeCacheContract,
  assertCapabilityDeclarations,
  runUsageContract,
} from "../helpers/cacheContract.js";
import {
  CLAUDE_CACHE_READ,
  CLAUDE_CACHE_READ_AND_CREATION,
  OPENAI_CACHED_SUBSET,
  GEMINI_CACHED_CONTENT,
  GEMINI_THOUGHTS,
  DEEPSEEK_HIT_AND_MISS,
  MALFORMED_USAGE_PAYLOADS,
} from "../fixtures/providers/cache-usage.js";

function formatOf(id) {
  return PROVIDERS[id]?.format || PROVIDERS[id]?.transport?.format || null;
}

// One representative per mode, chosen for the most distinct upstream dialect.
const EXPLICIT = ["anthropic", "claude", "alicode"];
const IMPLICIT = ["openai", "deepseek", "gemini", "antigravity"];
const UNKNOWN = ["ollama", "cerebras", "kiro"];

describe("cache contract runner adapts to each declared mode", () => {
  for (const id of [...EXPLICIT, ...IMPLICIT, ...UNKNOWN]) {
    const format = formatOf(id);
    if (!format) continue;
    describe(`${id}`, () => {
      describeCacheContract(id, format);
    });
  }
});

describe("capability declarations", () => {
  assertCapabilityDeclarations();

  // Exact canonical values for the sanitized per-dialect fixtures. A change in
  // these numbers is a usage-accounting change and must be deliberate.
  describe("usage contract per dialect", () => {
    runUsageContract("anthropic", "claude", {
      "Anthropic cache read folded into the prompt": {
        payload: CLAUDE_CACHE_READ.usage,
        // Anthropic's input_tokens EXCLUDES cache, so cache read is folded in.
        expect: { prompt_tokens: 4100, completion_tokens: 50, cached_tokens: 4000, cache_creation_input_tokens: 0 },
      },
    });
    runUsageContract("openai", "openai", {
      "cached tokens stay a subset of the prompt": {
        payload: OPENAI_CACHED_SUBSET.usage,
        // OpenAI's prompt_tokens is cache-INCLUSIVE: cached must NOT be added.
        expect: { prompt_tokens: 1000, completion_tokens: 100, cached_tokens: 768 },
      },
    });
    runUsageContract("gemini", "gemini", {
      "cached content is reported, not re-added": {
        payload: GEMINI_CACHED_CONTENT.usage,
        expect: { prompt_tokens: 5000, completion_tokens: 200, cached_tokens: 4500 },
      },
    });
    runUsageContract("deepseek", "openai", {
      "hit + miss tokens reconcile to the prompt": {
        payload: DEEPSEEK_HIT_AND_MISS.usage,
        expect: { prompt_tokens: 3500, completion_tokens: 120, cached_tokens: 3000 },
      },
    });
  });

  describe("usage accounting invariants", () => {
    it("never adds cached tokens to an already-inclusive prompt", () => {
      const out = canonicalizeUsage(OPENAI_CACHED_SUBSET.usage);
      expect(out.cached_tokens).toBeLessThanOrEqual(out.prompt_tokens);
      expect(out.prompt_tokens).toBe(OPENAI_CACHED_SUBSET.usage.prompt_tokens);
    });

    it("folds cache-exclusive Anthropic input tokens exactly once", () => {
      const raw = CLAUDE_CACHE_READ_AND_CREATION.usage;
      const out = canonicalizeUsage(raw);
      expect(out.prompt_tokens).toBe(raw.input_tokens + raw.cache_read_input_tokens + raw.cache_creation_input_tokens);
      expect(out.cached_tokens).toBe(raw.cache_read_input_tokens);
      expect(out.cacheWriteTokens ?? out.cache_creation_input_tokens).toBe(raw.cache_creation_input_tokens);
    });

    it("does not double-count Gemini thoughts into total tokens", () => {
      const out = canonicalizeUsage(GEMINI_THOUGHTS.usage);
      const raw = GEMINI_THOUGHTS.usage;
      expect(out.prompt_tokens).toBe(raw.promptTokenCount);
      expect(out.reasoningTokens).toBe(raw.thoughtsTokenCount);
      expect(out.total_tokens).toBe(raw.totalTokenCount);
    });

    it("keeps DeepSeek hit + miss tokens consistent with the prompt", () => {
      const raw = DEEPSEEK_HIT_AND_MISS.usage;
      expect(raw.prompt_cache_hit_tokens + raw.prompt_cache_miss_tokens).toBe(raw.prompt_tokens);
      const out = canonicalizeUsage(raw);
      expect(out.cached_tokens).toBe(raw.prompt_cache_hit_tokens);
    });

    it("survives malformed metadata without inventing cache values", () => {
      for (const payload of MALFORMED_USAGE_PAYLOADS) {
        const label = JSON.stringify(payload);
        // The contract is: never throw, and never report a value the upstream in
        // no way provided. A non-usage input legitimately canonicalizes to null.
        let out;
        expect(() => { out = canonicalizeUsage(payload); }, label).not.toThrow();
        if (out === null || out === undefined) continue;
        expect(Number.isFinite(out.prompt_tokens), label).toBe(true);
        expect(Number.isNaN(out.cached_tokens), label).toBe(false);
        expect(Number.isFinite(out.completion_tokens), label).toBe(true);
      }
    });
  });
});

describe("mode coverage sanity", () => {
  it("exercises every declared mode", () => {
    const modes = new Set(
      [...EXPLICIT, ...IMPLICIT, ...UNKNOWN].map((id) => resolveCacheCapability(id, formatOf(id)).mode),
    );
    expect(modes.has(CACHE_MODE.EXPLICIT)).toBe(true);
    expect(modes.has(CACHE_MODE.IMPLICIT)).toBe(true);
    expect(modes.has(CACHE_MODE.UNKNOWN)).toBe(true);
  });
});

describe("cache observability is privacy-safe and never fabricates tokens", () => {
  const usageWith = (u) => {
    let seen = null;
    emitCacheUsage((e) => { seen = e; }, {
      cacheKey: "k",
      provider: "anthropic",
      model: "m",
      usage: u,
      cacheMode: "explicit",
      connectionId: "conn_abc123",
    });
    return seen;
  };

  it("emits a hashed account reference, never the raw connection id", () => {
    const e = usageWith({ cache_read_input_tokens: 100, prompt_tokens: 1000 });
    expect(e.connectionRef).toBe(connectionRef("conn_abc123"));
    expect(JSON.stringify(e)).not.toContain("conn_abc123");
  });

  it("reports prompt tokens, reasoning tokens and cache hit ratio", () => {
    const e = usageWith({
      prompt_tokens: 2000,
      cache_read_input_tokens: 1500,
      completion_tokens_details: { reasoning_tokens: 64 },
    });
    expect(e.promptTokens).toBe(2000);
    expect(e.reasoningTokens).toBe(64);
    expect(e.cacheHitRatio).toBe(0.75);
  });

  it("leaves an unreported field null instead of defaulting it to zero", () => {
    const e = usageWith({ cache_read_input_tokens: 100 });
    expect(e.promptTokens).toBeNull();
    expect(e.reasoningTokens).toBeNull();
    expect(e.cacheHitRatio).toBeNull();
  });

  it("reads Gemini thoughts as reasoning without double-counting", () => {
    const e = usageWith({ promptTokenCount: 500, cachedContentTokenCount: 400, thoughtsTokenCount: 30 });
    expect(e.promptTokens).toBe(500);
    expect(e.reasoningTokens).toBe(30);
    expect(e.cacheHitRatio).toBe(0.8);
  });
});
