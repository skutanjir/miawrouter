import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({ connection: vi.fn(), refresh: vi.fn(), update: vi.fn() }));

vi.mock("@/models", () => ({ getProviderConnectionById: mocks.connection }));
vi.mock("@/lib/db/repos/aliasRepo.js", () => ({ upsertCustomModels: vi.fn() }));
vi.mock("@/sse/services/tokenRefresh", () => ({
  refreshGoogleToken: vi.fn(),
  refreshCodexToken: vi.fn(),
  refreshClaudeOAuthToken: mocks.refresh,
  updateProviderCredentials: mocks.update,
}));

import { resolveProviderConnectionModels } from "../../src/app/api/providers/[id]/models/route.js";

const jsonOnce = (calls, payload) => vi.fn(async (_url, init) => {
  calls.push(init);
  return Response.json(payload);
});

describe("claude live model discovery auth scheme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("sends an OAuth token as Authorization: Bearer + oauth beta, never x-api-key", async () => {
    const calls = [];
    global.fetch = jsonOnce(calls, { data: [{ id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" }] });

    const result = await resolveProviderConnectionModels({
      id: "c1", provider: "claude", authType: "oauth", accessToken: "oauth-token", refreshToken: "rt",
    });

    const headers = calls[0].headers;
    expect(headers.Authorization).toBe("Bearer oauth-token");
    expect(headers["anthropic-beta"]).toBe("oauth-2025-04-20");
    expect(headers["x-api-key"]).toBeUndefined();
    expect(result.source).toBe("live");
    expect(result.models).toEqual([expect.objectContaining({ id: "claude-sonnet-5-5" })]);
  });

  it("keeps x-api-key for API-key connections", async () => {
    const calls = [];
    global.fetch = jsonOnce(calls, { data: [{ id: "claude-sonnet-5-5" }] });

    await resolveProviderConnectionModels({ id: "c2", provider: "claude", authType: "apikey", apiKey: "sk-ant-key" });

    expect(calls[0].headers["x-api-key"]).toBe("sk-ant-key");
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].headers["anthropic-beta"]).toBeUndefined();
  });

  it("refreshes once on 401 and retries with the refreshed token", async () => {
    const calls = [];
    let n = 0;
    global.fetch = vi.fn(async (_url, init) => {
      calls.push(init);
      n += 1;
      return n === 1 ? new Response("unauthorized", { status: 401 }) : Response.json({ data: [{ id: "claude-opus-5-5" }] });
    });
    mocks.refresh.mockResolvedValue({ accessToken: "fresh-token", expiresIn: 3600 });
    mocks.update.mockResolvedValue(undefined);

    const result = await resolveProviderConnectionModels({
      id: "c3", provider: "claude", authType: "oauth", accessToken: "stale-token", refreshToken: "rt-3",
    });

    expect(mocks.refresh).toHaveBeenCalledWith("rt-3");
    expect(mocks.update).toHaveBeenCalledWith("c3", expect.objectContaining({ accessToken: "fresh-token" }));
    expect(calls[1].headers.Authorization).toBe("Bearer fresh-token");
    expect(result.models).toEqual([expect.objectContaining({ id: "claude-opus-5-5" })]);
  });

  it("falls back to the bundled catalog with a warning instead of throwing a bare 401", async () => {
    global.fetch = vi.fn(async () => new Response("nope", { status: 401 }));

    const result = await resolveProviderConnectionModels({ id: "c4", provider: "claude", authType: "apikey", apiKey: "bad" });

    expect(result.source).toBe("static");
    expect(result.warning).toContain("401");
    expect(result.models.length).toBeGreaterThan(0);
  });
});
