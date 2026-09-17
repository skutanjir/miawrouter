// HTTP status codes
export const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  NOT_ACCEPTABLE: 406,
  REQUEST_TIMEOUT: 408,
  RATE_LIMITED: 429,
  SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

// Re-export error config (backward compat)
export { ERROR_TYPES, DEFAULT_ERROR_MESSAGES, BACKOFF_CONFIG, COOLDOWN_MS } from "./errorConfig.js";

// Cache TTLs (seconds)
export const CACHE_TTL = {
  userInfo: 300,    // 5 minutes
  modelAlias: 3600  // 1 hour
};

// Memory management config
export const MEMORY_CONFIG = {
  sessionTtlMs: 2 * 60 * 60 * 1000,
  sessionCleanupIntervalMs: 30 * 60 * 1000,
  dnsCacheTtlMs: 5 * 60 * 1000,
  proxyDispatchersMaxSize: 20,
};

// Parse a positive integer env override, falling back to a default.
function envMs(name, def) {
  const raw = process.env[name];
  if (raw == null || raw === "") return def;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function envUrl(name, def) {
  const raw = process.env[name]?.trim();
  return raw || def;
}

// Boolean env override: unset → default; "0"/"false"/"off"/"no" → false.
function envBool(name, def) {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw == null || raw === "") return def;
  if (["0", "false", "off", "no"].includes(raw)) return false;
  if (["1", "true", "on", "yes"].includes(raw)) return true;
  return def;
}

// SearXNG endpoint used by the unauthenticated web-search provider.
// Configure this for a separate Docker service or remote SearXNG instance.
export const SEARXNG_URL = envUrl("SEARXNG_URL", "http://localhost:8888/search");

// Inter-chunk stall timeout (once tokens are flowing). Generous headroom so
// slow reasoning models aren't aborted mid-stream. Env: STREAM_STALL_TIMEOUT_MS.
export const STREAM_STALL_TIMEOUT_MS = envMs("STREAM_STALL_TIMEOUT_MS", 360 * 1000);

// Time-to-first-token timeout (prompt prefill). Env: STREAM_FIRST_CHUNK_TIMEOUT_MS.
export const STREAM_FIRST_CHUNK_TIMEOUT_MS = envMs("STREAM_FIRST_CHUNK_TIMEOUT_MS", 200 * 1000);

// Fetch connect timeout: abort if upstream doesn't return response headers within this duration
export const FETCH_CONNECT_TIMEOUT_MS = envMs("FETCH_CONNECT_TIMEOUT_MS", 60 * 1000);

// Gemini native TTS fetch timeout: abort if Google does not return response headers in time.
export const GEMINI_NATIVE_TTS_FETCH_TIMEOUT_MS = envMs("GEMINI_NATIVE_TTS_FETCH_TIMEOUT_MS", 45 * 1000);

// Default token limits
export const DEFAULT_MAX_TOKENS = 64000;
export const DEFAULT_MIN_TOKENS = 32000;

// Inbound client header: new writes use x-miaw-token-saver; legacy
// x-9router-token-saver remains accepted read-only for existing clients.
export const TOKEN_SAVER_HEADER = "x-miaw-token-saver";
export const LEGACY_TOKEN_SAVER_HEADER = "x-9router-token-saver";

// Retry config for 429 responses (legacy - kept for backward compatibility)
export const RETRY_CONFIG = {
  maxAttempts: 2,
  delayMs: 2000
};

// Default retry config by status code: { attempts, delayMs }
// Backward compat: if value is a number, treated as attempts with RETRY_CONFIG.delayMs
export const DEFAULT_RETRY_CONFIG = {
  429: { attempts: 0, delayMs: 0 },
  502: { attempts: 3, delayMs: 3000 },
  503: { attempts: 3, delayMs: 2000 },
  504: { attempts: 2, delayMs: 3000 }
};

// Normalize a retry entry to { attempts, delayMs }
export function resolveRetryEntry(entry) {
  if (entry == null) return { attempts: 0, delayMs: RETRY_CONFIG.delayMs };
  if (typeof entry === "number") return { attempts: entry, delayMs: RETRY_CONFIG.delayMs };
  return {
    attempts: entry.attempts || 0,
    delayMs: entry.delayMs != null ? entry.delayMs : RETRY_CONFIG.delayMs
  };
}

// Requests containing these texts will bypass provider
export const SKIP_PATTERNS = [
  "Please write a 5-10 word title for the following conversation:"
];

// ---------------------------------------------------------------------------
// Observability. `enabled: false` makes /api/metrics return 404 so the endpoint
// can be removed from a hostile/exposed deployment with one env var.
// ---------------------------------------------------------------------------
export const METRICS_CONFIG = {
  enabled: envBool("MIAW_METRICS", true)
};

// ---------------------------------------------------------------------------
// Backpressure: bounds on simultaneous upstream work.
// Defaults are generous (a local router may serve several agent sessions at
// once); set any value to 0 to disable that specific bound. Env overrides use
// the MIAW_ prefix so they can be tuned per deployment without a rebuild.
// ---------------------------------------------------------------------------
export const CONCURRENCY_CONFIG = {
  // Total simultaneous upstream requests across every provider.
  globalMax: envMs("MIAW_MAX_CONCURRENT", 256),
  // Simultaneous upstream requests per provider id.
  providerMax: envMs("MIAW_PROVIDER_MAX_CONCURRENT", 64),
  // Simultaneous upstream requests per provider connection (= account).
  connectionMax: envMs("MIAW_CONNECTION_MAX_CONCURRENT", 32),
  // Requests allowed to wait for a slot before being rejected with 503.
  queueMax: envMs("MIAW_QUEUE_MAX", 512),
  // How long a queued request may wait for a free slot before giving up.
  queueTimeoutMs: envMs("MIAW_QUEUE_TIMEOUT_MS", 120 * 1000)
};

// ---------------------------------------------------------------------------
// Inbound request safety limits. These exist to reject pathological payloads
// early (never to cap legitimate long-context work), so defaults are high;
// 0 disables a given check. Body size is additionally bounded by
// `proxyClientMaxBodySize` in next.config.mjs at the edge.
// ---------------------------------------------------------------------------
export const REQUEST_LIMITS = {
  maxBodyBytes: envMs("MIAW_MAX_BODY_BYTES", 64 * 1024 * 1024),
  maxMessages: envMs("MIAW_MAX_MESSAGES", 20000),
  maxTools: envMs("MIAW_MAX_TOOLS", 1024),
  maxToolSchemaBytes: envMs("MIAW_MAX_TOOL_SCHEMA_BYTES", 8 * 1024 * 1024)
};
