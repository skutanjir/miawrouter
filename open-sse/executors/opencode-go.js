import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { getModelTargetFormat } from "../config/providerModels.js";
import { injectReasoningContent } from "../utils/reasoningContentInjector.js";
import { ANTHROPIC_API_VERSION } from "../providers/shared.js";
import { resolveSessionId } from "../utils/sessionManager.js";
import crypto from "crypto";

const usesMessagesFormat = (model) => getModelTargetFormat("opencode-go", model) === "claude";

const BASE = "https://opencode.ai/zen/go/v1";

export class OpenCodeGoExecutor extends BaseExecutor {
  constructor() {
    super("opencode-go", PROVIDERS["opencode-go"]);
  }

  // buildUrl runs before buildHeaders in BaseExecutor.execute, cache model here
  buildUrl(model) {
    this._lastModel = model;
    return usesMessagesFormat(model)
      ? `${BASE}/messages`
      : `${BASE}/chat/completions`;
  }

  transformRequest(model, body, stream, credentials) {
    this._lastBody = body;
    return injectReasoningContent({ provider: this.provider, model, body });
  }

  buildHeaders(credentials, stream = true) {
    const key = credentials?.apiKey || credentials?.accessToken;
    const headers = { "Content-Type": "application/json" };

    if (usesMessagesFormat(this._lastModel)) {
      headers["x-api-key"] = key;
      headers["anthropic-version"] = ANTHROPIC_API_VERSION;
    } else {
      headers["Authorization"] = `Bearer ${key}`;
    }

    const clientSession = credentials?.rawHeaders?.["x-opencode-session"]
      || credentials?.rawHeaders?.["x-opencode-session-id"]
      || credentials?.rawHeaders?.["x-session-id"];

    const sessionId = clientSession || resolveSessionId({
      headers: credentials?.rawHeaders,
      body: this._lastBody,
      connectionId: credentials?.connectionId,
      scope: "opencode-go",
    }) || crypto.randomUUID();

    headers["x-opencode-session"] = sessionId;
    headers["x-opencode-client"] = credentials?.rawHeaders?.["x-opencode-client"] || "cli";

    if (stream) headers["Accept"] = "text/event-stream";
    return headers;
  }
}

