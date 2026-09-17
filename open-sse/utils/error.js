import { ERROR_TYPES, DEFAULT_ERROR_MESSAGES } from "../config/errorConfig.js";

/**
 * Upstream providers occasionally echo the rejected request — credential
 * included — back inside their error body. That text is relayed to the client,
 * so strip credential-shaped substrings and cap the length (a HTML error page
 * must not be forwarded verbatim either).
 */
const SECRET_REDACTIONS = [
  // OpenAI / gateway style keys: sk-…, sk-proj-…, pk-…, rk-…
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{12,}/g, "[redacted]"],
  // Google API keys
  [/\bAIza[A-Za-z0-9_-]{20,}/g, "[redacted]"],
  // JWTs (OAuth access / id tokens)
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[redacted]"],
  // Slack tokens
  [/\bxox[baprs]-[A-Za-z0-9-]{8,}/g, "[redacted]"],
  // Authorization headers echoed back
  [/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/gi, "Bearer [redacted]"],
  // key: value / key="value" / "key": "value" pairs naming a credential
  [
    /((?:api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|id[-_]?token|client[-_]?secret|authorization|password)["']?\s*[:=]\s*["']?)[^\s"',;}]{12,}/gi,
    "$1[redacted]"
  ]
];

const MAX_ERROR_MESSAGE_CHARS = 2000;

/**
 * Strip credential-shaped substrings and cap length on text that is about to
 * reach a client. Safe on any string; returns non-strings untouched.
 * @param {string} message
 * @returns {string}
 */
export function sanitizeErrorMessage(message) {
  if (typeof message !== "string" || message.length === 0) return message;
  let out = message;
  for (const [pattern, replacement] of SECRET_REDACTIONS) out = out.replace(pattern, replacement);
  return out.length > MAX_ERROR_MESSAGE_CHARS
    ? `${out.slice(0, MAX_ERROR_MESSAGE_CHARS)}…`
    : out;
}

/**
 * Coarse, client-safe error taxonomy. Additive to the OpenAI envelope so a
 * caller (or an agent loop) can decide how to react without parsing prose.
 */
export const ERROR_CATEGORY = {
  AUTHENTICATION: "authentication_error",
  QUOTA: "quota_error",
  RATE_LIMIT: "rate_limit_error",
  PROVIDER_OUTAGE: "provider_outage",
  NETWORK: "network_error",
  TIMEOUT: "timeout_error",
  INVALID_REQUEST: "invalid_request_error",
  UNSUPPORTED_MODEL: "unsupported_model",
  UNSUPPORTED_FEATURE: "unsupported_feature",
  ROUTER_OVERLOAD: "router_overloaded",
  INTERNAL: "internal_error"
};

const RETRYABLE_CATEGORIES = new Set([
  ERROR_CATEGORY.QUOTA,
  ERROR_CATEGORY.RATE_LIMIT,
  ERROR_CATEGORY.PROVIDER_OUTAGE,
  ERROR_CATEGORY.NETWORK,
  ERROR_CATEGORY.TIMEOUT,
  ERROR_CATEGORY.ROUTER_OVERLOAD
]);

/**
 * Classify an error from its HTTP status plus message text. Text checks run
 * first because a provider that returns 500 for a quota problem should still be
 * reported as a quota problem — the same precedence the account fallback uses.
 * @param {number} statusCode
 * @param {string} [message]
 * @returns {string} one of ERROR_CATEGORY
 */
export function classifyError(statusCode, message = "") {
  const status = Number(statusCode) || 500;
  const text = String(message).toLowerCase();

  if (status === 401 || status === 403) return ERROR_CATEGORY.AUTHENTICATION;
  if (status === 402 || /quota|billing|insufficient (funds|balance)/.test(text)) return ERROR_CATEGORY.QUOTA;
  if (status === 429 || /rate limit|too many requests/.test(text)) return ERROR_CATEGORY.RATE_LIMIT;
  if (/timeout|timed out|etimedout/.test(text)) return ERROR_CATEGORY.TIMEOUT;
  if (/econnreset|enotfound|eai_again|socket hang up|fetch failed/.test(text)) return ERROR_CATEGORY.NETWORK;
  if (status === 404 || /model[_ -]not[_ -]found|no such model/.test(text)) return ERROR_CATEGORY.UNSUPPORTED_MODEL;
  if (status === 406 || /not supported|unsupported/.test(text)) return ERROR_CATEGORY.UNSUPPORTED_FEATURE;
  if (status === 503 && /overload/.test(text)) return ERROR_CATEGORY.ROUTER_OVERLOAD;
  if (status >= 500) return ERROR_CATEGORY.PROVIDER_OUTAGE;
  if (status >= 400) return ERROR_CATEGORY.INVALID_REQUEST;
  return ERROR_CATEGORY.INTERNAL;
}

