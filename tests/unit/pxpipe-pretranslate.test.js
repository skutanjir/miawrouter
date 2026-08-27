import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression coverage for the PXPIPE pre-translation pass: when a Claude-format
// client targets a NON-Claude provider (antigravity, gemini, kiro, openai…),
// the source body must be imaged BEFORE translation instead of skipping with
// unsupported_format. Claude-format targets keep the post-translate path.

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock("../../open-sse/executors/index.js", () => ({
  getExecutor: () => ({
    noAuth: true,
    execute: executeMock,
  }),
}));

vi.mock("../../open-sse/utils/requestLogger.js", () => ({
  createRequestLogger: async () => ({
    logClientRawRequest: vi.fn(),
    logRawRequest: vi.fn(),
    logTargetRequest: vi.fn(),
    logProviderResponse: vi.fn(),
    logConvertedResponse: vi.fn(),
    logError: vi.fn(),
  }),
}));

vi.mock("../../open-sse/utils/stream.js", () => ({
  COLORS: { red: "", reset: "" },
  createPassthroughStreamWithLogger: vi.fn(() => new TransformStream()),
  createSSETransformStreamWithLogger: vi.fn(() => new TransformStream()),
}));

vi.mock("@/lib/usageDb.js", () => ({
  trackPendingRequest: vi.fn(),
  appendRequestLog: vi.fn(async () => {}),
  saveRequestDetail: vi.fn(async () => {}),
}));

const { handleChatCore } = await import("../../open-sse/handlers/chatCore.js");

const BIG_TEXT = "x".repeat(30000);

function claudeBody() {
  return {
    model: "claude-fable-5",
    max_tokens: 100,
    stream: false,
    system: [{ type: "text", text: "You are a helpful assistant." }],
    messages: [{ role: "user", content: [{ type: "text", text: BIG_TEXT }] }],
  };
}

// Transform double mimicking pxpipe-proxy: replaces text with an image block.
function appliedTransform() {
  return async ({ body }) => {
    const parsed = JSON.parse(new TextDecoder().decode(body));
    parsed.messages = [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: "cG5n" } },
      ],
    }];
    return {
      applied: true,
      reason: "applied",
      body: new TextEncoder().encode(JSON.stringify(parsed)),
      info: { compressedChars: 25000, imageCount: 1, imageBytes: 4096 },
      cache: { ownsCacheControl: false },
    };
  };
}

describe("PXPIPE pre-translate pass in handleChatCore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeMock.mockResolvedValue({
      response: new Response(JSON.stringify({
        id: "chatcmpl-test",
        object: "chat.completion",
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop", index: 0 }],
      }), { status: 200, headers: { "content-type": "application/json" } }),
      url: "https://api.openai.com/v1/chat/completions",
      headers: {},
      transformedBody: null,
    });
  });

  it("images a Claude source body before translating to a non-Claude target", async () => {
    const pxpipeTransform = vi.fn(appliedTransform());

    await handleChatCore({
      body: claudeBody(),
      modelInfo: { provider: "openai", model: "gpt-4o" },
      credentials: { apiKey: "test-key", providerSpecificData: {} },
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      connectionId: "test-conn",
      pxpipeEnabled: true,
      pxpipeMinChars: 25000,
      pxpipeTransform,
      clientRawRequest: {
        endpoint: "/v1/messages",
        body: {},
        headers: { accept: "application/json" },
      },
    });

    // transform ran exactly once, on the pre-translate Claude body
    expect(pxpipeTransform).toHaveBeenCalledTimes(1);
    const seen = JSON.parse(new TextDecoder().decode(pxpipeTransform.mock.calls[0][0].body));
    expect(JSON.stringify(seen.messages)).toContain(BIG_TEXT);

    // executor received the imaged payload — original text is gone
    const sentBody = executeMock.mock.calls[0][0].body;
    expect(JSON.stringify(sentBody)).not.toContain(BIG_TEXT);
    expect(JSON.stringify(sentBody)).toContain("cG5n");
  });

  it("does not run when the client opts out via x-miaw-token-saver: off", async () => {
    const pxpipeTransform = vi.fn(appliedTransform());

    await handleChatCore({
      body: claudeBody(),
      modelInfo: { provider: "openai", model: "gpt-4o" },
      credentials: { apiKey: "test-key", providerSpecificData: {} },
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      connectionId: "test-conn",
      pxpipeEnabled: true,
      pxpipeMinChars: 25000,
      pxpipeTransform,
      clientRawRequest: {
        endpoint: "/v1/messages",
        body: {},
        headers: { accept: "application/json", "x-miaw-token-saver": "off" },
      },
    });

    expect(pxpipeTransform).not.toHaveBeenCalled();
  });

  it("leaves small requests untouched (below_threshold)", async () => {
    const pxpipeTransform = vi.fn();

    await handleChatCore({
      body: {
        model: "claude-fable-5",
        max_tokens: 16,
        stream: false,
        messages: [{ role: "user", content: "hi" }],
      },
      modelInfo: { provider: "openai", model: "gpt-4o" },
      credentials: { apiKey: "test-key", providerSpecificData: {} },
      log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn() },
      connectionId: "test-conn",
      pxpipeEnabled: true,
      pxpipeMinChars: 25000,
      pxpipeTransform,
      clientRawRequest: {
        endpoint: "/v1/messages",
        body: {},
        headers: { accept: "application/json" },
      },
    });

    expect(pxpipeTransform).not.toHaveBeenCalled();
  });
});
