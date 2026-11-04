import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequire } from "module";
import { EventEmitter } from "node:events";

const require = createRequire(import.meta.url);
const basePath = require.resolve("../../src/mitm/handlers/base");
const antigravityPath = require.resolve("../../src/mitm/handlers/antigravity");

describe("BUG 2A: Antigravity MITM Model Assignment", () => {
  let capturedBody = null;
  let routerError = null;
  let capturedSignal = null;

  beforeEach(() => {
    capturedBody = null;
    routerError = null;
    capturedSignal = null;
    require.cache[basePath] = {
      id: basePath,
      filename: basePath,
      loaded: true,
      exports: {
        fetchRouter: async (body, _path, _headers, signal) => {
          capturedSignal = signal;
          if (routerError) throw routerError;
          capturedBody = body;
          return { ok: true, status: 200, body: { pipe: () => {} } };
        },
        pipeSSE: async () => {},
      },
    };
    delete require.cache[antigravityPath];
  });

  it("aborts the router request when the client disconnects", async () => {
    const res = new EventEmitter();
    res.writableFinished = false;
    require.cache[basePath].exports.pipeSSE = async () => res.emit("close");
    const handler = require("../../src/mitm/handlers/antigravity");
    await handler.intercept({ url: "/v1internal:streamGenerateContent", headers: {} }, res, Buffer.from("{}"), "model");
    expect(capturedSignal.aborted).toBe(true);
    expect(res.listenerCount("close")).toBe(0);
  });

  it("reports router connection failures as 502 even for streaming requests", async () => {
    routerError = new Error("router unavailable");
    const handler = require("../../src/mitm/handlers/antigravity");
    const res = { headersSent: false, writeHead: vi.fn(), end: vi.fn() };
    await handler.intercept({ url: "/v1internal:streamGenerateContent", headers: {} }, res, Buffer.from("{}"), "model");
    expect(res.writeHead).toHaveBeenCalledWith(502, { "Content-Type": "application/json" });
    expect(JSON.parse(res.end.mock.calls[0][0]).error.message).toBe("router unavailable");
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
