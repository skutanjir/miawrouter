import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/usageDb.js", () => ({
  saveRequestDetail: vi.fn().mockResolvedValue(undefined),
  saveRequestUsage: vi.fn().mockResolvedValue(undefined),
  appendRequestLog: vi.fn().mockResolvedValue(undefined),
}));

import { buildOnStreamComplete, handleStreamingResponse } from "../../open-sse/handlers/chatCore/streamingHandler.js";

describe("stream completion accounting", () => {
  it("reports cache usage using the provider format without breaking stream completion", () => {
    const onCacheEvent = vi.fn();
    const { onStreamComplete } = buildOnStreamComplete({
      provider: "openai", model: "test", targetFormat: "openai", requestStartTime: Date.now(),
      body: { messages: [] }, stream: true, cacheKey: "test", onCacheEvent,
    });
    expect(() => onStreamComplete({ content: "hello" }, { prompt_tokens: 20, completion_tokens: 2, cache_read_input_tokens: 10 })).not.toThrow();
    expect(onCacheEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "cache_usage", cacheRead: 10 }));
  });

  it("reports an upstream HTML page sent with HTTP 200 as a gateway failure", async () => {
    const upstream = new Response("<title>upstream unavailable</title>", { status: 200, headers: { "Content-Type": "text/html" } });
    const onRequestSuccess = vi.fn();
    const result = await handleStreamingResponse({ providerResponse: upstream, provider: "test", model: "test", streamController: { handleError: vi.fn() }, onRequestSuccess });
    expect(result.success).toBe(false);
    expect(result.status).toBe(502);
    expect(result.response.status).toBe(502);
    expect(onRequestSuccess).not.toHaveBeenCalled();
  });

  it("marks the account successful only after stream completion", async () => {
    const onRequestSuccess = vi.fn();
    const { onStreamComplete } = buildOnStreamComplete({ provider: "openai", model: "test", targetFormat: "openai", requestStartTime: Date.now(), body: { messages: [] }, stream: true, onRequestSuccess });
    expect(onRequestSuccess).not.toHaveBeenCalled();
    onStreamComplete({ content: "hello" }, { prompt_tokens: 1, completion_tokens: 1 });
    await Promise.resolve();
    expect(onRequestSuccess).toHaveBeenCalledOnce();
  });
});
