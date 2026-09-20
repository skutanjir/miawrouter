import { describe, it, expect } from "vitest";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";

describe("getThinkingLevels", () => {
  it.each([
    ["gpt-6-astra", ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]],
    ["gpt-6-astra-review", ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]],
    ["gpt-5.6-sol", ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]],
    ["gpt-5.6-terra", ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]],
    ["gpt-5.6-luna", ["none", "minimal", "low", "medium", "high", "xhigh", "max"]],
    ["gpt-5.6-sol-review", ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]],
    ["gpt-5.6-terra-review", ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]],
    ["gpt-5.6-luna-review", ["none", "minimal", "low", "medium", "high", "xhigh", "max"]],
  ])("returns Codex levels for %s", (model, expected) => {
    expect(getThinkingLevels("codex", model)).toEqual(expected);
  });

  it("does not expose Codex-only GPT-5.6 overrides on Kiro", () => {
    expect(getThinkingLevels("kiro", "gpt-5.6-sol")).toEqual([
      "none", "minimal", "low", "medium", "high", "xhigh",
    ]);
  });

  it("does not add max for other codex models", () => {
    const levels = getThinkingLevels("codex", "gpt-5.3-codex");
    expect(levels).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("does not add max for other Codex models", () => {
    const levels = getThinkingLevels("codex", "gpt-5.5");
    expect(levels || []).not.toContain("max");
  });

  it("gives OpenAI API and CommandCode gpt-6 thinking without none", () => {
    const expected = ["minimal", "low", "medium", "high", "xhigh"];
    expect(getThinkingLevels("openai", "gpt-6-astra")).toEqual(expected);
    expect(getThinkingLevels("commandcode", "gpt-6-astra")).toEqual(expected);
  });

  it("gives Claude Opus 5 / Fable 5.1 / Sonnet 5 xhigh", () => {
    const expected = ["none", "low", "medium", "high", "xhigh", "max"];
    expect(getThinkingLevels("claude", "claude-opus-5")).toEqual(expected);
    expect(getThinkingLevels("anthropic", "claude-fable-5-1")).toEqual(expected);
    expect(getThinkingLevels("commandcode", "claude-sonnet-5")).toEqual(expected);
  });

  it("keeps Claude 4.6 without xhigh", () => {
    expect(getThinkingLevels("claude", "claude-opus-4-6")).toEqual(["none", "low", "medium", "high", "max"]);
    expect(getThinkingLevels("antigravity", "claude-sonnet-4-6")).toEqual(["none", "low", "medium", "high", "max"]);
  });

  it("hides effort on Haiku", () => {
    expect(getThinkingLevels("claude", "claude-haiku-4-5")).toBeNull();
    expect(getThinkingLevels("commandcode", "claude-haiku-4-5-20251001")).toBeNull();
  });

  it("treats Antigravity gemini-pro-agent as Gemini 3 thinking", () => {
    expect(getThinkingLevels("antigravity", "gemini-pro-agent")).toEqual(["minimal", "low", "medium", "high"]);
  });

  it("honors Antigravity gemini-3-flash thinking:false", () => {
    expect(getThinkingLevels("antigravity", "gemini-3-flash")).toBeNull();
  });
});
