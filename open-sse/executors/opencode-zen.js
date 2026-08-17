import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";
import { ANTHROPIC_API_VERSION } from "../providers/shared.js";

const BASE_URL = "https://opencode.ai/zen/v1";

function modelFormat(model) {
  if (model.startsWith("claude-") || model.startsWith("qwen")) return "claude";
  if (model.startsWith("gemini-")) return "gemini";
  if (model.startsWith("gpt-") || model.startsWith("grok-")) return "openai-responses";
  return "openai";
}

export class OpenCodeZenExecutor extends BaseExecutor {
  constructor() {
    super("opencode-zen", PROVIDERS["opencode-zen"]);
  }

  buildUrl(model, stream) {
    switch (modelFormat(model)) {
      case "claude":
        return `${BASE_URL}/messages`;
      case "gemini":
        return `${BASE_URL}/models/${model}:${stream ? "streamGenerateContent?alt=sse" : "generateContent"}`;
      case "openai-responses":
        return `${BASE_URL}/responses`;
      default:
        return `${BASE_URL}/chat/completions`;
    }
  }

  buildHeaders(credentials, stream = true, _url, model) {
    const key = credentials?.apiKey || credentials?.accessToken;
    const headers = { "Content-Type": "application/json" };
    const format = modelFormat(model);

    if (format === "claude") {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = ANTHROPIC_API_VERSION;
    } else if (format === "gemini") {
      headers["x-goog-api-key"] = key;
    } else {
      headers["Authorization"] = `Bearer ${key}`;
    }

    if (stream) headers["Accept"] = "text/event-stream";
    return headers;
  }

  transformRequest(model, body) {
    return injectReasoningContent({ provider: this.provider, model, body });
  }
}
