import { describe, it, expect } from "vitest";
import { canonicalizeUsage, normalizeUsage, mergeUsage } from "../../open-sse/utils/usageTracking.js";
import { extractUsageFromResponse } from "../../open-sse/handlers/chatCore/requestDetail.js";
import { CACHE_MODE, resolveCacheCapability } from "../../open-sse/providers/cacheCapabilities.js";
import {
  ALL_CACHE_FIXTURES,
  MALFORMED_USAGE_PAYLOADS,
  CLAUDE_CACHE_READ,
  OPENAI_CACHED_SUBSET,
  GEMINI_CACHED_CONTENT,
  DEEPSEEK_HIT_AND_MISS,
  DEEPSEEK_HIT_ONLY,
  UNKNOWN_DIALECT_MINIMAL,
} from "../fixtures/providers/cache-usage.js";

/**
 * Provider cache contract tests.
 *
 * Two contracts are asserted for every provider cache dialect:
 *
 *   MEASURE — when upstream reports cache accounting, the canonicalizer turns it
 *             into the router's storage convention without losing or double-adding
 *             tokens.
 *   NEVER FABRICATE — when upstream reports nothing, the canonical output must NOT
 *             contain an invented zero. A missing cache field and a genuine zero
 *             are different facts, and the router must not blur them.
 *
 * No live credentials or network: every payload is a sanitized fixture.
 */

describe("Provider cache usage contract", () => {
  describe("MEASURE: reported cache tokens reach the canonical shape", () => {
    for (const fx of ALL_CACHE_FIXTURES) {
      it(`${fx.id} (${fx.dialect}/${fx.cacheMode})`, () => {
        const out = canonicalizeUsage(fx.usage);
        expect(out, `${fx.id} should canonicalize`).toBeTruthy();
        for (const [key, value] of Object.entries(fx.expect)) {
          expect(out[key], `${fx.id}.${key}`).toBe(value);
        }
      });
    }
  });

  describe("NEVER FABRICATE: absent upstream fields stay absent", () => {
    for (const fx of ALL_CACHE_FIXTURES.filter((f) => f.expectAbsent)) {
      it(`${fx.id} does not invent ${fx.expectAbsent.join(", ")}`, () => {
        const out = canonicalizeUsage(fx.usage);
        expect(out).toBeTruthy();
        for (const key of fx.expectAbsent) {
          expect(out[key], `${fx.id} must leave ${key} unset`).toBeUndefined();
        }
      });
    }
  });

  describe("cache accounting must not double-count into the prompt total", () => {
    it("Claude: prompt EXCLUDES cache, so cache folds IN exactly once", () => {
      const out = canonicalizeUsage(CLAUDE_CACHE_READ.usage);
      expect(out.prompt_tokens).toBe(100 + 4000);
      // total is prompt + completion, NOT prompt + completion + cache again
      expect(out.total_tokens).toBe(out.prompt_tokens + out.completion_tokens);
      expect(out.cached_tokens).toBeLessThanOrEqual(out.prompt_tokens);
    });

    it("OpenAI: cached_tokens is a SUBSET, so it is never added to the prompt", () => {
      const out = canonicalizeUsage(OPENAI_CACHED_SUBSET.usage);
      expect(out.prompt_tokens).toBe(1000);
      expect(out.total_tokens).toBe(1100);
      expect(out.cached_tokens).toBe(768);
      expect(out.cached_tokens).toBeLessThanOrEqual(out.prompt_tokens);
    });

    it("Gemini: cached content is a subset of promptTokenCount", () => {
      const out = canonicalizeUsage(GEMINI_CACHED_CONTENT.usage);
      expect(out.prompt_tokens).toBe(5000);
      expect(out.cached_tokens).toBe(4500);
      expect(out.total_tokens).toBe(5200);
    });

    it("DeepSeek: hit + miss reconstruct the prompt but hit is not added twice", () => {
      const out = canonicalizeUsage(DEEPSEEK_HIT_AND_MISS.usage);
      expect(out.prompt_tokens).toBe(3500);
      expect(out.cached_tokens).toBe(3000);
      expect(out.prompt_tokens).not.toBe(3000 + 500 + 3000);
    });

    it("DeepSeek: prompt reconstructed from hit+miss when prompt_tokens is absent", () => {
      const out = canonicalizeUsage(DEEPSEEK_HIT_ONLY.usage);
      expect(out.prompt_tokens).toBe(2250);
      expect(out.cached_tokens).toBe(2000);
    });
  });

  describe("idempotence: canonicalizing twice changes nothing", () => {
    for (const fx of ALL_CACHE_FIXTURES) {
      it(`${fx.id} is stable under re-canonicalization`, () => {
        const once = canonicalizeUsage(fx.usage);
        const twice = canonicalizeUsage(once);
        expect(twice?.prompt_tokens).toBe(once.prompt_tokens);
        expect(twice?.completion_tokens).toBe(once.completion_tokens);
        expect(twice?.total_tokens).toBe(once.total_tokens);
        expect(twice?.cached_tokens).toBe(once.cached_tokens);
      });
    }
  });

  describe("malformed upstream payloads never throw", () => {
    for (const { id, payload } of MALFORMED_USAGE_PAYLOADS) {
      it(`canonicalizeUsage(${id}) returns null or a safe object`, () => {
        let out;
        expect(() => { out = canonicalizeUsage(payload); }).not.toThrow();
        if (out !== null) {
          expect(typeof out).toBe("object");
          // Any number it does emit must be a finite number, never NaN.
          for (const v of Object.values(out)) {
            if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
          }
        }
      });

      it(`normalizeUsage(${id}) never throws`, () => {
        expect(() => normalizeUsage(payload)).not.toThrow();
      });
    }
  });

  describe("streaming usage merge keeps input and output from separate events", () => {
    it("merges an Anthropic message_start input with message_delta output", () => {
      // message_start carries input/cache counters; message_delta carries output.
      const start = { input_tokens: 10, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 };
      const delta = { output_tokens: 120 };
      const merged = mergeUsage(canonicalizeUsage(start), canonicalizeUsage(delta));
      expect(merged.prompt_tokens).toBe(910);   // cache folded in once from message_start
      expect(merged.completion_tokens).toBe(120); // output from message_delta
      expect(merged.cached_tokens).toBe(900);
    });

    it("does not lose input tokens when a later event only reports output", () => {
      const first = canonicalizeUsage({ prompt_tokens: 500, completion_tokens: 0, prompt_tokens_details: { cached_tokens: 400 } });
      const second = canonicalizeUsage({ completion_tokens: 200 });
      const merged = mergeUsage(first, second);
      expect(merged.prompt_tokens).toBe(500);
      expect(merged.cached_tokens).toBe(400);
    });
  });
});

