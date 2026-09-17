// Provider-side prompt-cache capability model.
//
// One question drives the pipeline: MAY we inject a vendor cache marker into the
// outbound body? Cache semantics are not interoperable across providers, so the
// answer is per provider family — never "the body has messages[], so inject".
//
// Modes
//   explicit — the provider accepts a marker field on stable content
//              (Anthropic-style cache_control). L0 may add breakpoints.
//   implicit — the provider caches on its own. The router must NOT add marker
//              fields; it only reads the cache-token usage upstream reports.
//   none     — no prompt cache.
//   unknown  — no evidence. Treated as "never inject", and NEVER as "unsupported":
//              provider behavior evolves, so unknown stays unknown until evidence.
//
// Evidence tag per entry: code | test | live | inferred.
// Extending this model for a new provider family is a data change here — it never
// requires touching a translator.

export const CACHE_MODE = Object.freeze({
  EXPLICIT: "explicit",
  IMPLICIT: "implicit",
  NONE: "none",
  UNKNOWN: "unknown",
});

// Marker dialects the pipeline understands. Only the Anthropic dialect is wired.
export const CACHE_MARKER = Object.freeze({
  ANTHROPIC: "cache_control",
  NONE: null,
});

// Upstream usage field paths that carry cache accounting, used as documentation +
// contract-test vocabulary. Normalization itself lives in utils/usageTracking.js.
const USAGE_CLAUDE = Object.freeze({
  read: ["cache_read_input_tokens"],
  write: ["cache_creation_input_tokens"],
});
const USAGE_OPENAI = Object.freeze({
  read: ["prompt_tokens_details.cached_tokens", "input_tokens_details.cached_tokens"],
});
const USAGE_GEMINI = Object.freeze({
  read: ["cachedContentTokenCount", "usageMetadata.cachedContentTokenCount"],
});
const USAGE_DEEPSEEK = Object.freeze({
  read: ["prompt_cache_hit_tokens"],
  miss: ["prompt_cache_miss_tokens"],
});

const UNKNOWN_REC = Object.freeze({
  mode: CACHE_MODE.UNKNOWN,
  marker: CACHE_MARKER.NONE,
  usage: Object.freeze({}),
  evidence: "unknown",
  note: "No upstream cache evidence recorded. Conservative: no marker injection.",
});

// Format defaults. Target format is resolved per request by services/provider.js
// (getTargetFormat) or the model override, so the format — not the provider id —
// is the primary key here.
const BY_FORMAT = Object.freeze({
  claude: {
    mode: CACHE_MODE.EXPLICIT,
    marker: CACHE_MARKER.ANTHROPIC,
    usage: USAGE_CLAUDE,
    evidence: "code",
    // translator/formats/claude.js + translator/request/openai-to-claude.js keep
    // client cache_control verbatim; the claude registry entry also requests the
    // prompt-caching beta header. Anthropic-compatible third-party endpoints
    // (glm/kimi/minimax) share this format but their marker support is inferred.
    note: "Anthropic Messages API cache_control breakpoints (max 4).",
  },
  gemini: {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_GEMINI,
    evidence: "code",
    // Gemini has no request-side breakpoint marker; the explicit cachedContents
    // resource is a separate API object the router does not create.
    note: "Automatic caching; reports cachedContentTokenCount.",
  },
  "gemini-cli": {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_GEMINI,
    evidence: "code",
    note: "Gemini-family usage metadata; no marker dialect.",
  },
  vertex: {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_GEMINI,
    evidence: "code",
    note: "Gemini-compatible usage metadata; no marker dialect.",
  },
  antigravity: {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_GEMINI,
    evidence: "code",
    // cache/l0.js emitCacheUsage + utils/usageTracking.js both read the Gemini
    // cache field; there is no cache_control path anywhere for this format.
    note: "Implicit/content-based caching. Preserve stable prefix; never add markers.",
  },
  "openai-responses": {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_OPENAI,
    evidence: "code",
    note: "OpenAI automatic caching; cached tokens are a subset of input tokens.",
  },
});

