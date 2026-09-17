import { describe, it, expect } from "vitest";
import {
  validateChatRequest,
  enforceLimits,
  assertJsonBodySize,
  estimateBodyBytes
} from "open-sse/utils/requestValidation.js";

describe("validateChatRequest", () => {
  it("passes valid OpenAI-shaped bodies", () => {
    const body = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "hello" }],
      stream: true,
      max_tokens: 1000,
      temperature: 0.7
    };
    const res = validateChatRequest(body);
    expect(res).toEqual({ ok: true });
  });

  it("passes valid Claude-shaped bodies with max_tokens and system string", () => {
    const body = {
      model: "claude-3-5-sonnet-20241022",
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 8192,
      system: "You are a helpful assistant"
    };
    const res = validateChatRequest(body);
    expect(res).toEqual({ ok: true });
  });

  it("passes valid Gemini-shaped bodies with prompt or contents/input", () => {
    const body1 = {
      model: "gemini-1.5-pro",
      prompt: "Tell me a joke"
    };
    expect(validateChatRequest(body1)).toEqual({ ok: true });

    const body2 = {
      model: "gemini-1.5-pro",
      prompt: ["Tell me a joke"]
    };
    expect(validateChatRequest(body2)).toEqual({ ok: true });

    const body3 = {
      model: "gemini-1.5-pro",
      input: [{ role: "user", parts: [{ text: "hi" }] }]
    };
    expect(validateChatRequest(body3)).toEqual({ ok: true });
  });

  it("passes bodies with unknown provider extension keys untouched", () => {
    const original = {
      model: "custom-model",
      messages: [{ role: "user", content: "hi" }],
      custom_flag: true,
      provider_meta: { nested: 123 },
      foo_bar: [1, 2, 3]
    };
    const copy = JSON.parse(JSON.stringify(original));
    const res = validateChatRequest(original);
    expect(res).toEqual({ ok: true });
    expect(original).toEqual(copy);
  });

  it("passes when model is missing or empty string (resolved later by core)", () => {
    expect(validateChatRequest({ messages: [{ role: "user", content: "hi" }] })).toEqual({ ok: true });
    expect(validateChatRequest({ model: "", messages: [{ role: "user", content: "hi" }] })).toEqual({ ok: true });
  });

  it("rejects non-object or null bodies", () => {
    expect(validateChatRequest(null)).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: body must be a JSON object."
    });
    expect(validateChatRequest("str")).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: body must be a JSON object."
    });
    expect(validateChatRequest(123)).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: body must be a JSON object."
    });
    expect(validateChatRequest([1, 2, 3])).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: body must be a JSON object."
    });
  });

  it("rejects invalid model type", () => {
    const res = validateChatRequest({
      model: 123,
      messages: [{ role: "user", content: "hi" }]
    });
    expect(res).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'model' must be a string."
    });
  });

  it("rejects when none of messages / input / prompt is present", () => {
    const res = validateChatRequest({ model: "gpt-4" });
    expect(res).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: at least one of 'messages', 'input', or 'prompt' must be provided."
    });
  });

  it("rejects when messages is not an array (e.g. object, string, number)", () => {
    expect(validateChatRequest({ messages: {} })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'messages' must be an array."
    });
    expect(validateChatRequest({ messages: "hello" })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'messages' must be an array."
    });
    expect(validateChatRequest({ messages: 42 })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'messages' must be an array."
    });
  });

  it("rejects when messages contains non-object items", () => {
    const body = {
      messages: [{ role: "user", content: "hi" }, "bad string", { role: "assistant", content: "ok" }]
    };
    const res = validateChatRequest(body);
    expect(res).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: messages[1] must be an object."
    });
  });

  it("rejects when input is not an array", () => {
    expect(validateChatRequest({ input: "not-array" })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'input' must be an array."
    });
  });

  it("rejects when prompt is not a string or array", () => {
    expect(validateChatRequest({ prompt: 12345 })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'prompt' must be a string or an array."
    });
  });

  it("rejects non-boolean stream", () => {
    const res = validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      stream: "true"
    });
    expect(res).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'stream' must be a boolean."
    });
  });

  it("rejects tools if not an array or contains non-object entry", () => {
    expect(validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      tools: "tool"
    })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'tools' must be an array."
    });

    expect(validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      tools: [null]
    })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: tools[0] must be an object."
    });
  });

  it("rejects non-numeric tokens/temperature/top_p parameters", () => {
    expect(validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      temperature: "high"
    })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'temperature' must be a finite number."
    });

    expect(validateChatRequest({
      messages: [{ role: "user", content: "hi" }],
      max_tokens: Infinity
    })).toEqual({
      ok: false,
      status: 400,
      message: "Invalid request body: 'max_tokens' must be a finite number."
    });
  });

  it("asserts rejection does not mutate input body", () => {
    const invalidBody = {
      model: 123,
      messages: [{ role: "user", content: "hi" }],
      extra: { foo: "bar" }
    };
    const clone = JSON.parse(JSON.stringify(invalidBody));
    const res = validateChatRequest(invalidBody);
    expect(res.ok).toBe(false);
    expect(invalidBody).toEqual(clone);
  });
});

