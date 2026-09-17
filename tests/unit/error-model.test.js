import { describe, it, expect } from "vitest";
import {
  ERROR_CATEGORY,
  buildErrorBody,
  classifyError,
  errorResponse,
  formatProviderError,
  parseUpstreamError,
  sanitizeErrorMessage,
} from "open-sse/utils/error.js";

function upstream(bodyText, status = 400) {
  return new Response(bodyText, { status, headers: { "Content-Type": "application/json" } });
}

describe("sanitizeErrorMessage", () => {
  it("redacts OpenAI-style keys", () => {
    const out = sanitizeErrorMessage("upstream said sk-proj-abc123DEF456ghi789 is invalid");
    expect(out).not.toContain("sk-proj-abc123DEF456ghi789");
    expect(out).toContain("[redacted]");
  });

  it("redacts Google API keys", () => {
    const out = sanitizeErrorMessage("key AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6 rejected");
    expect(out).not.toContain("AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6");
  });

  it("redacts JWT shaped OAuth tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const out = sanitizeErrorMessage(`token ${jwt} expired`);
    expect(out).not.toContain(jwt);
    expect(out).toContain("expired");
  });

  it("redacts echoed Authorization headers", () => {
    const out = sanitizeErrorMessage("Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345");
    expect(out).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
  });

  it("redacts credential-shaped key/value pairs", () => {
    const out = sanitizeErrorMessage('{"api_key":"abcdef0123456789","refresh_token":"zzz999888777666"}');
    expect(out).not.toContain("abcdef0123456789");
    expect(out).not.toContain("zzz999888777666");
  });

  it("keeps ordinary diagnostic text intact", () => {
    const msg = "Rate limit exceeded for model gpt-5.6, retry after 30s";
    expect(sanitizeErrorMessage(msg)).toBe(msg);
  });

  it("caps very long upstream bodies", () => {
    const out = sanitizeErrorMessage("x".repeat(5000));
    expect(out.length).toBeLessThan(2100);
    expect(out.endsWith("…")).toBe(true);
  });

  it("passes through non-strings untouched", () => {
    expect(sanitizeErrorMessage(undefined)).toBeUndefined();
    expect(sanitizeErrorMessage(null)).toBeNull();
  });
});

describe("classifyError", () => {
  it("classifies auth, quota, rate limit, outage, network, timeout", () => {
    expect(classifyError(401)).toBe(ERROR_CATEGORY.AUTHENTICATION);
    expect(classifyError(403)).toBe(ERROR_CATEGORY.AUTHENTICATION);
    expect(classifyError(402)).toBe(ERROR_CATEGORY.QUOTA);
    expect(classifyError(429)).toBe(ERROR_CATEGORY.RATE_LIMIT);
    expect(classifyError(500)).toBe(ERROR_CATEGORY.PROVIDER_OUTAGE);
    expect(classifyError(502)).toBe(ERROR_CATEGORY.PROVIDER_OUTAGE);
    expect(classifyError(400, "request timed out")).toBe(ERROR_CATEGORY.TIMEOUT);
    expect(classifyError(400, "fetch failed")).toBe(ERROR_CATEGORY.NETWORK);
  });

  it("prefers message text over a misleading status", () => {
    // Provider returns 500 for a quota problem — must not be reported as outage.
    expect(classifyError(500, "insufficient quota for this account")).toBe(ERROR_CATEGORY.QUOTA);
    expect(classifyError(500, "rate limit reached")).toBe(ERROR_CATEGORY.RATE_LIMIT);
  });

  it("classifies unsupported model and feature", () => {
    expect(classifyError(404)).toBe(ERROR_CATEGORY.UNSUPPORTED_MODEL);
    expect(classifyError(406)).toBe(ERROR_CATEGORY.UNSUPPORTED_FEATURE);
  });

  it("classifies invalid request and internal fallback", () => {
    expect(classifyError(400)).toBe(ERROR_CATEGORY.INVALID_REQUEST);
    expect(classifyError(200)).toBe(ERROR_CATEGORY.INTERNAL);
  });

  it("classifies router overload from a 503 + overload text", () => {
    expect(classifyError(503, "router overloaded")).toBe(ERROR_CATEGORY.ROUTER_OVERLOAD);
    expect(classifyError(503)).toBe(ERROR_CATEGORY.PROVIDER_OUTAGE);
  });
});

