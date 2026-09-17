import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const basePath = require.resolve("../../src/mitm/handlers/base");
const antigravityPath = require.resolve("../../src/mitm/handlers/antigravity");

describe("BUG 2A: Antigravity MITM Model Assignment", () => {
  let capturedBody = null;

  beforeEach(() => {
    capturedBody = null;
    require.cache[basePath] = {
      id: basePath,
      filename: basePath,
      loaded: true,
      exports: {
        fetchRouter: async (body) => {
          capturedBody = body;
          return { ok: true, status: 200, body: { pipe: () => {} } };
        },
        pipeSSE: async () => {},
      },
    };
    delete require.cache[antigravityPath];
  });

  it("assigns mappedModel when body lacks top-level model key", async () => {
    const antigravityHandler = require("../../src/mitm/handlers/antigravity");
    const internalAgBody = {
      project: "my-project",
      userAgent: "antigravity",
      request: {
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      },
    };
    const bodyBuffer = Buffer.from(JSON.stringify(internalAgBody));
    const req = { url: "/v1internal:streamGenerateContent", headers: {} };
    const res = { writeHead: vi.fn(), end: vi.fn() };

    await antigravityHandler.intercept(req, res, bodyBuffer, "gemini-3.8-flash-high");

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.model).toBe("gemini-3.8-flash-high");
  });

  it("preserves body.model when mappedModel is null/empty", async () => {
    const antigravityHandler = require("../../src/mitm/handlers/antigravity");
    const agBody = {
      model: "existing-model",
      request: { contents: [] },
    };
    const bodyBuffer = Buffer.from(JSON.stringify(agBody));
    const req = { url: "/v1internal:generateContent", headers: {} };
    const res = { writeHead: vi.fn(), end: vi.fn() };

    await antigravityHandler.intercept(req, res, bodyBuffer, null);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.model).toBe("existing-model");
  });
});