describe("enforceLimits", () => {
  it("rejects when messages count exceeds maxMessages limit", () => {
    const body = {
      messages: Array.from({ length: 5 }, (_, i) => ({ role: "user", content: `msg ${i}` }))
    };
    const limits = { maxMessages: 3, maxTools: 10, maxToolSchemaBytes: 1000 };
    const res = enforceLimits(body, limits);
    expect(res).toEqual({
      ok: false,
      status: 413,
      message: "Payload Too Large: message count 5 exceeds limit of 3."
    });
  });

  it("rejects when tools count exceeds maxTools limit", () => {
    const body = {
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function" }, { type: "function" }, { type: "function" }]
    };
    const limits = { maxMessages: 10, maxTools: 2, maxToolSchemaBytes: 10000 };
    const res = enforceLimits(body, limits);
    expect(res).toEqual({
      ok: false,
      status: 413,
      message: "Payload Too Large: tools count 3 exceeds limit of 2."
    });
  });

  it("rejects when serialized tools schema exceeds maxToolSchemaBytes limit", () => {
    const body = {
      messages: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", function: { name: "large", description: "x".repeat(100) } }]
    };
    const limits = { maxMessages: 10, maxTools: 10, maxToolSchemaBytes: 50 };
    const res = enforceLimits(body, limits);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(413);
    expect(res.message).toContain("tools schema size");
  });

  it("ignores check if limit is 0", () => {
    const body = {
      messages: Array.from({ length: 20 }, (_, i) => ({ role: "user", content: `msg ${i}` })),
      tools: Array.from({ length: 20 }, () => ({ type: "function" }))
    };
    const limits = { maxMessages: 0, maxTools: 0, maxToolSchemaBytes: 0 };
    expect(enforceLimits(body, limits)).toEqual({ ok: true });
  });
});

describe("assertJsonBodySize and estimateBodyBytes", () => {
  it("rejects when Content-Length header exceeds maxBodyBytes", () => {
    const req = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-length": "1000",
        "content-type": "application/json"
      },
      body: JSON.stringify({ messages: [] })
    });
    const limits = { maxBodyBytes: 500 };
    const res = assertJsonBodySize(req, limits);
    expect(res).toEqual({
      ok: false,
      status: 413,
      message: "Request payload too large: 1000 bytes exceeds limit of 500 bytes."
    });
  });

  it("passes when Content-Length header is within maxBodyBytes", () => {
    const req = new Request("http://localhost/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-length": "200",
        "content-type": "application/json"
      },
      body: JSON.stringify({ messages: [] })
    });
    const limits = { maxBodyBytes: 500 };
    const res = assertJsonBodySize(req, limits);
    expect(res).toEqual({ ok: true });
  });

  it("estimateBodyBytes calculates utf8 byte length correctly", () => {
    const obj = { text: "hello world" };
    expect(estimateBodyBytes(obj)).toBe(Buffer.byteLength(JSON.stringify(obj)));
    expect(estimateBodyBytes("test")).toBe(4);
    expect(estimateBodyBytes(null)).toBe(0);
  });
});
