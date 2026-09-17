import { describe, it, expect, vi, afterEach } from "vitest";
import { getExecutor } from "open-sse/executors/index.js";
import { PROVIDERS } from "open-sse/providers/index.js";
import { parseUpstreamError } from "open-sse/utils/error.js";
import { stripUnsupportedModalities } from "open-sse/translator/concerns/modality.js";
import { parseSSEToOpenAIResponse } from "open-sse/handlers/chatCore/sseToJsonHandler.js";
import {
  mockOpenAIChatCompletion,
  mockOpenAIChatChunks,
  mockOpenAIToolCallCompletion,
  mockOpenAIReasoningCompletion,
} from "../fixtures/providers/openai-responses.js";

let activeHandler = null;
const recordedCalls = [];

export function jsonResponse(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

export function sseStream(chunks) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        if (typeof chunk === "string") {
          controller.enqueue(encoder.encode(chunk));
        } else if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        } else {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * Raw NDJSON stream: one JSON object per line, no `data:` prefix and no `[DONE]`
 * sentinel. This is the AI SDK v5 wire framing some providers (commandcode) use
 * upstream, and appending SSE sentinels to it makes the payload unparseable.
 */
export function ndjsonStream(lines) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(typeof line === "string" ? line : `${JSON.stringify(line)}\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export function malformedSseStream() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: {malformed_json: unterminated\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
    },
  });
}

export function emptyResponse(status = 200, headers = {}) {
  return new Response("", {
    status,
    headers,
  });
}

export function errorResponse(status, body = null) {
  const payload = body !== null
    ? (typeof body === "string" ? body : JSON.stringify(body))
    : JSON.stringify({ error: { message: `Upstream error ${status}`, code: status } });

  return new Response(payload, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export const stubbedFetch = vi.fn(async (url, init = {}) => {
  const record = {
    url: typeof url === "string" ? url : url.toString(),
    method: init.method || "GET",
    headers: init.headers || {},
    body: init.body,
    parsedBody: null,
  };
  if (record.body && typeof record.body === "string") {
    try {
      record.parsedBody = JSON.parse(record.body);
    } catch {
      record.parsedBody = record.body;
    }
  }
  recordedCalls.push(record);

  if (activeHandler) {
    return activeHandler(url, init, record);
  }
  throw new Error(`[mockUpstream] Unexpected unmocked network fetch: ${url}`);
});

vi.stubGlobal("fetch", stubbedFetch);

vi.mock("open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: (...args) => stubbedFetch(...args),
  default: (...args) => stubbedFetch(...args),
}));

export function mockUpstream(handler) {
  activeHandler = handler;
  return {
    calls: recordedCalls,
    lastCall: () => recordedCalls[recordedCalls.length - 1] || null,
    resetCalls: () => { recordedCalls.length = 0; },
  };
}

export function resetMockUpstream() {
  activeHandler = null;
  recordedCalls.length = 0;
  stubbedFetch.mockClear();
}

/**
 * Helper to parse an executor response body whether it is application/json or forced text/event-stream.
 */
async function parseExecutorResponse(response, model) {
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    return parseSSEToOpenAIResponse(text, model);
  }
  return response.json();
}

/**
 * Upstream wire framing per provider. The contract suite mocks an upstream that
 * must speak the provider's real protocol, otherwise the failing test would be
 * measuring the harness, not the provider.
 *
 *   "openai-json" — upstream returns an OpenAI chat.completion JSON body (default).
 *   "ndjson"      — upstream returns AI SDK v5 NDJSON lines (commandcode). The
 *                   executor translates those into OpenAI SSE, so the response the
 *                   caller reads is still OpenAI-shaped SSE.
 *
 * `forceStream` providers never receive a real non-streaming upstream call: their
 * executor rewrites `body.stream = true` and wraps the response. Tests that assert
 * a JSON body must therefore read the SSE-wrapped result instead of calling
 * response.json() on it.
 */
export const UPSTREAM_FRAMING = Object.freeze({ OPENAI_JSON: "openai-json", NDJSON: "ndjson" });

const NDJSON_PROVIDERS = new Set(["commandcode"]);

export function upstreamFramingFor(id) {
  return NDJSON_PROVIDERS.has(id) ? UPSTREAM_FRAMING.NDJSON : UPSTREAM_FRAMING.OPENAI_JSON;
}

/** AI SDK v5 NDJSON lines equivalent to an OpenAI canned completion. */
function toNdjsonLines(canned) {
  const lines = [];
  const msg = canned?.choices?.[0]?.message;
  const usage = canned?.usage;
  if (msg?.reasoning_content) lines.push(JSON.stringify({ type: "reasoning-start", id: "rs1" }) + "\n");
  if (msg?.reasoning_content) lines.push(JSON.stringify({ type: "reasoning-delta", text: msg.reasoning_content }) + "\n");
  if (msg?.tool_calls?.length) {
    for (const tc of msg.tool_calls) {
      const input = typeof tc.function?.arguments === "string"
        ? (() => { try { return JSON.parse(tc.function.arguments); } catch { return {}; } })()
        : (tc.function?.arguments ?? {});
      lines.push(JSON.stringify({ type: "tool-input-start", id: tc.id, toolName: tc.function?.name || "tool" }) + "\n");
      lines.push(JSON.stringify({ type: "tool-input-delta", id: tc.id, delta: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(input) }) + "\n");
      lines.push(JSON.stringify({ type: "tool-input-end", id: tc.id }) + "\n");
      lines.push(JSON.stringify({ type: "tool-call", toolCallId: tc.id, toolName: tc.function?.name || "tool", input }) + "\n");
    }
    lines.push(JSON.stringify({ type: "finish-step", finishReason: "tool-calls", ...(usage ? { usage } : {}) }) + "\n");
    lines.push(JSON.stringify({ type: "finish", finishReason: "tool-calls", ...(usage ? { totalUsage: usage } : {}) }) + "\n");
    return lines;
  }
  if (msg?.content) lines.push(JSON.stringify({ type: "text-delta", text: msg.content }) + "\n");
  lines.push(JSON.stringify({ type: "finish-step", finishReason: "stop", ...(usage ? { usage } : {}) }) + "\n");
  lines.push(JSON.stringify({ type: "finish", finishReason: "stop", ...(usage ? { totalUsage: usage } : {}) }) + "\n");
  return lines;
}

/**
 * Mock an upstream response for `id`, framed in that provider's real protocol.
 * Returns the mockUpstream context so callers can inspect recorded requests.
 */
export function mockUpstreamForProvider(id, canned) {
  if (upstreamFramingFor(id) === UPSTREAM_FRAMING.NDJSON) {
    // NDJSON is line-delimited JSON, NOT SSE: no "data:" prefix, no [DONE] sentinel.
    return mockUpstream(async () => ndjsonStream(toNdjsonLines(canned)));
  }
  return mockUpstream(async () => jsonResponse(canned));
}
export async function readSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const payload = trimmed.slice(5).trim();
        if (payload && payload !== "[DONE]") {
          try {
            events.push(JSON.parse(payload));
          } catch {
            events.push(payload);
          }
        }
      }
    }
  }
  return events;
}

/**
 * Run provider contract suite for a given provider configuration.
 *
 * @param {object} spec
 * @param {string} spec.id Provider ID
 * @param {object} [spec.capabilities] Capability flags (streaming, tools, reasoning, usage, cacheUsage, vision)
 * @param {object} [spec.cases] Optional case overrides
 */
export function runProviderContract({ id, capabilities = {}, cases = {} }) {
  const providerDef = PROVIDERS[id];
  const framing = upstreamFramingFor(id);
  const forceStream = framing === UPSTREAM_FRAMING.NDJSON;

  describe(`Provider contract: ${id}`, () => {
    afterEach(() => {
      resetMockUpstream();
    });

    it("verifies provider definition exists in PROVIDERS", () => {
      expect(providerDef).toBeDefined();
    });

    const isStreamingSupported = capabilities.streaming !== false;
    const isToolsSupported = Boolean(capabilities.tools);
    const isReasoningSupported = Boolean(capabilities.reasoning);
    const isUsageSupported = Boolean(capabilities.usage);
    const isCacheUsageSupported = Boolean(capabilities.cacheUsage);
    const isVisionSupported = Boolean(capabilities.vision);

    // 1. Non-streaming chat
    if (capabilities.nonStreaming === false) {
      it.skip("non-streaming chat -> parses response and yields text (skipped: provider enforces streaming-only)", () => {});
    } else {
      it("non-streaming chat -> parses response and yields text", async () => {
        const executor = getExecutor(id);
        const canned = mockOpenAIChatCompletion("Hello world from contract test");

        mockUpstream(async () => jsonResponse(canned));

        const result = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: { messages: [{ role: "user", content: "Hello" }] },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        });

        expect(stubbedFetch).toHaveBeenCalled();
        expect(result.response.status).toBe(200);

        const data = await result.response.json();
        const text = data.choices?.[0]?.message?.content;
        expect(text).toBe("Hello world from contract test");
      });
    }

    // 2. Streaming chat
    if (!isStreamingSupported) {
      it.skip("streaming chat -> emits translated SSE chunks and terminates cleanly (skipped: streaming:false)", () => {});
    } else {
      it("streaming chat -> emits translated SSE chunks and terminates cleanly", async () => {
        const executor = getExecutor(id);
        const chunks = id === "commandcode"
          ? [
              JSON.stringify({ type: "start" }) + "\n",
              JSON.stringify({ type: "text-start", id: "t1" }) + "\n",
              JSON.stringify({ type: "text-delta", text: "Streaming" }) + "\n",
              JSON.stringify({ type: "text-delta", text: " response" }) + "\n",
              JSON.stringify({ type: "finish" }) + "\n",
            ]
          : mockOpenAIChatChunks(["Streaming", " response"]);

        mockUpstream(async () => sseStream(chunks));

        const result = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: { messages: [{ role: "user", content: "Stream test" }] },
          stream: true,
          credentials: { apiKey: "test-credential-secret" },
        });

        expect(stubbedFetch).toHaveBeenCalled();
        expect(result.response.status).toBe(200);

        const events = await readSSEStream(result.response);
        expect(events.length).toBeGreaterThan(0);

        const contents = events.map((e) => e.choices?.[0]?.delta?.content).filter(Boolean);
        expect(contents.join("")).toBe("Streaming response");
      });
    }

    // 3. Tool calling
    if (!isToolsSupported) {
      it.skip("tool call emitted and a tool result accepted back (skipped: tools:false)", () => {});
    } else {
      it("tool call emitted and a tool result accepted back", async () => {
        const executor = getExecutor(id);
        const toolCanned = mockOpenAIToolCallCompletion({
          id: "call_test_123",
          name: "calculate",
          args: '{"x":10,"y":20}',
        });

        const mockContext = mockUpstreamForProvider(id, toolCanned);

        const result1 = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: {
            messages: [{ role: "user", content: "Calculate 10 + 20" }],
            tools: [
              {
                type: "function",
                function: {
                  name: "calculate",
                  description: "add two numbers",
                  parameters: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
                },
              },
            ],
          },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        });

        expect(result1.response.status).toBe(200);
        const data1 = await parseExecutorResponse(result1.response, capabilities.testModel);
        const toolCalls = data1.choices?.[0]?.message?.tool_calls;
        expect(toolCalls).toHaveLength(1);
        expect(toolCalls[0].function.name).toBe("calculate");

        // Second turn: pass tool result back
        const result2 = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: {
            messages: [
              { role: "user", content: "Calculate 10 + 20" },
              data1.choices[0].message,
              { role: "tool", tool_call_id: toolCalls[0].id, content: "30" },
            ],
          },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        });

        expect(result2.response.status).toBe(200);
        const lastCall = mockContext.lastCall();
        expect(lastCall.parsedBody.messages.some((m) => m.role === "tool" || m.content === "30")).toBe(true);
      });
    }

    // 4. Reasoning / thinking content preserved
    if (!isReasoningSupported) {
      it.skip("reasoning/thinking content preserved (skipped: reasoning:false)", () => {});
    } else {
      it("reasoning/thinking content preserved", async () => {
        const executor = getExecutor(id);
        const reasoningCanned = mockOpenAIReasoningCompletion({
          thinking: "Pondering the solution carefully...",
          content: "Final answer is 42.",
        });

        mockUpstreamForProvider(id, reasoningCanned);

        const result = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: {
            messages: [{ role: "user", content: "What is the answer to life?" }],
            reasoning_effort: "high",
          },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        });

        expect(result.response.status).toBe(200);
        const data = await parseExecutorResponse(result.response, capabilities.testModel);
        const msg = data.choices?.[0]?.message;
        const thinking = msg?.reasoning_content || msg?.reasoning;
        expect(thinking).toBe("Pondering the solution carefully...");
        expect(msg?.content).toBe("Final answer is 42.");
      });
    }

    // 5. Usage extracted when reported
    if (!isUsageSupported) {
      it.skip("usage extracted when the provider reports it (skipped: usage:false)", () => {});
    } else {
      it("usage extracted when the provider reports it", async () => {
        const executor = getExecutor(id);
        const cannedWithUsage = mockOpenAIChatCompletion("Hello", {
          usage: {
            prompt_tokens: 42,
            completion_tokens: 18,
            total_tokens: 60,
          },
        });

        mockUpstream(async () => jsonResponse(cannedWithUsage));

        const result = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: { messages: [{ role: "user", content: "Count test" }] },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        });

        const data = await result.response.json();
        expect(data.usage).toBeDefined();
        expect(data.usage.prompt_tokens).toBe(42);
        expect(data.usage.completion_tokens).toBe(18);
        expect(data.usage.total_tokens).toBe(60);
      });
    }

    // 6. Cache-token usage preserved when reported
    if (!isCacheUsageSupported) {
      it.skip("cache-token usage preserved when reported (skipped: cacheUsage:false)", () => {});
    } else {
      it("cache-token usage preserved when reported", async () => {
        const executor = getExecutor(id);
        const cannedWithCache = mockOpenAIChatCompletion("Hello cached", {
          usage: {
            prompt_tokens: 150,
            completion_tokens: 20,
            total_tokens: 170,
            prompt_tokens_details: {
              cached_tokens: 100,
            },
          },
        });

        mockUpstream(async () => jsonResponse(cannedWithCache));

        const result = await executor.execute({
          model: capabilities.testModel || "default-model",
          body: { messages: [{ role: "user", content: "Cache check" }] },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        });

        const data = await result.response.json();
        expect(data.usage).toBeDefined();
        expect(data.usage.prompt_tokens_details?.cached_tokens).toBe(100);
      });
    }

    // 7. Upstream HTTP errors: 401 / 403 / 429 / 500
    it.each([401, 403, 429, 500])("upstream %i -> normalized error with correct status and no credential leak", async (status) => {
      const executor = getExecutor(id);
      const secret = "super-secret-credential-token-xyz-12345";

      mockUpstream(async () => errorResponse(status, {
        error: {
          message: `Request failed with status ${status} for token ${secret}`,
          code: status,
        },
      }));

      // BaseExecutor returns non-ok responses directly without throwing for 4xx/5xx (unless retry exhausted)
      const out = await executor.execute({
        model: capabilities.testModel || "default-model",
        body: { messages: [{ role: "user", content: "Error test" }] },
        stream: false,
        credentials: { apiKey: secret },
      });

      expect(out.response.status).toBe(status);

      // Verify parseUpstreamError handling (clone response first so body is not consumed)
      const parsed = await parseUpstreamError(out.response.clone(), executor);
      expect(parsed.statusCode).toBe(status);
      expect(typeof parsed.message).toBe("string");

      // Credential leak check: verify headers sent over the wire do not leak token into query/logs
      expect(out.url).not.toContain(secret);
    });

    // 8. Connect failure / timeout / client abort
    it("connect failure / timeout / client abort -> clean typed error, no hang, no unhandled rejection", async () => {
      const executor = getExecutor(id);

      // 8a. Connect abort / abort signal
      mockUpstream(async () => {
        const err = new Error("This operation was aborted");
        err.name = "AbortError";
        throw err;
      });

      const abortCtrl = new AbortController();
      abortCtrl.abort();

      await expect(executor.execute({
        model: capabilities.testModel || "default-model",
        body: { messages: [{ role: "user", content: "Abort test" }] },
        stream: false,
        credentials: { apiKey: "test-credential-secret" },
        signal: abortCtrl.signal,
      })).rejects.toMatchObject({ name: "AbortError" });

      // 8b. Network connection drop (temporarily set retry attempts to 0 to prevent 9s retry delay)
      resetMockUpstream();
      mockUpstream(async () => {
        const err = new Error("ECONNRESET: socket hang up");
        err.code = "ECONNRESET";
        throw err;
      });

      const prevRetry = executor.config?.retry;
      if (executor.config) {
        executor.config.retry = { 502: { attempts: 0, delayMs: 0 } };
      }
      try {
        await expect(executor.execute({
          model: capabilities.testModel || "default-model",
          body: { messages: [{ role: "user", content: "Network drop test" }] },
          stream: false,
          credentials: { apiKey: "test-credential-secret" },
        })).rejects.toThrow("ECONNRESET");
      } finally {
        if (executor.config) {
          executor.config.retry = prevRetry;
        }
      }
    });

    // 9. Malformed SSE / empty response -> does not hang or throw unhandled
    it("malformed SSE / empty response -> does not hang or throw unhandled", async () => {
      const executor = getExecutor(id);

      // 9a. Empty response
      mockUpstream(async () => emptyResponse(200, { "Content-Type": "text/event-stream" }));
      const resultEmpty = await executor.execute({
        model: capabilities.testModel || "default-model",
        body: { messages: [{ role: "user", content: "Empty test" }] },
        stream: true,
        credentials: { apiKey: "test-credential-secret" },
      });
      expect(resultEmpty.response.status).toBe(200);
      const emptyEvents = await readSSEStream(resultEmpty.response);
      expect(Array.isArray(emptyEvents)).toBe(true);

      // 9b. Malformed SSE response
      resetMockUpstream();
      mockUpstream(async () => malformedSseStream());
      const resultMalformed = await executor.execute({
        model: capabilities.testModel || "default-model",
        body: { messages: [{ role: "user", content: "Malformed test" }] },
        stream: true,
        credentials: { apiKey: "test-credential-secret" },
      });
      expect(resultMalformed.response.status).toBe(200);
      const malformedEvents = await readSSEStream(resultMalformed.response);
      expect(Array.isArray(malformedEvents)).toBe(true);
    });

    // 10. Unicode and large content round-trip without truncation
    it("Unicode and large content round-trip without truncation", async () => {
      const executor = getExecutor(id);
      const largeUnicodeString = "🚀 喵 ~ 🦊 " + "🌟 Test unicode sentence with emojis and accents: é, è, ü, ñ, 漢字, العربية. ".repeat(80);
      const canned = mockOpenAIChatCompletion(largeUnicodeString);

      const mockCtx = mockUpstreamForProvider(id, canned);

      const result = await executor.execute({
        model: capabilities.testModel || "default-model",
        body: {
          messages: [{ role: "user", content: largeUnicodeString }],
        },
        stream: false,
        credentials: { apiKey: "test-credential-secret" },
      });

      expect(result.response.status).toBe(200);
      const data = await parseExecutorResponse(result.response, capabilities.testModel);
      expect(data.choices[0].message.content).toBe(largeUnicodeString);

      // Assert sent payload preserves the exact Unicode without truncation
      const lastCall = mockCtx.lastCall();
      expect(lastCall.parsedBody.messages[0].content).toBe(largeUnicodeString);
    });

    // 11. Unsupported modality handled per capability flags rather than crashing
    it("unsupported modality handled per capability flags rather than crashing", () => {
      const testBody = {
        model: capabilities.testModel || "default-model",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Look at this image" },
              { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" } },
            ],
          },
        ],
      };

      const caps = { vision: isVisionSupported, audioInput: false, pdf: false };
      stripUnsupportedModalities(testBody, caps, "openai");

      const userContent = testBody.messages[0].content;
      if (!isVisionSupported) {
        // Vision stripped and replaced with placeholder
        expect(userContent.some((part) => part.type === "image_url")).toBe(false);
        expect(userContent.some((part) => part.text && part.text.includes("[image omitted"))).toBe(true);
      } else {
        // Vision kept
        expect(userContent.some((part) => part.type === "image_url")).toBe(true);
      }
    });
  });
}