/**
 * Build OpenAI-compatible error response body.
 * `category` and `retryable` are additive: SDKs ignore unknown fields, but an
 * agent loop can use them to distinguish a retryable outage from a bad request.
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {object} Error response object
 */
export function buildErrorBody(statusCode, message) {
  const errorInfo = ERROR_TYPES[statusCode] || 
    (statusCode >= 500 
      ? { type: "server_error", code: "internal_server_error" }
      : { type: "invalid_request_error", code: "" });

  const safeMessage =
    sanitizeErrorMessage(message) || DEFAULT_ERROR_MESSAGES[statusCode] || "An error occurred";
  const category = classifyError(statusCode, safeMessage);

  return {
    error: {
      message: safeMessage,
      type: errorInfo.type,
      code: errorInfo.code,
      category,
      retryable: RETRYABLE_CATEGORIES.has(category)
    }
  };
}

/**
 * Create error Response object (for non-streaming)
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {Response} HTTP Response object
 */
export function errorResponse(statusCode, message) {
  return new Response(JSON.stringify(buildErrorBody(statusCode, message)), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

/**
 * Write error to SSE stream (for streaming)
 * @param {WritableStreamDefaultWriter} writer - Stream writer
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 */
export async function writeStreamError(writer, statusCode, message) {
  const errorBody = buildErrorBody(statusCode, message);
  const encoder = new TextEncoder();
  await writer.write(encoder.encode(`data: ${JSON.stringify(errorBody)}\n\n`));
}

/**
 * Parse upstream provider error response
 * @param {Response} response - Fetch response from provider
 * @param {object} [executor] - Optional executor with parseError() override for provider-specific parsing
 * @returns {Promise<{statusCode: number, message: string, resetsAtMs?: number}>}
 */
export async function parseUpstreamError(response, executor = null) {
  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    bodyText = "";
  }

  // Let executor-specific parser extract provider-specific fields (e.g. codex resetsAtMs)
  if (executor && typeof executor.parseError === "function") {
    try {
      const parsed = executor.parseError(response, bodyText);
      if (parsed && typeof parsed === "object") {
        const msg = parsed.message || DEFAULT_ERROR_MESSAGES[response.status] || `Upstream error: ${response.status}`;
        return {
          statusCode: parsed.status || response.status,
          message: sanitizeErrorMessage(String(msg)),
          resetsAtMs: parsed.resetsAtMs
        };
      }
    } catch { /* fall through to default parsing */ }
  }

  let message = "";
  try {
    const json = JSON.parse(bodyText);
    message = json.error?.message || json.message || json.error || bodyText;
  } catch {
    message = bodyText;
  }

  const messageStr = typeof message === "string" ? message : JSON.stringify(message);
  const finalMessage = messageStr || DEFAULT_ERROR_MESSAGES[response.status] || `Upstream error: ${response.status}`;

  return { statusCode: response.status, message: sanitizeErrorMessage(finalMessage) };
}

/**
 * Create error result for chatCore handler
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {number} [resetsAtMs] - Optional precise cooldown expiry (ms epoch) for provider-specific quota errors
 * @returns {{ success: false, status: number, error: string, response: Response, resetsAtMs?: number }}
 */
export function createErrorResult(statusCode, message, resetsAtMs) {
  return {
    success: false,
    status: statusCode,
    error: message,
    resetsAtMs,
    response: errorResponse(statusCode, message)
  };
}

/**
 * Create unavailable response when all accounts are rate limited
 * @param {number} statusCode - Original error status code
 * @param {string} message - Error message (without retry info)
 * @param {string} retryAfter - ISO timestamp when earliest account becomes available
 * @param {string} retryAfterHuman - Human-readable retry info e.g. "reset after 30s"
 * @returns {Response}
 */
export function unavailableResponse(statusCode, message, retryAfter, retryAfterHuman) {
  const retryAfterSec = Math.max(Math.ceil((new Date(retryAfter).getTime() - Date.now()) / 1000), 1);
  const msg = `${message} (${retryAfterHuman})`;
  return new Response(
    JSON.stringify({ error: { message: msg } }),
    {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec)
      }
    }
  );
}

/**
 * Format provider error with context
 * @param {Error} error - Original error
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number|string} statusCode - HTTP status code or error code
 * @returns {string} Formatted error message
 */
export function formatProviderError(error, provider, model, statusCode) {
  const code = statusCode || error.code || "FETCH_FAILED";
  const message = error.message || "Unknown error";
  // Expose low-level cause (e.g. UND_ERR_SOCKET, ECONNRESET, ETIMEDOUT) for diagnosing fetch failures
  const causeCode = error.cause?.code;
  const causeMsg = error.cause?.message;
  const causeStr = causeCode || causeMsg ? ` (cause: ${[causeCode, causeMsg].filter(Boolean).join(": ")})` : "";
  // The message may embed an upstream URL or echoed Authorization header.
  return sanitizeErrorMessage(`[${code}]: ${message}${causeStr}`);
}