describe("Cache capability declarations agree with the usage contract", () => {
  it("every provider declared explicit actually has a marker dialect", () => {
    for (const [provider, format] of [["anthropic", "claude"], ["claude", "claude"], ["alicode", "openai"]]) {
      const cap = resolveCacheCapability(provider, format);
      expect(cap.mode, `${provider}/${format}`).toBe(CACHE_MODE.EXPLICIT);
      expect(cap.marker, `${provider}/${format}`).toBeTruthy();
    }
  });

  it("implicit-cache providers declare a usage field to read and no marker", () => {
    for (const [provider, format] of [["openai", "openai"], ["gemini", "gemini"], ["deepseek", "openai"], ["antigravity", "antigravity"]]) {
      const cap = resolveCacheCapability(provider, format);
      expect(cap.mode, `${provider}/${format}`).toBe(CACHE_MODE.IMPLICIT);
      expect(cap.marker, `${provider}/${format}`).toBeNull();
      expect(Object.keys(cap.usage).length, `${provider}/${format} should name its usage fields`).toBeGreaterThan(0);
    }
  });

  it("unknown providers claim no cache fields at all", () => {
    const cap = resolveCacheCapability("kiro", "kiro");
    expect(cap.mode).toBe(CACHE_MODE.UNKNOWN);
    expect(cap.marker).toBeNull();
    expect(cap.usage).toEqual({});
    // unknown is NOT silently downgraded to "no caching"
    expect(cap.mode).not.toBe(CACHE_MODE.NONE);
  });

  it("unknown-dialect usage still canonicalizes the fields it does understand", () => {
    const out = canonicalizeUsage(UNKNOWN_DIALECT_MINIMAL.usage);
    expect(out.prompt_tokens).toBe(10);
    // Absence is preserved on the precise (camelCase) fields. The snake_case
    // aliases are the persisted numeric storage convention and default to 0
    // there — that is a storage default, not a fabricated upstream reading.
    expect(out.cachedTokens).toBeUndefined();
    expect(out.cacheWriteTokens).toBeUndefined();
  });
});

describe("Responses-API usage is not misread as Claude usage", () => {
  it("keeps cached + reasoning tokens from input_tokens_details/output_tokens_details", () => {
    // Regression: the Claude branch also matches `usage.input_tokens`, so a
    // Responses payload used to fall into it and lose all cache accounting.
    const out = extractUsageFromResponse({
      usage: {
        input_tokens: 2000,
        output_tokens: 300,
        total_tokens: 2300,
        input_tokens_details: { cached_tokens: 1792 },
        output_tokens_details: { reasoning_tokens: 128 },
      },
    });
    expect(out.prompt_tokens).toBe(2000);
    expect(out.completion_tokens).toBe(300);
    expect(out.cached_tokens).toBe(1792);
    expect(out.reasoning_tokens).toBe(128);
  });

  it("still reads a native Anthropic usage object as Claude", () => {
    const out = extractUsageFromResponse({
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
    });
    expect(out.prompt_tokens).toBe(10);
    expect(out.cache_read_input_tokens).toBe(900);
    expect(out.cached_tokens).toBeUndefined();
  });

  it("still reads Gemini usageMetadata", () => {
    const out = extractUsageFromResponse({
      usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 80, cachedContentTokenCount: 640, thoughtsTokenCount: 20 },
    });
    expect(out.prompt_tokens).toBe(700);
    expect(out.cached_tokens).toBe(640);
    expect(out.reasoning_tokens).toBe(20);
  });
});
