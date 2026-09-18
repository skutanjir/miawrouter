import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canAccess: vi.fn(),
  json: vi.fn((body, init) => ({ status: init?.status || 200, body })),
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  exec: vi.fn(),
}));

vi.mock("@/dashboardGuard", () => ({ canAccessLocalOnlyRoute: mocks.canAccess }));
vi.mock("next/server", () => ({ NextResponse: { json: mocks.json } }));
vi.mock("fs/promises", () => ({
  default: {
    access: mocks.access,
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
    mkdir: mocks.mkdir,
  },
}));
vi.mock("child_process", () => ({
  exec: (cmd, opts, cb) => {
    if (typeof opts === "function") mocks.exec(cmd, {}, opts);
    else mocks.exec(cmd, opts, cb);
  },
}));

const { GET, POST, DELETE } = await import("../../src/app/api/cli-tools/grok-build-settings/route.js");

function lastBody() { return mocks.json.mock.calls[mocks.json.mock.calls.length - 1]?.[0]; }
function lastStatus() { return mocks.json.mock.calls[mocks.json.mock.calls.length - 1]?.[1]?.status || 200; }

describe("grok-build-settings route guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccess.mockResolvedValue(true);
  });

  it("returns 403 on GET when local authentication fails", async () => {
    mocks.canAccess.mockResolvedValue(false);
    const res = await GET(new Request("http://localhost/api/cli-tools/grok-build-settings"));
    expect(res.status).toBe(403);
    expect(res.body?.error).toMatch(/Local authentication required/i);
  });

  it("returns 403 on POST when local authentication fails", async () => {
    mocks.canAccess.mockResolvedValue(false);
    const res = await POST(new Request("http://localhost/api/cli-tools/grok-build-settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ baseUrl: "http://127.0.0.1:21128", model: "model-1" }),
    }));
    expect(res.status).toBe(403);
    expect(res.body?.error).toMatch(/Local authentication required/i);
  });

  it("returns 403 on DELETE when local authentication fails", async () => {
    mocks.canAccess.mockResolvedValue(false);
    const res = await DELETE(new Request("http://localhost/api/cli-tools/grok-build-settings", {
      method: "DELETE",
    }));
    expect(res.status).toBe(403);
    expect(res.body?.error).toMatch(/Local authentication required/i);
  });
});
