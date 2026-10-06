import { describe, expect, it } from "vitest";
import openai from "../../open-sse/providers/registry/openai.js";
import codex from "../../open-sse/providers/registry/codex.js";
import claude from "../../open-sse/providers/registry/claude.js";
import anthropic from "../../open-sse/providers/registry/anthropic.js";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import { applyThinking } from "../../open-sse/translator/concerns/thinkingUnified.js";
import { CodexExecutor } from "../../open-sse/executors/codex.js";

describe("model catalog verified 2026-09-30", () => {
  it("lists the newest Sol and Sonnet on their direct providers", () => {
    for (const provider of [openai, codex]) {
      expect(provider.models.some((model) => model.id === "gpt-6.1-sol")).toBe(true);
    }
    for (const provider of [claude, anthropic]) {
      expect(provider.models.some((model) => model.id === "claude-sonnet-5-5")).toBe(true);
    }
  });

  it.each(["gpt-6.1-sol", "gpt-6-astra"])("uses API efforts for %s", (model) => {
    expect(getThinkingLevels("openai", model)).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(applyThinking("openai", model, { reasoning_effort: "none" }, "openai").reasoning_effort).toBe("low");
    expect(applyThinking("openai", model, { reasoning_effort: "max" }, "openai").reasoning_effort).toBe("max");
  });

  it.each(["gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])("omits unsupported API minimal and ultra on %s", (model) => {
    expect(getThinkingLevels("openai", model)).toEqual(["none", "low", "medium", "high", "xhigh", "max"]);
    expect(applyThinking("openai", model, { reasoning_effort: "ultra" }, "openai").reasoning_effort).toBe("max");
    expect(applyThinking("openai", model, { reasoning_effort: "minimal" }, "openai").reasoning_effort).toBe("low");
  });

  it("keeps Codex Ultra separate from API efforts", () => {
    expect(getThinkingLevels("codex", "gpt-6.1-sol")).toEqual(["low", "medium", "high", "xhigh", "max", "ultra"]);
    const executor = new CodexExecutor();
    expect(executor.transformRequest("gpt-6.1-sol", { input: "hello", reasoning: { effort: "minimal" } }, true, {}).reasoning.effort).toBe("low");
  });

  it.each(["claude-fable-5-1", "claude-opus-5-5"])("never disables always-on thinking for %s", (model) => {
    expect(getThinkingLevels("anthropic", model)).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(applyThinking("claude", model, { thinking: { type: "disabled" } }, "anthropic")).toMatchObject({
      thinking: { type: "adaptive" }, output_config: { effort: "low" },
    });
  });

  it("uses between_tools for Sonnet 5.5's lowest thinking setting", () => {
    expect(applyThinking("claude", "claude-sonnet-5-5", { thinking: { type: "disabled" } }, "anthropic").thinking).toEqual({ type: "between_tools" });
    expect(applyThinking("claude", "claude-sonnet-5-5", { output_config: { effort: "max" } }, "anthropic")).toMatchObject({ thinking: { type: "adaptive" }, output_config: { effort: "max" } });
  });

  it("leaves automatic effort to the provider default", () => {
    expect(applyThinking("claude", "claude-opus-5-5", { thinking: { type: "adaptive" } }, "anthropic").output_config).toBeUndefined();
    expect(applyThinking("openai", "gpt-6.1-sol", { reasoning_effort: "auto" }, "openai").reasoning_effort).toBeUndefined();
  });

  it.each([
    ["gpt-5", ["minimal", "low", "medium", "high"]],
    ["gpt-5-mini", ["minimal", "low", "medium", "high"]],
    ["gpt-5.1", ["none", "low", "medium", "high"]],
    ["gpt-5.2", ["none", "low", "medium", "high", "xhigh"]],
    ["gpt-5.5-pro", ["medium", "high", "xhigh"]],
  ])("keeps legacy effort enums model-specific: %s", (model, levels) => {
    expect(getThinkingLevels("openai", model)).toEqual(levels);
  });

  it("sends both budget and effort for Opus 4.5", () => {
    expect(applyThinking("claude", "claude-opus-4-5", { output_config: { effort: "high" } }, "anthropic")).toMatchObject({
      thinking: { type: "enabled", budget_tokens: expect.any(Number) }, output_config: { effort: "high" },
    });
  });
});
