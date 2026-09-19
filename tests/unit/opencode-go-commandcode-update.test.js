import { describe, expect, it } from "vitest";
import { canAttemptTokenRefresh } from "../../open-sse/handlers/chatCore.js";
import { PROVIDER_MODELS, getModelUpstreamId } from "../../open-sse/config/providerModels.js";
import { PROVIDERS } from "../../open-sse/config/providers.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getPricingForModel } from "../../open-sse/providers/pricing.js";
import { checkFallbackError } from "../../open-sse/services/accountFallback.js";
import { openaiToCommandCodeRequest } from "../../open-sse/translator/request/openai-to-commandcode.js";
import { commandCodeToOpenAIResponse } from "../../open-sse/translator/response/commandcode-to-openai.js";
import { OpenCodeGoExecutor } from "../../open-sse/executors/opencode-go.js";

describe("OpenCode Go and CommandCode model updates", () => {
  it("includes all new models in OpenCode Go registry", () => {
    const ocgModels = (PROVIDER_MODELS["opencode-go"] || []).map((m) => m.id);
    const expected = [
      "deepseek-v4.1-flash",
      "deepseek-v4.1-flash-low",
      "deepseek-v4.1-flash-high",
      "deepseek-v4.1-flash-max",
      "grok-4.6",
      "grok-4.6-low",
      "grok-4.6-medium",
      "grok-4.6-high",
      "grok-4.6-xhigh",
      "hy4-preview",
      "hy4-preview-none",
      "hy4-preview-high",
      "longcat-2.0",
      "muse-spark-1.3-contributor",
      "omen-alpha",
      "ox-alpha-free",
      "qwen3.8-flash",
      "qwen3.8-flash-low",
      "qwen3.8-flash-medium",
      "qwen3.8-flash-xhigh",
    ];

    for (const id of expected) {
      expect(ocgModels).toContain(id);
    }
  });

  it("includes all new models in CommandCode registry and uses CLI version 1.54.0", () => {
    const ccProvider = PROVIDERS["commandcode"];
    expect(ccProvider.headers["x-command-code-version"]).toBe("1.54.0");

    const ccModels = (PROVIDER_MODELS["commandcode"] || []).map((m) => m.id);
    const expected = [
      "claude-fable-5-1",
      "deepseek/deepseek-v4-flash-vision-exp",
      "deepseek/deepseek-v4-flash-fast",
      "deepseek/deepseek-v4.1-flash",
      "z-ai/glm-5.3-flash",
      "Qwen/Qwen3.8-Max-0902",
      "Qwen/Qwen3.8-Flash",
      "meituan/LongCat-2.0:free",
      "tencent/hy4-preview",
      "google/gemini-3.8-flash",
      "inclusionai/ling-3.0-flash-sante:free",
      "meta/muse-spark-1.3",
      "meta/muse-spark-1.3-contributor",
    ];

    for (const id of expected) {
      expect(ccModels).toContain(id);
    }
  });

  it("resolves capabilities correctly for new models", () => {
    // DeepSeek V4.1 Flash
    const dsCaps = getCapabilitiesForModel("opencode-go", "deepseek-v4.1-flash");
    expect(dsCaps.vision).toBe(true);
    expect(dsCaps.reasoning).toBe(true);
    expect(dsCaps.contextWindow).toBe(1000000);

    // Qwen 3.8 Flash
    const qwenCaps = getCapabilitiesForModel("opencode-go", "qwen3.8-flash");
    expect(qwenCaps.vision).toBe(true);
    expect(qwenCaps.reasoning).toBe(true);
    expect(qwenCaps.contextWindow).toBe(1000000);

    // Claude Fable 5.1
    const fableCaps = getCapabilitiesForModel("commandcode", "claude-fable-5-1");
    expect(fableCaps.vision).toBe(true);
    expect(fableCaps.reasoning).toBe(true);
    expect(fableCaps.contextWindow).toBe(1000000);

    // LongCat 2.0
    const lcCaps = getCapabilitiesForModel("commandcode", "meituan/LongCat-2.0:free");
    expect(lcCaps.reasoning).toBe(true);
    expect(lcCaps.contextWindow).toBe(1000000);

    // Hy4
    const hy4Caps = getCapabilitiesForModel("opencode-go", "hy4-preview");
    expect(hy4Caps.reasoning).toBe(true);
    expect(hy4Caps.contextWindow).toBe(1024000);

    // GLM 5.3
    const glmCaps = getCapabilitiesForModel("commandcode", "z-ai/glm-5.3-flash");
    expect(glmCaps.reasoning).toBe(true);
    expect(glmCaps.contextWindow).toBe(1000000);
  });

  it("resolves pricing correctly for new models and variants", () => {
    expect(getPricingForModel("opencode-go", "deepseek-v4.1-flash")).toEqual({
      input: 0.15,
      output: 0.60,
      cached: 0.003,
      reasoning: 0.60,
      cache_creation: 0.15,
    });

    expect(getPricingForModel("opencode-go", "deepseek-v4.1-flash-high")).toEqual({
      input: 0.15,
      output: 0.60,
      cached: 0.003,
      reasoning: 0.60,
      cache_creation: 0.15,
    });

    expect(getPricingForModel("opencode-go", "qwen3.8-flash")).toEqual({
      input: 0.15,
      output: 0.47,
      cached: 0.016,
      reasoning: 0.47,
      cache_creation: 0.20,
    });

    expect(getPricingForModel("commandcode", "claude-fable-5-1")).toEqual({
      input: 10.00,
      output: 50.00,
      cached: 1.00,
      reasoning: 50.00,
      cache_creation: 12.50,
    });

    expect(getPricingForModel("opencode-go", "ox-alpha-free")).toEqual({
      input: 0,
      output: 0,
      cached: 0,
      reasoning: 0,
      cache_creation: 0,
    });
  });

  it("maps OpenCode Go effort variants to upstream base models with reasoning suffix", () => {
    expect(getModelUpstreamId("opencode-go", "deepseek-v4.1-flash-high")).toBe("deepseek-v4.1-flash(high)");
    expect(getModelUpstreamId("opencode-go", "deepseek-v4.1-flash-low")).toBe("deepseek-v4.1-flash(low)");
    expect(getModelUpstreamId("opencode-go", "deepseek-v4.1-flash-max")).toBe("deepseek-v4.1-flash(max)");
    expect(getModelUpstreamId("opencode-go", "glm-5.2-high")).toBe("glm-5.2(high)");
    expect(getModelUpstreamId("opencode-go", "kimi-k3-max")).toBe("kimi-k3(max)");
    expect(getModelUpstreamId("opencode-go", "hy3-high")).toBe("hy3(high)");
    expect(getModelUpstreamId("opencode-go", "grok-4.6-xhigh")).toBe("grok-4.6(xhigh)");
    expect(getModelUpstreamId("opencode-go", "qwen3.8-flash-xhigh")).toBe("qwen3.8-flash(xhigh)");
  });

  it("guards token refresh against API-key providers and recognizes refreshable OAuth/IDE providers", () => {
    const mockExecutor = { refreshCredentials: () => {} };

    // API-key providers must never attempt token refresh
    expect(canAttemptTokenRefresh("opencode-go", { apiKey: "oc-123" }, mockExecutor)).toBe(false);
    expect(canAttemptTokenRefresh("commandcode", { apiKey: "user_123" }, mockExecutor)).toBe(false);
    expect(canAttemptTokenRefresh("openai", { apiKey: "sk-123" }, mockExecutor)).toBe(false);

    // OAuth / Service Account providers with tokens can refresh
    expect(canAttemptTokenRefresh("grok-cli", { refreshToken: "rt-123" }, mockExecutor)).toBe(true);
    expect(canAttemptTokenRefresh("antigravity", { refreshToken: "rt-123" }, mockExecutor)).toBe(true);
    expect(canAttemptTokenRefresh("codex", { refreshToken: "rt-123" }, mockExecutor)).toBe(true);
    expect(canAttemptTokenRefresh("vertex", { serviceAccount: {} }, mockExecutor)).toBe(true);

    // IDE reverse-proxy providers can refresh
    expect(canAttemptTokenRefresh("zed", {}, mockExecutor)).toBe(true);
    expect(canAttemptTokenRefresh("cursor", {}, mockExecutor)).toBe(true);
  });

  it("does not lock account or fallback for model-not-supported or region-opt-in errors", () => {
    const modelError = checkFallbackError(401, "Model deepseek-v4.1-flash-high is not supported");
    expect(modelError.shouldFallback).toBe(false);
    expect(modelError.cooldownMs).toBe(0);

    const regionError = checkFallbackError(403, "RegionError: Model requires cross-border data transfer terms agreement at https://opencode.ai/auth");
    expect(regionError.shouldFallback).toBe(false);
    expect(regionError.cooldownMs).toBe(0);
  });

  it("correctly resolves toolName from preceding assistant tool_calls in CommandCode translator", () => {
    const req = openaiToCommandCodeRequest("claude-sonnet-5", {
      messages: [
        { role: "user", content: "read file test.txt" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_read_1",
              type: "function",
              function: { name: "view_file", arguments: "{\"path\":\"test.txt\"}" },
            },
          ],
        },
        {
          role: "tool",
          tool_call_id: "call_read_1",
          // Notice: m.name is omitted, as standard in OpenAI tool response format
          content: "file content here",
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "view_file",
            description: "View file contents",
            parameters: { type: "object", properties: { path: { type: "string" } } },
          },
        },
      ],
    }, true);

    // Tools use the upstream-verified Anthropic shape: {name, description,
    // input_schema} only. No OpenAI-style `parameters` mirror — the
    // /alpha/generate schema was verified live (curl 2026-05-07) and the
    // sibling suite openai-to-commandcode.test.js pins the same contract.
    expect(req.params.tools[0].name).toBe("view_file");
    expect(req.params.tools[0].input_schema).toBeDefined();
    expect(req.params.tools[0].parameters).toBeUndefined();

    // Check tool-result block: toolName must be populated from call_read_1
    const toolMsg = req.params.messages[2];
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.content[0].type).toBe("tool-result");
    expect(toolMsg.content[0].toolCallId).toBe("call_read_1");
    expect(toolMsg.content[0].toolName).toBe("view_file");
    expect(toolMsg.content[0].output).toEqual({ type: "text", value: "file content here" });
    expect(toolMsg.content[0].result).toBe("file content here");
  });

  it("ensures tool_calls finish_reason when tools were invoked in CommandCode response", () => {
    const state = {};
    // Simulate tool-input-start and delta
    commandCodeToOpenAIResponse(JSON.stringify({
      type: "tool-input-start",
      id: "call_1",
      toolName: "run_command",
    }), state);

    // Simulate finish event with generic "stop"
    const finishChunks = commandCodeToOpenAIResponse(JSON.stringify({
      type: "finish",
      finishReason: "stop",
    }), state);

    expect(finishChunks).toHaveLength(1);
    expect(finishChunks[0].choices[0].finish_reason).toBe("tool_calls");
  });

  it("OpenCodeGoExecutor always generates and includes mandatory x-opencode-session and client headers", () => {
    const executor = new OpenCodeGoExecutor();

    executor.transformRequest("deepseek-v4.1-flash", {
      messages: [{ role: "user", content: "Hello world" }],
    });

    const headers = executor.buildHeaders({ apiKey: "test-key-123" });
    expect(headers["x-opencode-session"]).toBeDefined();
    expect(typeof headers["x-opencode-session"]).toBe("string");
    expect(headers["x-opencode-session"].length).toBeGreaterThan(0);
    expect(headers["x-opencode-client"]).toBe("cli");
    expect(headers["Authorization"]).toBe("Bearer test-key-123");
  });

  it("does not lock account or fallback for MissingSessionID or x-opencode-session errors", () => {
    const sessionError = checkFallbackError(400, '{"type":"error","error":{"type":"MissingSessionID","message":"Error from provider (Console Go): Request is missing x-opencode-session and cannot be routed efficiently."}}');
    expect(sessionError.shouldFallback).toBe(false);
    expect(sessionError.cooldownMs).toBe(0);
  });
});
