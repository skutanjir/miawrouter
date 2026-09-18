import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";

// Models that use /zen/v1/messages (claude format)
const MESSAGES_MODELS = new Set();

export class OpenCodeExecutor extends BaseExecutor {
  constructor() {
    super("opencode", PROVIDERS.opencode);
  }

  transformRequest(model, body) {
    return injectReasoningContent({ provider: this.provider, model, body });
  }

  buildUrl(model) {
    const base = this.config.baseUrl;
    return MESSAGES_MODELS.has(model)
      ? `${base}/zen/v1/messages`
      : `${base}/zen/v1/chat/completions`;
  }

  buildHeaders(credentials) {
    const headers = {
      "Content-Type": "application/json",
      "Authorization": "Bearer public",
      "x-opencode-client": "desktop",
      "Accept": "text/event-stream"
    };
    const userAgent = credentials?.rawHeaders?.["user-agent"];
    if (/^opencode\//i.test(userAgent || "")) headers["User-Agent"] = userAgent;
    return headers;
  }

  parseError(response, bodyText) {
    try {
      const error = JSON.parse(bodyText)?.error;
      if (response.status === 403 && error?.type === "FreeTierError") {
        return {
          status: 403,
          message: "OpenCode Free rejected this client. Use OpenCode CLI for free models, or connect OpenCode Zen with an API key."
        };
      }
    } catch {
      // Use the base parser for non-JSON upstream errors.
    }
    return super.parseError(response, bodyText);
  }
}
