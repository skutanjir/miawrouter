import { describe, expect, it } from "vitest";
import { countBodyTokens } from "../../open-sse/utils/tokenizer.js";

describe("countBodyTokens format coverage and framing preservation", () => {
  it("counts tokens conservatively for Gemini/Antigravity contents format", () => {
    const body = {
      model: "gemini-2.5-pro",
      contents: [
        {
          role: "user",
          parts: [{ text: "Hello from Gemini contents" }],
        },
      ],
    };
    const count = countBodyTokens(body);
    expect(count).toBeGreaterThan(0);
    // Preserves JSON framing overhead (e.g. keys, brackets)
    expect(count).toBeGreaterThan(Math.ceil("Hello from Gemini contents".length / 4));
  });

  it("counts tokens for nested request.contents (Antigravity proxy format)", () => {
    const body = {
      model: "gemini-3.6-flash",
      request: {
        contents: [
          {
            role: "user",
            parts: [{ text: "Nested Antigravity payload part" }],
          },
        ],
      },
    };
    const count = countBodyTokens(body);
    expect(count).toBeGreaterThan(0);
  });

  it("counts tokens for raw prompt format", () => {
    const body = {
      model: "gpt-4o",
      prompt: "Raw prompt text for legacy completions",
    };
    const count = countBodyTokens(body);
    expect(count).toBeGreaterThan(0);
  });

  it("counts tokens for Responses and embeddings input format", () => {
    const body = {
      model: "text-embedding-3-small",
      input: ["First chunk of text", "Second chunk of text"],
    };
    const count = countBodyTokens(body);
    expect(count).toBeGreaterThan(0);
  });

  it("counts tokens for schema definitions and structural framing", () => {
    const body = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "Use the tool" }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get weather info",
            parameters: {
              type: "object",
              properties: {
                location: { type: "string", description: "City name" },
              },
              required: ["location"],
            },
          },
        },
      ],
    };
    const count = countBodyTokens(body);
    expect(count).toBeGreaterThan(0);
    // Structural schema framing must be included
    expect(count).toBeGreaterThan(Math.ceil("Use the tool get_weather Get weather info".length / 4));
  });
});
