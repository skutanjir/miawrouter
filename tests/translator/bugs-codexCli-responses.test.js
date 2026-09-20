// Real Codex CLI requests (OpenAI Responses API: { input:[], instructions }) → providers.
import { describe, it, expect } from "vitest";
import "./registerAll.js";
import { translateRequest } from "../../open-sse/translator/index.js";
import { FORMATS } from "../../open-sse/translator/formats.js";
import { injectSystemPrompt } from "../../open-sse/rtk/systemInject.js";
import { CodexExecutor } from "../../open-sse/executors/codex.js";
import { CODEX_DEFAULT_INSTRUCTIONS } from "../../open-sse/config/codexInstructions.js";

const R2O = (body) => translateRequest(FORMATS.OPENAI_RESPONSES, FORMATS.OPENAI, "m", body, true, null, null);
const O2R = (body) => translateRequest(FORMATS.OPENAI, FORMATS.OPENAI_RESPONSES, "m", body, true, null, null);

describe("Codex CLI Responses → OpenAI", () => {
  it("assistant has no empty tool_calls array when all names are empty", () => {
    const out = R2O({
      input: [
        { type: "function_call", call_id: "c1", name: "", arguments: "{}" },
      ],
    });
    const asst = out.messages.find((m) => m.role === "assistant" && m.tool_calls);
    expect(asst?.tool_calls?.length ?? 0, "nameless tool call must be omitted").toBe(0);
  });

  it("function_call arguments end up as a string", () => {
    const out = R2O({
      input: [{ type: "function_call", call_id: "c1", name: "f", arguments: { a: 1 } }],
    });
    const asst = out.messages.find((m) => m.tool_calls);
    expect(typeof asst.tool_calls[0].function.arguments).toBe("string");
  });

  // openai-responses.js:75-77 — input_image uses file_id as raw url
  // KNOWN BUG
  it.fails("input_image with file_id is not used as a raw url", () => {
    const out = R2O({
      input: [{ type: "message", role: "user", content: [
        { type: "input_image", file_id: "file-abc" },
      ] }],
    });
    const userMsg = out.messages.find((m) => m.role === "user");
    const img = Array.isArray(userMsg?.content) ? userMsg.content.find((c) => c.type === "image_url") : null;
    // A bare file_id is not a valid image URL
    expect(img?.image_url?.url === "file-abc").toBe(false);
  });
});

describe("OpenAI → Codex Responses (reverse)", () => {
  it("maps developer messages to Responses API instructions", () => {
    const out = O2R({
      messages: [
        { role: "developer", content: "Follow the project rules." },
        { role: "user", content: "Hello" },
      ],
    });

    expect(out.instructions).toBe("Follow the project rules.");
    expect(out.input).toEqual([
      { type: "message", role: "user", content: [{ type: "input_text", text: "Hello" }] },
    ]);
  });

  // openai-responses.js:13 — clampCallId NOT applied on Responses→Chat; but here Chat→Responses must clamp
  it("call_id longer than 64 chars is clamped", () => {
    const longId = "call_" + "x".repeat(80);
    const out = O2R({
      messages: [
        { role: "assistant", content: null, tool_calls: [
          { id: longId, type: "function", function: { name: "f", arguments: "{}" } },
        ] },
        { role: "tool", tool_call_id: longId, content: "ok" },
      ],
    });
    const fc = out.input.find((i) => i.type === "function_call");
    expect(fc.call_id.length).toBeLessThanOrEqual(64);
  });
});

