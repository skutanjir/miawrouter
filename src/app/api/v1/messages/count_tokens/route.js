import { countTextTokens } from "open-sse/utils/tokenizer.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

/**
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

// Keys that describe the request envelope rather than payload the model reads.
// Counting the raw JSON body instead charged every estimate for braces, quotes
// and these key names — "hello world" came out at 14 tokens instead of 3.
const STRUCTURAL_KEYS = new Set([
  "role",
  "type",
  "id",
  "model",
  "media_type",
  "cache_control",
  "tool_use_id",
  "tool_call_id",
  "format",
  "alias"
]);

function collectText(node, out) {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (!STRUCTURAL_KEYS.has(key)) collectText(value, out);
  }
}

/**
 * Estimate the input tokens of an Anthropic-shaped request payload: system,
 * message content blocks (text, thinking, tool_use input, tool_result content)
 * and tool definitions. Exact BPE for OpenAI-family models, chars/4 otherwise.
 */
function countRequestTokens(body) {
  const parts = [];
  collectText(body.system, parts);
  collectText(body.messages, parts);
  collectText(body.tools, parts);
  return countTextTokens(parts.join("\n"), body.model);
}

/**
 * POST /v1/messages/count_tokens - Token count response
 * Uses the shared token counter: exact BPE for OpenAI-family models
 * (body.model), honest chars/4 estimate for other families.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  }

  const inputTokens = countRequestTokens(body);

  return new Response(JSON.stringify({
    input_tokens: inputTokens
  }), {
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}
