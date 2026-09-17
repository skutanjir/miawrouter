import { describe, it, expect } from "vitest";
import { isCacheable } from "../../open-sse/cache/l1.js";
import { lastUserText } from "../../open-sse/cache/l2.js";

describe("BUG 1A: L1 and L2 Cache Gemini, Vertex & Antigravity Support", () => {
  const geminiBody = {
    contents: [
      { role: "user", parts: [{ text: "Explain quantum computing in one sentence." }] },
    ],
    generationConfig: { temperature: 0 },
  };

  const vertexBody = {
    contents: [
      { role: "user", parts: [{ text: "List 3 colors." }] },
    ],
    generationConfig: { temperature: 0 },
  };

  const antigravityBody = {
    project: "test-project",
    model: "gemini-3.8-flash-high",
    userAgent: "antigravity",
    request: {
      contents: [
        { role: "user", parts: [{ text: "Hello from Antigravity IDE!" }] },
      ],
      generationConfig: { temperature: 0 },
    },
  };

  const geminiWithToolCall = {
    contents: [
      { role: "user", parts: [{ text: "What is the weather?" }] },
      { role: "model", parts: [{ functionCall: { name: "get_weather", args: {} } }] },
    ],
    generationConfig: { temperature: 0 },
  };

  const geminiWithTools = {
    contents: [
      { role: "user", parts: [{ text: "Calculate this" }] },
    ],
    tools: [{ functionDeclarations: [{ name: "calc" }] }],
    generationConfig: { temperature: 0 },
  };

  describe("L1 isCacheable", () => {
    it("recognizes flat Gemini body with temperature: 0 in generationConfig", () => {
      expect(isCacheable(geminiBody)).toBe(true);
    });

    it("recognizes flat Vertex AI body with temperature: 0 in generationConfig", () => {
      expect(isCacheable(vertexBody)).toBe(true);
    });

    it("recognizes nested Antigravity body with request.contents and generationConfig", () => {
      expect(isCacheable(antigravityBody)).toBe(true);
    });

    it("rejects Gemini request with non-zero temperature", () => {
      const nonZero = { ...geminiBody, generationConfig: { temperature: 0.7 } };
      expect(isCacheable(nonZero)).toBe(false);
    });

    it("rejects Gemini request containing functionCall in parts", () => {
      expect(isCacheable(geminiWithToolCall)).toBe(false);
    });

    it("rejects Gemini request containing tools definitions", () => {
      expect(isCacheable(geminiWithTools)).toBe(false);
    });
  });

  describe("L2 lastUserText", () => {
    it("extracts user prompt from Gemini contents parts", () => {
      expect(lastUserText(geminiBody)).toBe("Explain quantum computing in one sentence.");
    });

    it("extracts user prompt from nested Antigravity request.contents parts", () => {
      expect(lastUserText(antigravityBody)).toBe("Hello from Antigravity IDE!");
    });
  });
});
