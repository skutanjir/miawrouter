/**
 * Sanitized upstream usage payloads, one per provider cache dialect.
 *
 * These are hand-built from the field vocabulary each provider family is known to
 * emit (see open-sse/utils/usageTracking.js and translator/concerns/usage.js), NOT
 * captured from live traffic. No credentials, no prompt content: usage numbers
 * only. Extend this file when a provider's real response shape is captured —
 * never paper over an unknown dialect by inventing field names.
 *
 * Every entry is `{ id, dialect, cacheMode, usage, expect }`.
 *   cacheMode — explicit | implicit | none | unknown (mirrors providers/cacheCapabilities.js)
 *   expect    — canonicalized values the normalizer MUST produce
 *   and `expectAbsent` — canonical fields that MUST stay undefined (never fabricated)
 */

export const CACHE_DIALECTS = Object.freeze({
  CLAUDE: "claude",
  OPENAI: "openai",
  OPENAI_RESPONSES: "openai-responses",
  GEMINI: "gemini",
  DEEPSEEK: "deepseek",
  KIRO: "kiro",
  COMMANDCODE: "commandcode",
  UNKNOWN: "unknown",
});

// --- Anthropic: prompt EXCLUDES cache; cache read + creation are separate -----
// Anthropic input_tokens counts only un-cached input. Cache read and cache write
// are disjoint counters that must both fold INTO the prompt total.
export const CLAUDE_CACHE_READ = {
  id: "claude-cache-read",
  dialect: CACHE_DIALECTS.CLAUDE,
  cacheMode: "explicit",
  usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 4000, cache_creation_input_tokens: 0 },
  expect: { prompt_tokens: 4100, completion_tokens: 50, total_tokens: 4150, cached_tokens: 4000, cache_creation_input_tokens: 0 },
};

export const CLAUDE_CACHE_CREATION = {
  id: "claude-cache-creation",
  dialect: CACHE_DIALECTS.CLAUDE,
  cacheMode: "explicit",
  usage: { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 3000 },
  expect: { prompt_tokens: 3020, completion_tokens: 10, total_tokens: 3030, cached_tokens: 0, cache_creation_input_tokens: 3000 },
};

export const CLAUDE_CACHE_READ_AND_CREATION = {
  id: "claude-cache-read-and-creation",
  dialect: CACHE_DIALECTS.CLAUDE,
  cacheMode: "explicit",
  usage: { input_tokens: 5, output_tokens: 7, cache_read_input_tokens: 800, cache_creation_input_tokens: 200 },
  expect: { prompt_tokens: 1005, completion_tokens: 7, total_tokens: 1012, cached_tokens: 800, cache_creation_input_tokens: 200 },
};

export const CLAUDE_CACHE_ABSENT = {
  id: "claude-cache-absent",
  dialect: CACHE_DIALECTS.CLAUDE,
  cacheMode: "explicit",
  usage: { input_tokens: 120, output_tokens: 30 },
  expect: { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 },
  // No cache field was reported: the router must NOT invent a zero.
  expectAbsent: ["cachedTokens", "cacheWriteTokens"],
};

// --- OpenAI: cached_tokens is a SUBSET of prompt_tokens (already inclusive) ---
export const OPENAI_CACHED_SUBSET = {
  id: "openai-cached-subset",
  dialect: CACHE_DIALECTS.OPENAI,
  cacheMode: "implicit",
  usage: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100, prompt_tokens_details: { cached_tokens: 768 } },
  expect: { prompt_tokens: 1000, completion_tokens: 100, total_tokens: 1100, cached_tokens: 768 },
};

export const OPENAI_RESPONSES_CACHED_SUBSET = {
  id: "openai-responses-cached-subset",
  dialect: CACHE_DIALECTS.OPENAI_RESPONSES,
  cacheMode: "implicit",
  usage: { input_tokens: 2000, output_tokens: 200, input_tokens_details: { cached_tokens: 1536 } },
  expect: { prompt_tokens: 2000, completion_tokens: 200, total_tokens: 2200, cached_tokens: 1536 },
};

export const OPENAI_REASONING_WITH_CACHE = {
  id: "openai-reasoning-with-cache",
  dialect: CACHE_DIALECTS.OPENAI,
  cacheMode: "implicit",
  usage: {
    prompt_tokens: 500,
    completion_tokens: 300,
    total_tokens: 800,
    prompt_tokens_details: { cached_tokens: 256 },
    completion_tokens_details: { reasoning_tokens: 200 },
  },
  expect: { prompt_tokens: 500, completion_tokens: 300, total_tokens: 800, cached_tokens: 256, reasoning_tokens: 200 },
};

export const OPENAI_ZERO_CACHE = {
  id: "openai-zero-cache",
  dialect: CACHE_DIALECTS.OPENAI,
  cacheMode: "implicit",
  // A reported-but-zero read is meaningful: it means a cold miss. Keep the zero.
  usage: { prompt_tokens: 900, completion_tokens: 20, total_tokens: 920, prompt_tokens_details: { cached_tokens: 0 } },
  expect: { prompt_tokens: 900, completion_tokens: 20, total_tokens: 920, cached_tokens: 0 },
};