describe("Codex Responses system injection and executor normalization", () => {
  it("injectSystemPrompt into Responses body uses instructions rather than inserting raw chat object into input", () => {
    const body = {
      model: "gpt-5.6-sol-medium",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Hello" }],
        },
      ],
    };

    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "Respond like terse caveman.");

    // Must set or append to instructions, NOT unshift raw chat message into input
    expect(body.instructions).toBe("Respond like terse caveman.");
    expect(body.input).toHaveLength(1);
    expect(body.input[0].role).toBe("user");
  });

  it("injectSystemPrompt falls back to instructions when format is OPENAI but body is Responses-shaped", () => {
    const body = {
      model: "gpt-5.6-sol-medium",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Hello" }],
        },
      ],
    };

    injectSystemPrompt(body, FORMATS.OPENAI, "Respond like terse caveman.");

    expect(body.instructions).toBe("Respond like terse caveman.");
    expect(body.input).toHaveLength(1);
    expect(body.input[0].role).toBe("user");
  });

  it("injectSystemPrompt appends to existing instructions in Responses body", () => {
    const body = {
      model: "gpt-5.6-sol-medium",
      instructions: "Base instructions",
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Hello" }],
        },
      ],
    };

    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "Respond like terse caveman.");

    expect(body.instructions).toBe("Base instructions\n\nRespond like terse caveman.");
    expect(body.input).toHaveLength(1);
  });

  it("injectSystemPrompt prioritizes messages[] over stray instructions in Chat Completions body", () => {
    const body = {
      model: "gpt-4o",
      instructions: "stray instructions",
      messages: [{ role: "user", content: "Hello" }],
    };

    injectSystemPrompt(body, FORMATS.OPENAI, "Respond like terse caveman.");

    // messages[] wins: injected into messages, instructions unchanged
    expect(body.instructions).toBe("stray instructions");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: "system", content: "Respond like terse caveman." });
    expect(body.messages[1]).toEqual({ role: "user", content: "Hello" });
  });

  it("injectSystemPrompt appends to existing system message in messages[] and ignores stray instructions", () => {
    const body = {
      model: "gpt-4o",
      instructions: "stray instructions",
      messages: [
        { role: "system", content: "Base system prompt." },
        { role: "user", content: "Hello" },
      ],
    };

    injectSystemPrompt(body, FORMATS.OPENAI, "Respond like terse caveman.");

    expect(body.instructions).toBe("stray instructions");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].content).toBe("Base system prompt.\n\nRespond like terse caveman.");
  });

  it("injectSystemPrompt prioritizes messages[] when both messages[] and input[] or instructions are present", () => {
    const body = {
      model: "gpt-5.6-sol-medium",
      messages: [{ role: "user", content: "Chat prompt" }],
      instructions: "Should not be appended when messages[] present",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Responses prompt" }] }],
    };

    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "Respond like terse caveman.");

    // messages[] precedence: inject into messages as system role, preserve instructions unchanged
    expect(body.instructions).toBe("Should not be appended when messages[] present");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]).toEqual({ role: "system", content: "Respond like terse caveman." });
    expect(body.messages[1]).toEqual({ role: "user", content: "Chat prompt" });
  });

  it("CodexExecutor normalizes any legacy/malformed system or developer items in body.input with valid type and content array", () => {
    const executor = new CodexExecutor();
    const body = {
      model: "gpt-5.6-sol-medium",
      instructions: "Follow rules.",
      input: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "developer", content: "Follow rules." },
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "Hi" }],
        },
      ],
      stream: true,
    };

    executor.transformRequest("gpt-5.6-sol-medium", body, true, {
      connectionId: "test-conn",
      providerSpecificData: {},
    });

    // Each developer message in body.input must have type: "message" and content as an array of parts
    const devItems = body.input.filter((item) => item.role === "developer");
    expect(devItems).toHaveLength(2);
    for (const item of devItems) {
      expect(item.type).toBe("message");
      expect(Array.isArray(item.content)).toBe(true);
      expect(item.content[0]).toEqual({
        type: "input_text",
        text: expect.any(String),
      });
    }
  });

  it("CodexExecutor normalizes legacy assistant string-content without corrupting function_call or output items", () => {
    const executor = new CodexExecutor();
    const body = {
      model: "gpt-5.6-sol-medium",
      input: [
        { role: "user", content: "Check status" },
        { role: "assistant", content: "Looking it up now" },
        { type: "function_call", call_id: "c1", name: "get_status", arguments: "{}" },
        { type: "function_call_output", call_id: "c1", output: "ok" },
      ],
      stream: true,
    };

    executor.transformRequest("gpt-5.6-sol-medium", body, true, {
      connectionId: "test-conn",
      providerSpecificData: {},
    });

    expect(body.input).toHaveLength(4);
    expect(body.input[0]).toEqual({
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Check status" }],
    });
    expect(body.input[1]).toEqual({
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "Looking it up now" }],
    });
    expect(body.input[2]).toEqual({
      type: "function_call",
      call_id: "c1",
      name: "get_status",
      arguments: "{}",
    });
    expect(body.input[3]).toEqual({
      type: "function_call_output",
      call_id: "c1",
      output: "ok",
    });
  });

  it("CodexExecutor preserves CODEX_DEFAULT_INSTRUCTIONS when RTK adds modifier instructions to initially instructionless Responses body", () => {
    const executor = new CodexExecutor();
    const body = {
      model: "gpt-5.6-sol-medium",
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      stream: true,
    };

    // Simulate RTK injecting modifier (e.g. caveman / ponytail / hermes) into an initially instructionless body
    injectSystemPrompt(body, FORMATS.OPENAI_RESPONSES, "Respond like terse caveman.");
    expect(body.instructions).toBe("Respond like terse caveman.");

    executor.transformRequest("gpt-5.6-sol-medium", body, true, {
      connectionId: "test-conn",
      providerSpecificData: {},
    });

    expect(body.instructions).toContain(CODEX_DEFAULT_INSTRUCTIONS);
    expect(body.instructions).toContain("Respond like terse caveman.");
    // CODEX_DEFAULT_INSTRUCTIONS should precede or contain the modifier without duplicating default instructions
    const count = (body.instructions.match(/You are Codex, based on GPT-5/g) || []).length;
    expect(count).toBe(1);
  });

  it("CodexExecutor does not duplicate CODEX_DEFAULT_INSTRUCTIONS if already present with modifiers", () => {
    const executor = new CodexExecutor();
    const body = {
      model: "gpt-5.6-sol-medium",
      instructions: `${CODEX_DEFAULT_INSTRUCTIONS}\n\nRespond like terse caveman.`,
      input: [{ type: "message", role: "user", content: [{ type: "input_text", text: "Hello" }] }],
      stream: true,
    };

    executor.transformRequest("gpt-5.6-sol-medium", body, true, {
      connectionId: "test-conn",
      providerSpecificData: {},
    });

    const count = (body.instructions.match(/You are Codex, based on GPT-5/g) || []).length;
    expect(count).toBe(1);
  });

  it("CodexExecutor normalizes legacy user message {role: 'user', content: string} in body.input", () => {
    const executor = new CodexExecutor();
    const body = {
      model: "gpt-5.6-sol-medium",
      input: [
        { role: "user", content: "legacy user message string" },
      ],
      stream: true,
    };

    executor.transformRequest("gpt-5.6-sol-medium", body, true, {
      connectionId: "test-conn",
      providerSpecificData: {},
    });

    expect(body.input).toHaveLength(1);
    expect(body.input[0]).toEqual({
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "legacy user message string" }],
    });
  });
});