describe("buildErrorBody", () => {
  it("keeps the OpenAI envelope shape", () => {
    const body = buildErrorBody(429, "Rate limit exceeded");
    expect(body.error).toMatchObject({
      message: "Rate limit exceeded",
      type: "rate_limit_error",
      code: "rate_limit_exceeded",
    });
  });

  it("marks retryable categories", () => {
    expect(buildErrorBody(429, "slow down").error.retryable).toBe(true);
    expect(buildErrorBody(502, "bad gateway").error.retryable).toBe(true);
    expect(buildErrorBody(400, "bad field").error.retryable).toBe(false);
    expect(buildErrorBody(404, "model not found").error.retryable).toBe(false);
  });

  it("never leaks a credential embedded in the message", () => {
    const body = buildErrorBody(401, "invalid key sk-proj-abcdefghijkl0123456789");
    expect(body.error.message).not.toContain("sk-proj-abcdefghijkl0123456789");
  });

  it("falls back to the default message for the status", () => {
    expect(buildErrorBody(404, "").error.message).toBe("Model not found");
  });

  it("preserves a caller-supplied message verbatim when it is safe", () => {
    const msg = "Missing model";
    expect(buildErrorBody(400, msg).error.message).toBe(msg);
  });
});

describe("parseUpstreamError", () => {
  it("extracts error.message from a JSON upstream body", async () => {
    const r = await parseUpstreamError(
      upstream(JSON.stringify({ error: { message: "invalid model id" } }), 400)
    );
    expect(r.statusCode).toBe(400);
    expect(r.message).toBe("invalid model id");
  });

  it("extracts a top-level message", async () => {
    const r = await parseUpstreamError(upstream(JSON.stringify({ message: "boom" }), 500));
    expect(r.message).toBe("boom");
  });

  it("falls back to raw text when the body is not JSON", async () => {
    const r = await parseUpstreamError(upstream("<html><title>502 Bad Gateway</title></html>", 502));
    expect(r.statusCode).toBe(502);
    expect(r.message).toContain("Bad Gateway");
  });

  it("uses the default message for an empty body", async () => {
    const r = await parseUpstreamError(upstream("", 503));
    expect(r.message).toBe("Service temporarily unavailable");
  });

  it("redacts credentials echoed by the upstream", async () => {
    const r = await parseUpstreamError(
      upstream(JSON.stringify({ error: { message: "bad key sk-live-abcdefghijklmnop1234" } }), 401)
    );
    expect(r.message).not.toContain("sk-live-abcdefghijklmnop1234");
    expect(r.message).toContain("[redacted]");
  });

  it("redacts credentials in a non-JSON upstream body", async () => {
    const r = await parseUpstreamError(upstream("denied for key AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6", 403));
    expect(r.message).not.toContain("AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6");
  });

  it("honours an executor-specific parser and still sanitizes", async () => {
    const executor = {
      parseError: () => ({ status: 429, message: "retry with sk-proj-abcdefghijkl0123456789", resetsAtMs: 123 }),
    };
    const r = await parseUpstreamError(upstream("{}", 429), executor);
    expect(r.statusCode).toBe(429);
    expect(r.resetsAtMs).toBe(123);
    expect(r.message).not.toContain("sk-proj-abcdefghijkl0123456789");
  });

  it("falls through when the executor parser throws", async () => {
    const executor = {
      parseError: () => {
        throw new Error("nope");
      },
    };
    const r = await parseUpstreamError(upstream(JSON.stringify({ error: "plain" }), 400), executor);
    expect(r.message).toBe("plain");
  });
});

describe("formatProviderError", () => {
  it("keeps the code prefix and cause chain", () => {
    const err = Object.assign(new Error("socket hang up"), { cause: { code: "ECONNRESET" } });
    const out = formatProviderError(err, "openai", "gpt-5.6", 502);
    expect(out).toContain("[502]");
    expect(out).toContain("socket hang up");
    expect(out).toContain("ECONNRESET");
  });

  it("redacts a credential embedded in the error message", () => {
    const out = formatProviderError(new Error("auth failed: Bearer abcdefghijklmnopqrstuvwxyz012345"), "x", "y", 401);
    expect(out).not.toContain("abcdefghijklmnopqrstuvwxyz012345");
  });
});

describe("errorResponse", () => {
  it("returns JSON with the OpenAI error envelope", async () => {
    const res = errorResponse(400, "Missing model");
    expect(res.status).toBe(400);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const body = await res.json();
    expect(body.error.message).toBe("Missing model");
    expect(body.error.type).toBe("invalid_request_error");
  });
});
