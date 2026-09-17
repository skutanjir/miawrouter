import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  hasCli: vi.fn(),
  isAuth: vi.fn(),
  isLocal: vi.fn(),
  getApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  getConsistentMachineId: vi.fn(),
  handleChat: vi.fn(),
  initTranslators: vi.fn(),
}));

vi.mock("@/dashboardGuard", () => ({
  hasValidCliToken: mocks.hasCli,
  isAuthenticated: mocks.isAuth,
  isLocalRequest: mocks.isLocal,
}));

vi.mock("@/lib/localDb", () => ({
  getApiKeys: mocks.getApiKeys,
  createApiKey: mocks.createApiKey,
}));

vi.mock("@/shared/utils/machineId", () => ({
  getConsistentMachineId: mocks.getConsistentMachineId,
}));

vi.mock("@/sse/handlers/chat.js", () => ({
  handleChat: mocks.handleChat,
}));

vi.mock("open-sse/translator/index.js", () => ({
  initTranslators: mocks.initTranslators,
}));

describe("POST /api/dashboard/chat/completions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasCli.mockResolvedValue(false);
    mocks.isAuth.mockResolvedValue(true);
    mocks.isLocal.mockReturnValue(true);
    mocks.getApiKeys.mockResolvedValue([{ key: "sk-miaw-testkey", isActive: true }]);
    mocks.getConsistentMachineId.mockResolvedValue("mock-cli-token");
    mocks.initTranslators.mockResolvedValue(undefined);
    mocks.handleChat.mockResolvedValue(new Response("data: {\"choices\":[]}\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }));
  });

  it("rejects unauthorized remote requests with 401", async () => {
    const { POST } = await import("@/app/api/dashboard/chat/completions/route.js");
    mocks.isAuth.mockResolvedValue(false);
    mocks.hasCli.mockResolvedValue(false);
    mocks.isLocal.mockReturnValue(false);

    const req = new Request("http://localhost/api/dashboard/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "test-model", messages: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mocks.handleChat).not.toHaveBeenCalled();
  });

  it("allows authorized dashboard sessions, injects Authorization header and CLI token", async () => {
    const { POST } = await import("@/app/api/dashboard/chat/completions/route.js");
    const req = new Request("http://localhost/api/dashboard/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }], stream: true }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.initTranslators).toHaveBeenCalled();
    expect(mocks.handleChat).toHaveBeenCalled();

    const forwardedReq = mocks.handleChat.mock.calls[0][0];
    expect(forwardedReq.headers.get("Authorization")).toBe("Bearer sk-miaw-testkey");
    expect(forwardedReq.headers.get("x-miaw-cli-token")).toBe("mock-cli-token");
  });

  it("auto-creates a playground API key if database has no active keys", async () => {
    const { POST } = await import("@/app/api/dashboard/chat/completions/route.js");
    mocks.getApiKeys.mockResolvedValue([]);
    mocks.createApiKey.mockResolvedValue({ key: "sk-miaw-auto-created", isActive: true });

    const req = new Request("http://localhost/api/dashboard/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o", messages: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.createApiKey).toHaveBeenCalledWith("Playground Default", "mock-cli-token");

    const forwardedReq = mocks.handleChat.mock.calls[0][0];
    expect(forwardedReq.headers.get("Authorization")).toBe("Bearer sk-miaw-auto-created");
  });

  it("handles OPTIONS preflight with 204 or 200", async () => {
    const { OPTIONS } = await import("@/app/api/dashboard/chat/completions/route.js");
    const res = await OPTIONS();
    expect([200, 204]).toContain(res.status);
  });
});
