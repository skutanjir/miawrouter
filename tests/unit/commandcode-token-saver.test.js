import { describe, it, expect } from "vitest";
import { injectSystemPrompt } from "../../open-sse/rtk/systemInject.js";
import { compressMessages } from "../../open-sse/rtk/index.js";
import {
  resolveCacheCapability,
  supportsCacheMarkers,
  CACHE_MODE,
  CACHE_MARKER,
} from "../../open-sse/providers/cacheCapabilities.js";
import { FORMATS } from "../../open-sse/translator/formats.js";

function makeLongDiff() {
  const lines = [
    "diff --git a/foo.js b/foo.js",
    "index abc..def 100644",
    "--- a/foo.js",
    "+++ b/foo.js",
    "@@ -1,3 +1,200 @@",
  ];
  for (let i = 0; i < 200; i++) lines.push(`+added line ${i} ${"x".repeat(20)}`);
  return lines.join("\n");
}

describe("CommandCode Token Saver - System Injection", () => {
  it("sets body.system on empty system and leaves body.messages without role:system", () => {
    const body = {
      messages: [{ role: "user", content: "hello" }],
    };
    injectSystemPrompt(body, FORMATS.COMMANDCODE, "Caveman instruction");

    expect(body.system).toBe("Caveman instruction");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages.some((m) => m.role === "system")).toBe(false);
  });

  it("appends to existing body.system with \\n\\n separator and does not insert role:system", () => {
    const body = {
      system: "Base prompt",
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi" },
      ],
    };
    injectSystemPrompt(body, FORMATS.COMMANDCODE, "Additional prompt");

    expect(body.system).toBe("Base prompt\n\nAdditional prompt");
    expect(body.messages).toHaveLength(2);
    expect(body.messages.some((m) => m.role === "system")).toBe(false);
  });

  it("appends to body.params.system when request envelope wraps params", () => {
    const body = {
      params: {
        system: "Params system prompt",
        messages: [{ role: "user", content: "hello" }],
      },
    };
    injectSystemPrompt(body, FORMATS.COMMANDCODE, "Extra prompt");

    expect(body.system).toBe("Extra prompt");
    expect(body.params.system).toBe("Params system prompt\n\nExtra prompt");
    expect(body.params.messages.some((m) => m.role === "system")).toBe(false);
  });
});

describe("CommandCode Token Saver - RTK Tool-Result Compression", () => {
  it("compresses CommandCode tool-result block with output.value and updates result", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_123",
              toolName: "run_diff",
              output: { type: "text", value: big },
              result: big,
            },
          ],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats).not.toBeNull();
    expect(stats.hits.length).toBeGreaterThan(0);

    const block = body.messages[0].content[0];
    expect(block.output.value.length).toBeLessThan(big.length);
    expect(block.result).toBe(block.output.value);
  });

  it("compresses CommandCode tool-result embedded in user message", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_abc",
              toolName: "bash",
              output: { type: "text", value: big },
              result: big,
            },
          ],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats).not.toBeNull();
    expect(stats.hits.length).toBeGreaterThan(0);

    const block = body.messages[0].content[0];
    expect(block.output.value.length).toBeLessThan(big.length);
    expect(block.result).toBe(block.output.value);
  });

  it("compresses tool-result with string output or string result", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_xyz",
              toolName: "git",
              output: big,
              result: big,
            },
          ],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats).not.toBeNull();
    expect(stats.hits.length).toBeGreaterThan(0);

    const block = body.messages[0].content[0];
    expect(block.output.length).toBeLessThan(big.length);
    expect(block.result).toBe(block.output);
  });

  it("skips tool-result blocks with isError: true", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_err",
              toolName: "fail",
              output: { type: "text", value: big },
              result: big,
              isError: true,
            },
          ],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats.hits.length).toBe(0);
    expect(body.messages[0].content[0].output.value).toBe(big);
    expect(body.messages[0].content[0].result).toBe(big);
  });

  it("skips tool-result blocks with is_error: true", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_err2",
              toolName: "fail2",
              output: { type: "text", value: big },
              result: big,
              is_error: true,
            },
          ],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats.hits.length).toBe(0);
    expect(body.messages[0].content[0].output.value).toBe(big);
  });

  it("skips tool-result blocks with status: 'error'", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "tool",
          content: [
            {
              type: "tool-result",
              toolCallId: "call_err3",
              toolName: "fail3",
              output: { type: "text", value: big },
              result: big,
              status: "error",
            },
          ],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats.hits.length).toBe(0);
    expect(body.messages[0].content[0].output.value).toBe(big);
  });

  it("preserves standard Claude tool_result compression alongside CommandCode", () => {
    const big = makeLongDiff();
    const body = {
      messages: [
        {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "toolu_1", content: big }],
        },
      ],
    };

    const stats = compressMessages(body, true);
    expect(stats).not.toBeNull();
    expect(stats.hits.length).toBeGreaterThan(0);
    expect(body.messages[0].content[0].content.length).toBeLessThan(big.length);
  });
});

describe("CommandCode Token Saver - Cache Capability", () => {
  it("resolves accurate capability for CommandCode without claiming marker support", () => {
    const cap = resolveCacheCapability("commandcode", FORMATS.COMMANDCODE);
    expect(cap.mode).toBe(CACHE_MODE.UNKNOWN);
    expect(cap.supportsCacheMarkers).toBe(false);
    expect(cap.marker).toBe(CACHE_MARKER.NONE);
    expect(supportsCacheMarkers("commandcode", FORMATS.COMMANDCODE)).toBe(false);
  });
});
