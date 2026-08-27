// PXPIPE: render bulky context as dense PNGs via pxpipe-proxy's library API
// (transformAnthropicMessages). Supports Claude format directly, plus OpenAI and
// Responses shapes via lossless request bridges so non-Claude clients and
// providers (OpenCode, Cursor, Codex, OpenAI-compatible) also benefit from
// multimodal image compression.
// Fail-open like every token saver: any error/timeout returns { body: null, summary }
// and leaves the request untouched.
import { FORMATS } from "../translator/formats.js";
import { openaiToClaudeRequest } from "../translator/request/openai-to-claude.js";
import { claudeToOpenAIRequest } from "../translator/request/claude-to-openai.js";
import {
  openaiResponsesToOpenAIRequest,
  openaiToOpenAIResponsesRequest,
} from "../translator/request/openai-responses.js";

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MIN_CHARS = 25000;
// pxpipe's own profitability gate assumes ~4 chars/token; reuse it for the
// estimated before/after numbers surfaced in stats (marked "estimated" in UI).
const EST_CHARS_PER_TOKEN = 4;

function bodyChars(body) {
  try {
    return JSON.stringify(body)?.length || 0;
  } catch {
    return 0;
  }
}

function estTokens(chars) {
  return Math.round(chars / EST_CHARS_PER_TOKEN);
}

function skipped(reason, extra = {}) {
  return { body: null, summary: { applied: false, reason, ...extra } };
}

// Transform a request body through pxpipe. Returns
// { body: <new body object> | null, summary } — body is null when nothing changed.
// opts.transform is injected by the host (src side) so open-sse stays free of
// filesystem/install concerns and remains usable standalone.
export async function compressWithPxpipe(body, { enabled, format, model, minChars, timeoutMs, transform } = {}) {
  if (!enabled) return skipped("disabled");
  if (typeof transform !== "function") return skipped("not_installed");
  if (!body) return skipped("missing_body");

  // OpenAI format bridge: translate OpenAI -> Claude -> compress -> OpenAI.
  // This lets OpenCode CLI, Aider, Cline, and OpenAI-compatible providers
  // enjoy image context compression without unsupported_format bailouts.
  if (format === FORMATS.OPENAI || (format !== FORMATS.CLAUDE && format !== FORMATS.OPENAI_RESPONSES && Array.isArray(body.messages))) {
    try {
      const claudeReq = openaiToClaudeRequest(model, body, false);
      if (Array.isArray(claudeReq?.system)) {
        claudeReq.system = claudeReq.system.filter(b => !b?.text || !b.text.includes("You are Claude Code"));
      }
      const res = await compressWithPxpipe(claudeReq, { enabled, format: FORMATS.CLAUDE, model, minChars, timeoutMs, transform });
      if (!res?.body) return res;
      const oaiBody = claudeToOpenAIRequest(model, res.body, false);
      return { body: oaiBody, summary: res.summary };
    } catch (e) {
      return skipped("transform_error", { detail: e?.message || String(e) });
    }
  }

  // OpenAI Responses format bridge (Codex): Responses -> OpenAI -> Claude -> compress -> OpenAI -> Responses.
  if (format === FORMATS.OPENAI_RESPONSES) {
    try {
      const oai = openaiResponsesToOpenAIRequest(model, body, false);
      if (!Array.isArray(oai?.messages)) return skipped("unsupported_format", { detail: "responses missing messages" });
      const res = await compressWithPxpipe(oai, { enabled, format: FORMATS.OPENAI, model, minChars, timeoutMs, transform });
      if (!res?.body) return res;
      const responsesBody = openaiToOpenAIResponsesRequest(
        model,
        { ...oai, input: undefined, messages: res.body.messages },
        false
      );
      return { body: responsesBody, summary: res.summary };
    } catch (e) {
      return skipped("transform_error", { detail: e?.message || String(e) });
    }
  }

  if (format !== FORMATS.CLAUDE) return skipped("unsupported_format", { detail: format });

  const startedAt = Date.now();
  // Serialize ONCE: the string feeds both the size gate and the transform
  // input (previously JSON.stringify ran twice on every request — for bulky
  // contexts that alone costs hundreds of ms of CPU).
  let json;
  try {
    json = JSON.stringify(body);
  } catch {
    return skipped("transform_error", { detail: "body not serializable" });
  }
  const originalChars = json?.length || 0;
  const threshold = Number(minChars) > 0 ? Number(minChars) : DEFAULT_MIN_CHARS;
  if (originalChars < threshold) {
    return skipped("below_threshold", { originalChars, threshold });
  }

  let timer;
  try {
    const encoded = new TextEncoder().encode(json);
    const budget = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
    // transformAnthropicMessages is local CPU work and can't be aborted; race a
    // timer and discard the result if it loses (input body is never mutated).
    const result = await Promise.race([
      transform({
        body: encoded,
        model,
        options: { minCompressChars: threshold },
      }),
      new Promise((resolve) => { timer = setTimeout(() => resolve(null), budget); }),
    ]);
    if (!result) return skipped("timeout", { originalChars, durationMs: Date.now() - startedAt });
    if (!result.applied) {
      return skipped(result.reason || "passthrough", {
        detail: result.detail,
        originalChars,
        durationMs: Date.now() - startedAt,
      });
    }

    const newBody = JSON.parse(new TextDecoder().decode(result.body));
    const compressedBodyChars = bodyChars(newBody);
    const info = result.info || {};
    const imagedChars = info.compressedChars || 0;
    // The transformed body is BIGGER in bytes (base64 PNGs) but cheaper in tokens:
    // images bill by pixels (Anthropic: pixels/750), not by encoded length. So the
    // after-estimate is remaining-text tokens + image tokens — never chars/4 of the
    // new body. Provider-billed usage recorded per request stays the ground truth.
    const imageTokensEst = info.imageTokens
      || (info.imagePixels ? Math.round(info.imagePixels / 750) : (info.imageCount || 0) * 4761);
    const summary = {
      applied: true,
      reason: "applied",
      originalChars,
      compressedBodyChars,
      imagedChars,
      imageCount: info.imageCount || 0,
      imageBytes: info.imageBytes || 0,
      tokensBeforeEst: info.baselineTokens || estTokens(originalChars),
      tokensAfterEst: estTokens(Math.max(0, originalChars - imagedChars)) + imageTokensEst,
      durationMs: Date.now() - startedAt,
      cacheOwnsControl: result.cache?.ownsCacheControl === true,
    };
    summary.tokensSavedEst = Math.max(0, summary.tokensBeforeEst - summary.tokensAfterEst);
    summary.savedPct = summary.tokensBeforeEst > 0
      ? +((summary.tokensSavedEst / summary.tokensBeforeEst) * 100).toFixed(2)
      : 0;
    return { body: newBody, summary };
  } catch (e) {
    return skipped("transform_error", { detail: e?.message || String(e), originalChars, durationMs: Date.now() - startedAt });
  } finally {
    // Never leave the race timer hanging on the event loop when the transform
    // wins (previously kept the process alive up to timeoutMs per request).
    if (timer) clearTimeout(timer);
  }
}

export function formatPxpipeLog(summary) {
  if (!summary) return null;
  if (!summary.applied) return null;
  return `imaged ${summary.imagedChars}ch → ${summary.imageCount} image(s) | est ${summary.tokensBeforeEst}→${summary.tokensAfterEst} tokens (-${summary.savedPct}%) | ${summary.durationMs}ms`;
}
