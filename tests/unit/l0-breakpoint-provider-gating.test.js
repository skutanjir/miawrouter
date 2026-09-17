import { describe, it, expect } from "vitest";
import { begin, finish, supportsPromptCacheControl } from "../../open-sse/cache/l0.js";

describe("BUG 1B: L0 Breakpoint Provider Gating", () => {
  it("supportsPromptCacheControl returns true for Claude / Anthropic", () => {
    expect(supportsPromptCacheControl("anthropic", "claude")).toBe(true);
    expect(supportsPromptCacheControl("claude", "claude")).toBe(true);
    expect(supportsPromptCacheControl("anthropic", "openai")).toBe(true);
    expect(supportsPromptCacheControl("custom-proxy", "claude")).toBe(true);
  });

  it("supportsPromptCacheControl returns true for preserveCacheControl providers (alicode)", () => {
    expect(supportsPromptCacheControl("alicode", "openai")).toBe(true);
    expect(supportsPromptCacheControl("alicode-intl", "openai")).toBe(true);
  });

  it("supportsPromptCacheControl returns false for OpenAI-compatible providers", () => {
    expect(supportsPromptCacheControl("deepseek", "openai")).toBe(false);
    expect(supportsPromptCacheControl("groq", "openai")).toBe(false);
    expect(supportsPromptCacheControl("together", "openai")).toBe(false);
    expect(supportsPromptCacheControl("openai", "openai")).toBe(false);
  });

  it("does not inject cache_control on turn 2 for DeepSeek / Groq (OpenAI format)", () => {
    const bodyTurn1 = {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Turn 1" },
        { role: "assistant", content: "Reply 1" },
        { role: "user", content: "Turn 2" },
      ],
      tools: [{ type: "function", function: { name: "my_tool" } }],
    };

    const state = begin(bodyTurn1);
    const cacheKey = "deepseek:sess_test_turn2";

    // Simulate turn 1
    finish(bodyTurn1, state, { cacheKey, provider: "deepseek", format: "openai" });

    // Simulate turn 2 (stable prefix)
    const bodyTurn2 = structuredClone(bodyTurn1);
    const state2 = begin(bodyTurn2);
    const result = finish(bodyTurn2, state2, { cacheKey, provider: "deepseek", format: "openai" });

    expect(result.info.stable).toBe(true);
    expect(result.info.breakpoints).toBe(0);

    // Verify messages content remains strings / unmodified without cache_control
    for (const msg of result.body.messages) {
      expect(msg.cache_control).toBeUndefined();
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          expect(block.cache_control).toBeUndefined();
        }
      }
    }
    // Verify tools definition does not have cache_control
    expect(result.body.tools[0].cache_control).toBeUndefined();
  });

  it("injects cache_control on turn 2 for Anthropic / Claude", () => {
    const bodyTurn1 = {
      system: "You are a helpful assistant.",
      messages: [
        { role: "user", content: "Turn 1" },
        { role: "assistant", content: "Reply 1" },
        { role: "user", content: "Turn 2" },
      ],
      tools: [{ name: "my_tool", description: "test" }],
    };

    const state = begin(bodyTurn1);
    const cacheKey = "anthropic:sess_test_claude";

    // Turn 1
    finish(bodyTurn1, state, { cacheKey, provider: "anthropic", format: "claude" });

    // Turn 2
    const bodyTurn2 = structuredClone(bodyTurn1);
    const state2 = begin(bodyTurn2);
    const result = finish(bodyTurn2, state2, { cacheKey, provider: "anthropic", format: "claude" });

    expect(result.info.stable).toBe(true);
    expect(result.info.breakpoints).toBeGreaterThan(0);
  });
});
