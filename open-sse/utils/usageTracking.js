/**
 * Token Usage Tracking - Extract, normalize, estimate and log token usage
 */

import { FORMATS } from "../translator/formats.js";
import { countBodyTokens, countTextTokens } from "./tokenizer.js";

// Legacy per-chunk usage console line; off by default (superseded by "📊 done")
const DEBUG_USAGE = process.env.LOG_USAGE_VERBOSE === "1";

// ANSI color codes
export const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

// Buffer tokens to prevent context errors
const BUFFER_TOKENS = 2000;

// Get HH:MM:SS timestamp
function getTimeString() {
  return new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Add buffer tokens to usage to prevent context errors
 * @param {object} usage - Usage object (any format)
 * @returns {object} Usage with buffer added
 */
export function addBufferToUsage(usage) {
  if (!usage || typeof usage !== "object") return usage;

  const result = { ...usage };

  // Claude format
  if (result.input_tokens !== undefined) {
    result.input_tokens += BUFFER_TOKENS;
  }

  // OpenAI format
  if (result.prompt_tokens !== undefined) {
    result.prompt_tokens += BUFFER_TOKENS;
  }

  // Calculate or update total_tokens
  if (result.total_tokens !== undefined) {
    result.total_tokens += BUFFER_TOKENS;
  } else if (result.prompt_tokens !== undefined && result.completion_tokens !== undefined) {
    // Calculate total_tokens if not exists
    result.total_tokens = result.prompt_tokens + result.completion_tokens;
  }

  return result;
}

export function filterUsageForFormat(usage, targetFormat) {
  if (!usage || typeof usage !== "object") return usage;

  // Helper to pick only defined fields from usage
  const pickFields = (fields) => {
    const filtered = {};
    for (const field of fields) {
      if (usage[field] !== undefined) {
        filtered[field] = usage[field];
      }
    }
    return filtered;
  };

  // Define allowed fields for each format
  const formatFields = {
    [FORMATS.CLAUDE]: [
      'input_tokens', 'output_tokens', 
      'cache_read_input_tokens', 'cache_creation_input_tokens',
      'estimated'
    ],
    [FORMATS.GEMINI]: [
      'promptTokenCount', 'candidatesTokenCount', 'totalTokenCount',
      'cachedContentTokenCount', 'thoughtsTokenCount',
      'estimated'
    ],
    [FORMATS.OPENAI_RESPONSES]: [
      'input_tokens', 'output_tokens',
      'input_tokens_details', 'output_tokens_details',
      'estimated'
    ],
    // OpenAI format (default for OPENAI, CODEX, KIRO, etc.)
    default: [
      'prompt_tokens', 'completion_tokens', 'total_tokens',
      'cached_tokens', 'reasoning_tokens',
      'prompt_tokens_details', 'completion_tokens_details',
      'estimated'
    ]
  };

  // Get fields for target format
  let fields = formatFields[targetFormat];
  
  // Use same fields for similar formats
  if (targetFormat === FORMATS.GEMINI_CLI || targetFormat === FORMATS.ANTIGRAVITY) {
    fields = formatFields[FORMATS.GEMINI];
  } else if (targetFormat === FORMATS.OPENAI_RESPONSE) {
    fields = formatFields[FORMATS.OPENAI_RESPONSES];
  } else if (!fields) {
    fields = formatFields.default;
  }

  return pickFields(fields);
}

/**
 * Normalize usage object - ensure all values are valid numbers
 */
export function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;

  const normalized = {};
  const assignNumber = (key, value) => {
    if (value === undefined || value === null) return;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) normalized[key] = numeric;
  };

  assignNumber("prompt_tokens", usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokens ?? usage?.inputTokens ?? usage?.promptTokenCount ?? usage?.prompt_eval_count);
  assignNumber("completion_tokens", usage?.completion_tokens ?? usage?.output_tokens ?? usage?.completionTokens ?? usage?.outputTokens ?? usage?.candidatesTokenCount ?? usage?.eval_count);
  assignNumber("total_tokens", usage?.total_tokens ?? usage?.totalTokens ?? usage?.totalTokenCount);
  assignNumber("cache_read_input_tokens", usage?.cache_read_input_tokens ?? usage?.cacheReadTokens);
  assignNumber("cache_creation_input_tokens", usage?.cache_creation_input_tokens ?? usage?.cacheWriteTokens ?? usage?.cacheCreationTokens ?? usage?.prompt_tokens_details?.cache_creation_tokens);
  assignNumber("cached_tokens", usage?.cached_tokens ?? usage?.cachedTokens ?? usage?.prompt_tokens_details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? usage?.cachedContentTokenCount ?? usage?.usageMetadata?.cachedContentTokenCount);
  assignNumber("reasoning_tokens", usage?.reasoning_tokens ?? usage?.reasoningTokens ?? usage?.completion_tokens_details?.reasoning_tokens ?? usage?.output_tokens_details?.reasoning_tokens ?? usage?.usageMetadata?.thoughtsTokenCount ?? usage?.thoughtsTokenCount);
  assignNumber("prompt_cache_hit_tokens", usage?.prompt_cache_hit_tokens);
  assignNumber("prompt_cache_miss_tokens", usage?.prompt_cache_miss_tokens);

  // Preserve nested details objects for OpenAI format forwarding
  if (usage?.prompt_tokens_details && typeof usage.prompt_tokens_details === "object") {
    normalized.prompt_tokens_details = usage.prompt_tokens_details;
  }
  if (usage?.completion_tokens_details && typeof usage.completion_tokens_details === "object") {
    normalized.completion_tokens_details = usage.completion_tokens_details;
  }

  if (Object.keys(normalized).length === 0) return null;
  return normalized;
}