// --- Gemini: candidates are SEPARATE from thoughts; total may include both ----
export const GEMINI_CACHED_CONTENT = {
  id: "gemini-cached-content",
  dialect: CACHE_DIALECTS.GEMINI,
  cacheMode: "implicit",
  usage: { promptTokenCount: 5000, candidatesTokenCount: 200, totalTokenCount: 5200, cachedContentTokenCount: 4500 },
  expect: { prompt_tokens: 5000, completion_tokens: 200, total_tokens: 5200, cached_tokens: 4500 },
};

export const GEMINI_THOUGHTS = {
  id: "gemini-thoughts",
  dialect: CACHE_DIALECTS.GEMINI,
  cacheMode: "implicit",
  usage: { promptTokenCount: 1000, candidatesTokenCount: 400, thoughtsTokenCount: 350, totalTokenCount: 1750 },
  expect: { prompt_tokens: 1000, completion_tokens: 400, total_tokens: 1750, reasoning_tokens: 350 },
};

export const GEMINI_NO_CACHE_FIELD = {
  id: "gemini-no-cache-field",
  dialect: CACHE_DIALECTS.GEMINI,
  cacheMode: "implicit",
  usage: { promptTokenCount: 700, candidatesTokenCount: 90, totalTokenCount: 790 },
  expect: { prompt_tokens: 700, completion_tokens: 90, total_tokens: 790 },
  expectAbsent: ["cachedTokens", "cacheWriteTokens"],
};

// --- DeepSeek: hit + miss are DISJOINT halves of the prompt -------------------
export const DEEPSEEK_HIT_AND_MISS = {
  id: "deepseek-hit-and-miss",
  dialect: CACHE_DIALECTS.DEEPSEEK,
  cacheMode: "implicit",
  usage: { prompt_cache_hit_tokens: 3000, prompt_cache_miss_tokens: 500, prompt_tokens: 3500, completion_tokens: 120, total_tokens: 3620 },
  expect: { prompt_tokens: 3500, completion_tokens: 120, total_tokens: 3620, cached_tokens: 3000 },
};

export const DEEPSEEK_HIT_ONLY = {
  id: "deepseek-hit-only",
  dialect: CACHE_DIALECTS.DEEPSEEK,
  cacheMode: "implicit",
  // prompt_tokens omitted: it must be reconstructed from hit + miss, not dropped.
  usage: { prompt_cache_hit_tokens: 2000, prompt_cache_miss_tokens: 250, completion_tokens: 40 },
  expect: { prompt_tokens: 2250, completion_tokens: 40, cached_tokens: 2000 },
};

// --- Kiro: defensive parsing only; upstream cache fields are UNVERIFIED -------
export const KIRO_USAGE_MINIMAL = {
  id: "kiro-usage-minimal",
  dialect: CACHE_DIALECTS.KIRO,
  cacheMode: "unknown",
  usage: { input_tokens: 400, output_tokens: 60 },
  expect: { prompt_tokens: 400, completion_tokens: 60 },
  // Kiro's cache support is unverified: never assume a cache field exists.
  expectAbsent: ["cachedTokens"],
};

// --- Unknown dialect: must not fabricate anything ----------------------------
export const UNKNOWN_DIALECT_MINIMAL = {
  id: "unknown-dialect-minimal",
  dialect: CACHE_DIALECTS.UNKNOWN,
  cacheMode: "unknown",
  usage: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  expect: { prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 },
  expectAbsent: ["cachedTokens", "cacheWriteTokens", "reasoningTokens"],
};

/** Malformed / hostile inputs: must return null or a safe value, never throw. */
export const MALFORMED_USAGE_PAYLOADS = [
  { id: "null", payload: null },
  { id: "undefined", payload: undefined },
  { id: "array", payload: [1, 2, 3] },
  { id: "string", payload: "not-an-object" },
  { id: "empty-object", payload: {} },
  { id: "non-numeric", payload: { prompt_tokens: "many", cached_tokens: {} } },
  { id: "nested-null", payload: { prompt_tokens: 1, prompt_tokens_details: null } },
];

export const ALL_CACHE_FIXTURES = Object.freeze([
  CLAUDE_CACHE_READ,
  CLAUDE_CACHE_CREATION,
  CLAUDE_CACHE_READ_AND_CREATION,
  CLAUDE_CACHE_ABSENT,
  OPENAI_CACHED_SUBSET,
  OPENAI_RESPONSES_CACHED_SUBSET,
  OPENAI_REASONING_WITH_CACHE,
  OPENAI_ZERO_CACHE,
  GEMINI_CACHED_CONTENT,
  GEMINI_THOUGHTS,
  GEMINI_NO_CACHE_FIELD,
  DEEPSEEK_HIT_AND_MISS,
  DEEPSEEK_HIT_ONLY,
  KIRO_USAGE_MINIMAL,
  UNKNOWN_DIALECT_MINIMAL,
]);

/** Fixtures for a dialect, plus the family-agnostic "never fabricate" cases. */
export function fixturesForDialect(dialect) {
  return ALL_CACHE_FIXTURES.filter((f) => f.dialect === dialect);
}
