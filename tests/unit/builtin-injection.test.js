import { describe, it, expect } from "vitest";
import { injectAntiSlop } from "../../open-sse/rtk/antislop.js";
import { injectHermes } from "../../open-sse/rtk/hermes.js";
import { getHermesSystemPrompt } from "../../open-sse/rtk/hermesPrompts.js";
import { ANTISLOP_PROMPTS } from "../../open-sse/rtk/antislopPrompts.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

describe("Built-in Anti-Slop System Injection", () => {
  it("injects anti-slop rules into Claude format system array", () => {
    const body = { system: [{ type: "text", text: "You are helpful." }], messages: [] };
    injectAntiSlop(body, FORMATS.CLAUDE, "full");

    expect(Array.isArray(body.system)).toBe(true);
    const combined = body.system.map((s) => s.text).join(" ");
    expect(combined).toContain("ANTI-SLOP RULES");
    expect(combined).toContain("Reject cookie-cutter AI templates");
  });

  it("injects anti-slop rules into OpenAI format messages array", () => {
    const body = { messages: [{ role: "user", content: "Build a landing page." }] };
    injectAntiSlop(body, FORMATS.OPENAI, "full");

    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("ANTI-SLOP RULES");
  });

  it("injects anti-slop rules into Gemini system instruction", () => {
    const body = { contents: [{ role: "user", parts: [{ text: "Build UI" }] }] };
    injectAntiSlop(body, FORMATS.GEMINI, "lite");

    expect(body.systemInstruction?.parts?.[0]?.text).toContain("Anti-Slop Filter");
  });
});

describe("Built-in Hermes Autonomous Agent System Injection", () => {
  it("adapts instructions to OpenCode CLI environment", () => {
    const prompt = getHermesSystemPrompt("opencode");
    expect(prompt).toContain("OpenCode CLI / Zen");
    expect(prompt).toContain("AGENTS.md");
    expect(prompt).toContain("Cross-Session Self-Evolution");
  });

  it("adapts instructions to Claude Code environment", () => {
    const prompt = getHermesSystemPrompt("claude");
    expect(prompt).toContain("Claude Code CLI");
    expect(prompt).toContain("CLAUDE.md");
  });

  it("adapts instructions to Cursor IDE environment", () => {
    const prompt = getHermesSystemPrompt("cursor");
    expect(prompt).toContain("Cursor IDE");
    expect(prompt).toContain(".cursorrules");
  });

  it("injects adapted Hermes reasoning prompt into body", () => {
    const body = { messages: [{ role: "user", content: "Fix bug" }] };
    injectHermes(body, FORMATS.OPENAI, "opencode", "full");

    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("OpenCode CLI");
    expect(body.messages[0].content).toContain("Structured Reasoning");
  });
});