// Provider overrides win over the format default.
const BY_PROVIDER = Object.freeze({
  openai: {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_OPENAI,
    evidence: "code",
    // OpenAI rejects request-side cache markers; formats/openai.js strips
    // cache_control by default for this format.
    note: "Automatic prompt caching; reports prompt_tokens_details.cached_tokens.",
  },
  deepseek: {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_DEEPSEEK,
    evidence: "code",
    note: "Context caching; reports prompt_cache_hit_tokens / prompt_cache_miss_tokens.",
  },
  openrouter: {
    mode: CACHE_MODE.IMPLICIT,
    marker: CACHE_MARKER.NONE,
    usage: USAGE_OPENAI,
    // Inferred, not verified: openrouter is an aggregator, so cache reporting is
    // whatever the routed upstream returns. The contract fixture declares cache
    // usage for it, which is a declaration and not evidence about any upstream.
    // Mode stays implicit because the router only mirrors upstream-reported usage
    // and never injects a marker — that holds whatever the routed provider does.
    evidence: "inferred",
    note: "Aggregator: cache reporting mirrors whichever upstream was routed.",
  },
  alicode: {
    mode: CACHE_MODE.EXPLICIT,
    marker: CACHE_MARKER.ANTHROPIC,
    usage: USAGE_OPENAI,
    evidence: "code",
    // quirks.preserveCacheControl (tests/unit/alicode-cache-control-2069.test.js).
    note: "DashScope-compatible; accepts cache_control markers.",
  },
  "alicode-intl": {
    mode: CACHE_MODE.EXPLICIT,
    marker: CACHE_MARKER.ANTHROPIC,
    usage: USAGE_OPENAI,
    evidence: "code",
    note: "DashScope-compatible; accepts cache_control markers.",
  },
  "alims-intl": {
    mode: CACHE_MODE.EXPLICIT,
    marker: CACHE_MARKER.ANTHROPIC,
    usage: USAGE_OPENAI,
    evidence: "code",
    note: "DashScope-compatible; accepts cache_control markers.",
  },
});

// Cache-capable provider ids that only report usage (no marker) — kept as an
// explicit list so the report can distinguish "known implicit" from "unknown".
export function listCacheModes() {
  const rows = [];
  for (const [format, rec] of Object.entries(BY_FORMAT)) rows.push({ key: format, kind: "format", ...rec });
  for (const [provider, rec] of Object.entries(BY_PROVIDER)) rows.push({ key: provider, kind: "provider", ...rec });
  return rows;
}

function normalizeFormat(format) {
  if (!format || typeof format !== "string") return null;
  // Openai responses variants resolve to the responses record.
  if (format === "codex" || format === "openai-response") return "openai-responses";
  return format;
}

/**
 * Resolve the prompt-cache capability for a provider/format pair.
 *
 * Precedence: the resolved TARGET FORMAT decides the marker dialect, because the
 * wire protocol is what accepts or rejects a marker. A provider override only
 * refines the generic `openai` format (where "openai-compatible" says nothing
 * about caching — one vendor may accept markers, another may reject them). This
 * ordering matters: `deepseek` has both an `openai` and a `claude` transport, and
 * only the claude one accepts cache_control.
 *
 * @param {string} provider Provider id (may be a provider/models alias).
 * @param {string} format Resolved format (FORMATS.*): target format for translated
 *   requests, or source format for a native passthrough request.
 * @returns {{provider:string, format:string|null, mode:string, marker:string|null,
 *   usage:object, evidence:string, note:string, supportsCacheMarkers:boolean}}
 */
export function resolveCacheCapability(provider = "", format = "") {
  const fmt = normalizeFormat(format);
  const formatRec = fmt ? BY_FORMAT[fmt] : null;
  const providerRec = fmt === "openai" || fmt === null ? BY_PROVIDER[provider] || null : null;
  const rec = formatRec || providerRec || UNKNOWN_REC;
  const supportsCacheMarkers = rec.mode === CACHE_MODE.EXPLICIT && rec.marker === CACHE_MARKER.ANTHROPIC;
  return {
    provider,
    format: fmt,
    mode: rec.mode,
    marker: rec.marker,
    usage: rec.usage || {},
    evidence: rec.evidence || "unknown",
    note: rec.note || "",
    supportsCacheMarkers,
  };
}

/**
 * Whether the router may insert vendor prompt-cache breakpoints into the outbound
 * body for this provider/format. False for implicit/none/unknown providers.
 *
 * @param {string} provider
 * @param {string} format
 * @returns {boolean}
 */
export function supportsCacheMarkers(provider = "", format = "") {
  return resolveCacheCapability(provider, format).supportsCacheMarkers;
}
