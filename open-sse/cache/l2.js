// L2 semantic response cache: reuses non-streaming responses for semantically
// similar requests using REAL embeddings (injected async `semanticEmbed`
// callback from src, which calls the local /v1/embeddings route) + cosine
// similarity. Never fake lexical matching. Fail-open on embedding errors.
//
// Entries are scoped by exact model, request format/account, and a fingerprint
// of the request context with the final user text replaced by a marker. This
// keeps semantic reuse inside the same system/history/settings context.

import crypto from "crypto";
import { emitCacheEvent } from "./events.js";
import { l1Key } from "./l1.js";

// familyKey -> Map<entryKey, { embedding, value, lastUsed, expiresAt }>
const store = new Map();

// Heuristic gate: prompts that ask for code are never semantically cached
// (stale code answers are worse than a miss). Fences and code-verb pairs.
const CODE_SHAPE_RE = /```|(write|create|implement|fix|build|refactor|generate|debug|explain)\s+(a|an|the)?\s*(function|class|module|script|api|endpoint|component|cli)\b/i;

function now() {
  return Date.now();
}

// Hash the raw scope (router API key + account connection) before it can land
// in a bucket key: isolation without ever storing the raw values.
function scopeHash(scope) {
  return scope ? crypto.createHash("sha256").update(scope).digest("hex").slice(0, 16) : "";
}

// Buckets isolate entries by scope, client response format, provider, and exact
// model. Context matching happens per entry so one bucket remains bounded by
// maxEntries instead of creating an unbounded Map for every conversation.
function familyKey({ provider, model, scope = "", sourceFormat = "", targetFormat = "" }) {
  return `${scopeHash(scope)}|${sourceFormat}|${targetFormat}|${provider}:${model || ""}`;
}

const SEMANTIC_QUERY_MARKER = "__miawrouter_semantic_query__";

function isUserItem(item) {
  return item?.role === "user" || (item?.type === "message" && item?.role === "user");
}

function maskUserText(item) {
  if (!item || typeof item !== "object") return item;
  if (typeof item.content === "string") return { ...item, content: SEMANTIC_QUERY_MARKER };
  if (!Array.isArray(item.content)) return item;
  return {
    ...item,
    content: item.content.map((block) => {
      if (typeof block === "string") return SEMANTIC_QUERY_MARKER;
      if (block && typeof block === "object" && typeof block.text === "string") {
        return { ...block, text: SEMANTIC_QUERY_MARKER };
      }
      return block;
    }),
  };
}

// Same request context, different final user question: this is the safe
// scope for semantic reuse. The exact L1 key already canonicalizes markers.
function semanticContextKey({ provider, model, scope, sourceFormat, targetFormat, body }) {
  const field = Array.isArray(body?.messages) ? "messages"
    : Array.isArray(body?.input) ? "input"
      : null;
  if (!field) return "";
  const items = body[field];
  let lastUserIndex = -1;
  for (let i = items.length - 1; i >= 0; i--) {
    if (isUserItem(items[i])) {
      lastUserIndex = i;
      break;
    }
  }
  if (lastUserIndex < 0) return "";
  const contextBody = {
    ...body,
    [field]: items.map((item, index) => index === lastUserIndex ? maskUserText(item) : item),
  };
  return l1Key({ provider, model, sourceFormat, targetFormat, body: contextBody, scope });
}

// Cosine similarity with a zero-vector guard. Pure math, no lexical features.
export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Embedding target: the last user message (the discriminating query). Returns
// "" for shapes without a readable user prompt.
export function lastUserText(body) {
  const items = Array.isArray(body?.messages) ? body.messages
    : Array.isArray(body?.input) ? body.input
    : null;
  if (!items) return "";
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (!item || typeof item !== "object") continue;
    if (item.role === "user") {
      if (typeof item.content === "string") return item.content;
      if (Array.isArray(item.content)) {
        const parts = [];
        for (const block of item.content) {
          if (typeof block === "string") parts.push(block);
          else if (block && typeof block.text === "string") parts.push(block.text);
        }
        if (parts.length > 0) return parts.join("\n");
      }
    }
    if (typeof item.type === "string" && /^message$/.test(item.type) && item.role === "user") {
      if (Array.isArray(item.content)) {
        const parts = [];
        for (const block of item.content) {
          if (block && typeof block.text === "string") parts.push(block.text);
        }
        if (parts.length > 0) return parts.join("\n");
      }
    }
  }
  return "";
}

export function looksLikeCodeGeneration(text) {
  if (!text) return false;
  return CODE_SHAPE_RE.test(text);
}

function sweepFamily(entries, ttlMs, maxEntries) {
  const t = now();
  for (const [key, entry] of entries) {
    if (t >= entry.expiresAt) entries.delete(key);
  }
  while (entries.size > maxEntries) {
    let oldestKey = null;
    let oldestUsed = Infinity;
    for (const [key, entry] of entries) {
      if (entry.lastUsed < oldestUsed) {
        oldestUsed = entry.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey === null) break;
    entries.delete(oldestKey);
  }
}

/**
 * Look up a semantically similar cached response.
 * Returns { value, similarity, key } or null (including on embedding failure).
 * `key` addresses the exact stored entry for later false-hit removal.
 */
export async function l2Lookup({ provider, model, scope = "", sourceFormat = "", targetFormat = "", body, semanticEmbed, threshold = 0.92, onCacheEvent = null } = {}) {
  const startedAt = Date.now();
  const text = lastUserText(body);
  if (!text) return null;
  if (looksLikeCodeGeneration(text)) return null;
  const contextKey = semanticContextKey({ provider, model, scope, sourceFormat, targetFormat, body });
  if (!contextKey) return null;

  const family = familyKey({ provider, model, scope, sourceFormat, targetFormat });
  const entries = store.get(family);
  if (!entries || entries.size === 0) return null;

  let embedding;
  try {
    embedding = await semanticEmbed(text);
  } catch {
    emitCacheEvent(onCacheEvent, { type: "cache_l2", action: "embed_error", ts: Date.now(), provider, model, durationMs: Date.now() - startedAt });
    return null;
  }
  if (!Array.isArray(embedding) || embedding.length === 0) return null;

  let best = null;
  let bestSim = -1;
  const t = now();
  for (const [key, entry] of entries) {
    if (entry.contextKey !== contextKey) continue;
    if (t >= entry.expiresAt) continue;
    const sim = cosine(embedding, entry.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      best = { key, entry };
    }
  }
  if (!best || bestSim < threshold) return null;

  best.entry.lastUsed = now();
  emitCacheEvent(onCacheEvent, {
    type: "cache_l2",
    action: "hit",
    ts: Date.now(),
    provider,
    model,
    key: best.key,
    similarity: +bestSim.toFixed(4),
    durationMs: Date.now() - startedAt,
  });
  return { value: best.entry.value, similarity: bestSim, key: best.key };
}

/**
 * Store a response in the semantic cache (fire-and-forget from the caller).
 * Returns true when stored. Embedding errors are swallowed (fail-open).
 */
export async function l2Store({ provider, model, scope = "", sourceFormat = "", targetFormat = "", body, key = null, value, semanticEmbed, ttlMs = 3600000, maxEntries = 100, onCacheEvent = null } = {}) {
  const text = lastUserText(body);
  if (!text) return false;
  if (looksLikeCodeGeneration(text)) return false;
  const contextKey = semanticContextKey({ provider, model, scope, sourceFormat, targetFormat, body });
  if (!contextKey) return false;

  let embedding;
  try {
    embedding = await semanticEmbed(text);
  } catch { return false; }
  if (!Array.isArray(embedding) || embedding.length === 0) return false;

  const family = familyKey({ provider, model, scope, sourceFormat, targetFormat });
  let entries = store.get(family);
  if (!entries) {
    entries = new Map();
    store.set(family, entries);
  }
  sweepFamily(entries, ttlMs, maxEntries);

  // Use the lookup key when provided (the pre-L3 body is what was queried),
  // otherwise derive from the given body + scope.
  const entryKey = key || l1Key({ provider, model, sourceFormat, targetFormat, body, scope });
  entries.set(entryKey, {
    embedding,
    value,
    contextKey,
    lastUsed: now(),
    expiresAt: now() + ttlMs,
  });

  emitCacheEvent(onCacheEvent, {
    type: "cache_l2",
    action: "store",
    ts: Date.now(),
    provider,
    model,
    similarity: null,
  });
  return true;
}

// Metadata API for the later dashboard / false-hit reporting.
export function l2Stats() {
  const families = [];
  for (const [family, entries] of store) {
    families.push({ family, entries: entries.size });
  }
  return { families, totalEntries: families.reduce((n, f) => n + f.entries, 0) };
}

/** Remove a stored entry (e.g. a reported false positive). Returns true if removed. */
export function markFalseHit({ provider, model, scope = "", sourceFormat = "", targetFormat = "", key, onCacheEvent = null } = {}) {
  const family = familyKey({ provider, model, scope, sourceFormat, targetFormat });
  const entries = store.get(family);
  if (!entries) return false;
  const removed = entries.delete(key);
  if (removed) emitCacheEvent(onCacheEvent, { type: "cache_l2", action: "false_hit_removed", ts: Date.now(), provider, model });
  return removed;
}

export function l2Clear() {
  store.clear();
}