/**
 * Canonicalize usage into ONE storage/cost convention so token counts and cost
 * are consistent across providers:
 *   promptTokens / prompt_tokens = total input INCLUDING cache read + cache creation
 *   cachedTokens / cached_tokens = cache-read portion (subset of prompt_tokens)
 *   cacheWriteTokens / cache_creation_input_tokens = cache-write portion (subset of prompt_tokens)
 *   completionTokens / completion_tokens
 *   reasoningTokens / reasoning_tokens
 *   totalTokens / total_tokens
 *
 * Discriminator: Claude reports cache_read_input_tokens with a prompt that
 * EXCLUDES cache, so we fold cache into prompt. OpenAI/Gemini/DeepSeek report
 * prompt tokens already inclusive of cached_tokens, so we pass through.
 * Idempotent: once folded the output carries promptTokens and cached_tokens,
 * so re-running takes the passthrough branch and does not double-add.
 *
 * @param {object} usage - any provider usage payload
 * @returns {object|null} canonical token object, or null for invalid input
 */
export function canonicalizeUsage(usage) {
  if (!usage || typeof usage !== "object" || Array.isArray(usage)) return null;

  const raw = usage.usage || usage.usageMetadata || usage.response?.usageMetadata || usage;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const getNum = (v) => {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const rawHit = getNum(raw.prompt_cache_hit_tokens);
  const rawMiss = getNum(raw.prompt_cache_miss_tokens);

  let rawPrompt = getNum(
    raw.promptTokens ?? raw.prompt_tokens ?? raw.input_tokens ?? raw.inputTokens ?? raw.promptTokenCount ?? raw.prompt_eval_count
  );
  if (rawPrompt === undefined && (rawHit !== undefined || rawMiss !== undefined)) {
    rawPrompt = (rawHit || 0) + (rawMiss || 0);
  }

  const rawCompletion = getNum(
    raw.completionTokens ?? raw.completion_tokens ?? raw.output_tokens ?? raw.outputTokens ?? raw.candidatesTokenCount ?? raw.eval_count
  );

  const rawTotal = getNum(raw.totalTokens ?? raw.total_tokens ?? raw.totalTokenCount);

  // Extract optional cache and reasoning tokens: undefined if not reported
  let cached;
  if ("cachedTokens" in raw) {
    cached = getNum(raw.cachedTokens);
  } else {
    cached = getNum(
      raw.prompt_tokens_details?.cached_tokens ??
      raw.input_tokens_details?.cached_tokens ??
      raw.prompt_cache_hit_tokens ??
      raw.cache_read_input_tokens ??
      raw.cachedContentTokenCount ??
      raw.cacheReadTokens ??
      raw.cached_tokens
    );
  }

  let cacheWrite;
  if ("cacheWriteTokens" in raw) {
    cacheWrite = getNum(raw.cacheWriteTokens);
  } else {
    cacheWrite = getNum(
      raw.cache_creation_input_tokens ??
      raw.prompt_tokens_details?.cache_creation_tokens ??
      raw.input_tokens_details?.cache_creation_tokens ??
      raw.cacheCreationTokens
    );
  }

  let reasoning;
  if ("reasoningTokens" in raw) {
    reasoning = getNum(raw.reasoningTokens);
  } else {
    reasoning = getNum(
      raw.reasoning_tokens ??
      raw.completion_tokens_details?.reasoning_tokens ??
      raw.output_tokens_details?.reasoning_tokens ??
      raw.thoughtsTokenCount
    );
  }

  // If no token fields at all are provided, return null
  if (
    rawPrompt === undefined &&
    rawCompletion === undefined &&
    rawTotal === undefined &&
    cached === undefined &&
    cacheWrite === undefined &&
    reasoning === undefined
  ) {
    return null;
  }

  let prompt = rawPrompt ?? 0;
  const completion = rawCompletion ?? 0;

  // Claude path: prompt excludes cache; cache_read_input_tokens and/or
  // cache_creation_input_tokens are separate.
  // Guard against already-canonical input or OpenAI/Gemini input.
  const isClaudeExclusive =
    !("promptTokens" in raw) &&
    raw.cached_tokens === undefined &&
    raw.cachedTokens === undefined &&
    raw.prompt_tokens_details === undefined &&
    (raw.cache_read_input_tokens !== undefined || raw.cache_creation_input_tokens !== undefined);

  if (isClaudeExclusive) {
    prompt = prompt + (cached || 0) + (cacheWrite || 0);
  }

  // Double-count guard: totalTokens is prompt + completion.
  // Prompt is now cache-inclusive, so cache tokens must NOT be summed again!
  const total = isClaudeExclusive
    ? prompt + completion
    : (rawTotal !== undefined && rawTotal >= prompt + completion ? rawTotal : prompt + completion);

  const result = {
    promptTokens: prompt,
    completionTokens: completion,
    totalTokens: total,
    cachedTokens: cached,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: reasoning,

    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
    cached_tokens: cached ?? 0,
    cache_creation_input_tokens: cacheWrite ?? 0,
  };

  if (reasoning !== undefined) {
    result.reasoning_tokens = reasoning;
  }
  if (rawHit !== undefined) {
    result.prompt_cache_hit_tokens = rawHit;
  }
  if (rawMiss !== undefined) {
    result.prompt_cache_miss_tokens = rawMiss;
  }
  if (raw.prompt_tokens_details && typeof raw.prompt_tokens_details === "object") {
    result.prompt_tokens_details = raw.prompt_tokens_details;
  }
  if (raw.completion_tokens_details && typeof raw.completion_tokens_details === "object") {
    result.completion_tokens_details = raw.completion_tokens_details;
  }

  return result;
}

/**
 * Check if usage has valid token data
 * Valid = has at least one token field with value > 0
 * Invalid = empty object {}, null, undefined, no token fields, or all zeros
 */
export function hasValidUsage(usage) {
  if (!usage || typeof usage !== "object") return false;

  // Check for any known token field with value > 0
  const tokenFields = [
    "prompt_tokens", "completion_tokens", "total_tokens",  // OpenAI
    "input_tokens", "output_tokens",                        // Claude
    "promptTokenCount", "candidatesTokenCount"              // Gemini
  ];

  for (const field of tokenFields) {
    if (typeof usage[field] === "number" && usage[field] > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Extract usage from any format (Claude, OpenAI, Gemini, Responses API)
 */
export function extractUsage(chunk) {
  if (!chunk || typeof chunk !== "object") return null;

  // Claude format (message_start event): carries input_tokens + cache_read +
  // cache_creation. message_delta later carries only the final output_tokens,
  // so callers must MERGE (mergeUsage), not overwrite, to keep cache counts.
  if (chunk.type === "message_start" && chunk.message?.usage && typeof chunk.message.usage === "object") {
    const u = chunk.message.usage;
    return normalizeUsage({
      prompt_tokens: u.input_tokens || 0,
      completion_tokens: u.output_tokens || 0,
      cache_read_input_tokens: u.cache_read_input_tokens,
      cache_creation_input_tokens: u.cache_creation_input_tokens
    });
  }

  // Claude format (message_delta event)
  if (chunk.type === "message_delta" && chunk.usage && typeof chunk.usage === "object") {
    return normalizeUsage({
      prompt_tokens: chunk.usage.input_tokens || 0,
      completion_tokens: chunk.usage.output_tokens || 0,
      cache_read_input_tokens: chunk.usage.cache_read_input_tokens,
      cache_creation_input_tokens: chunk.usage.cache_creation_input_tokens
    });
  }

  // OpenAI Responses API format (response.completed or response.done)
  if ((chunk.type === "response.completed" || chunk.type === "response.done") && chunk.response?.usage && typeof chunk.response.usage === "object") {
    const usage = chunk.response.usage;
    const cachedTokens = usage.input_tokens_details?.cached_tokens;
    return normalizeUsage({
      prompt_tokens: usage.input_tokens || usage.prompt_tokens || 0,
      completion_tokens: usage.output_tokens || usage.completion_tokens || 0,
      cached_tokens: cachedTokens,
      reasoning_tokens: usage.output_tokens_details?.reasoning_tokens,
      prompt_tokens_details: cachedTokens ? { cached_tokens: cachedTokens } : undefined
    });
  }

  // OpenAI format (also covers DeepSeek which uses prompt_cache_hit_tokens)
  if (chunk.usage && typeof chunk.usage === "object" && chunk.usage.prompt_tokens !== undefined) {
    return normalizeUsage({
      prompt_tokens: chunk.usage.prompt_tokens,
      completion_tokens: chunk.usage.completion_tokens || 0,
      cached_tokens: chunk.usage.prompt_tokens_details?.cached_tokens || chunk.usage.prompt_cache_hit_tokens,
      reasoning_tokens: chunk.usage.completion_tokens_details?.reasoning_tokens,
      prompt_tokens_details: chunk.usage.prompt_tokens_details,
      completion_tokens_details: chunk.usage.completion_tokens_details
    });
  }

  // Gemini format (Antigravity)
  // Antigravity wraps usageMetadata inside response: { response: { usageMetadata: {...} } }
  const usageMeta = chunk.usageMetadata || chunk.response?.usageMetadata;
  if (usageMeta && typeof usageMeta === "object") {
    return normalizeUsage({
      prompt_tokens: usageMeta.promptTokenCount || 0,
      completion_tokens: usageMeta.candidatesTokenCount || 0,
      total_tokens: usageMeta.totalTokenCount,
      cached_tokens: usageMeta.cachedContentTokenCount,
      reasoning_tokens: usageMeta.thoughtsTokenCount
    });
  }

  // Ollama NDJSON format (raw from provider, before translation)
  // Ollama sends: {"model":"...","done":true,"prompt_eval_count":N,"eval_count":M}
  if (chunk.done === true && typeof chunk.prompt_eval_count === "number") {
    return normalizeUsage({
      prompt_tokens: chunk.prompt_eval_count || 0,
      completion_tokens: chunk.eval_count || 0,
      total_tokens: (chunk.prompt_eval_count || 0) + (chunk.eval_count || 0)
    });
  }

  return null;
}

// Field-wise max-merge of two usage objects. Anthropic splits usage across
// events: message_start has real input+cache (output is a placeholder 1),
// message_delta has the real cumulative output (input/cache absent). Max keeps
// the meaningful value from each without clobbering. Idempotent for other
// providers that emit a single complete usage object.
export function mergeUsage(prev, next) {
  if (!prev) return next || null;
  if (!next) return prev;
  const merged = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    // typeof NaN === "number" — guard with Number.isFinite so one malformed
    // chunk can't poison the whole accumulation (Math.max(x, NaN) is NaN).
    if (typeof v === "number" && Number.isFinite(v)) {
      merged[k] = Math.max(typeof merged[k] === "number" ? merged[k] : 0, v);
    } else if (v && typeof v === "object") {
      merged[k] = v; // nested details objects: take latest
    }
  }
  return merged;
}

/**
 * Estimate input tokens from request body.
 * Uses the shared token counter: exact BPE for OpenAI-family models,
 * honest chars/4 estimate otherwise.
 * @param {object} body - Request body (may carry its own .model)
 * @param {string} [model] - Model id; defaults to body.model
 */
export function estimateInputTokens(body, model) {
  if (!body || typeof body !== "object") return 0;

  try {
    return countBodyTokens(body, model);
  } catch (err) {
    // Fallback if stringify fails
    return 0;
  }
}

/**
 * Estimate output tokens. Pass the accumulated content string to get an
 * exact BPE count for OpenAI-family models; a bare char count keeps the
 * legacy chars/4 estimate (there's no text to tokenize).
 * @param {string|number} content - Content text or accumulated char count
 * @param {string} [model] - Model id
 */
export function estimateOutputTokens(content, model) {
  if (!content || content <= 0) return 0;
  if (typeof content === "string") {
    return countTextTokens(content, model);
  }
  return Math.max(1, Math.floor(content / 4));
}

/**
 * Format usage object based on target format
 * @param {number} inputTokens - Input/prompt tokens
 * @param {number} outputTokens - Output/completion tokens
 * @param {string} targetFormat - Target format from FORMATS
 */
export function formatUsage(inputTokens, outputTokens, targetFormat) {
  // Claude format uses input_tokens/output_tokens
  if (targetFormat === FORMATS.CLAUDE) {
    return addBufferToUsage({ 
      input_tokens: inputTokens, 
      output_tokens: outputTokens, 
      estimated: true 
    });
  }

  // Default: OpenAI format (works for openai, gemini, responses, etc.)
  return addBufferToUsage({
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    estimated: true
  });
}

/**
 * Estimate full usage when provider doesn't return it
 * @param {object} body - Request body for input token estimation
 * @param {number|string} contentLength - Content length/text for output token estimation
 * @param {string} targetFormat - Target format from FORMATS constant
 * @param {string} [model] - Model id; defaults to body.model
 */
export function estimateUsage(body, contentLength, targetFormat = FORMATS.OPENAI, model) {
  return formatUsage(
    estimateInputTokens(body, model),
    estimateOutputTokens(contentLength, model),
    targetFormat
  );
}

/**
 * Log usage with cache info (green color)
 */
export function logUsage(provider, usage, model = null, connectionId = null, apiKey = null) {
  if (!usage || typeof usage !== "object") return;

  // Console output moved to the unified "📊 done" line (streamingHandler). Kept as
  // a no-op hook so callers stay unchanged; usage persistence happens via saveUsageStats.
  if (!DEBUG_USAGE) return;

  const p = provider?.toUpperCase() || "UNKNOWN";

  // Support both formats:
  // - OpenAI: prompt_tokens, completion_tokens
  // - Claude: input_tokens, output_tokens
  const inTokens = usage?.prompt_tokens || usage?.input_tokens || 0;
  const outTokens = usage?.completion_tokens || usage?.output_tokens || 0;
  const accountPrefix = connectionId ? connectionId.slice(0, 8) + "..." : "unknown";

  let msg = `[${getTimeString()}] 📊 ${COLORS.green}[USAGE] ${p} | in=${inTokens} | out=${outTokens} | account=${accountPrefix}${COLORS.reset}`;

  // Add estimated flag if present
  if (usage.estimated) {
    msg += ` ${COLORS.yellow}(estimated)${COLORS.reset}`;
  }

  // Add cache info if present (unified from different formats)
  const cacheRead = usage.cache_read_input_tokens || usage.cached_tokens || usage.prompt_tokens_details?.cached_tokens;
  if (cacheRead) msg += ` | cache_read=${cacheRead}`;

  const cacheCreation = usage.cache_creation_input_tokens;
  if (cacheCreation) msg += ` | cache_create=${cacheCreation}`;

  const reasoning = usage.reasoning_tokens;
  if (reasoning) msg += ` | reasoning=${reasoning}`;

  console.log(msg);
}
