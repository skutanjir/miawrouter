import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnectionById: vi.fn(),
  updateProviderConnection: vi.fn(),
  resolveConnectionProxyConfig: vi.fn(),
  checkAndRefreshToken: vi.fn(),
  onboardProjectForConnection: vi.fn(),
  getManualOnboardingInstructions: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({ body, status: init.status || 200 }),
  },
}));
vi.mock("@/lib/localDb", () => ({
  getProviderConnectionById: mocks.getProviderConnectionById,
  updateProviderConnection: mocks.updateProviderConnection,
}));
vi.mock("@/lib/network/connectionProxy", () => ({
  resolveConnectionProxyConfig: mocks.resolveConnectionProxyConfig,
}));
vi.mock("@/sse/services/tokenRefresh.js", () => ({
  checkAndRefreshToken: mocks.checkAndRefreshToken,
}));
vi.mock("open-sse/services/projectId.js", () => ({
  getManualOnboardingInstructions: mocks.getManualOnboardingInstructions,
  onboardProjectForConnection: mocks.onboardProjectForConnection,
}));

const { POST } = await import("../../src/app/api/providers/[id]/onboard/route.js");

describe("POST /api/providers/[id]/onboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProviderConnectionById.mockResolvedValue({
      id: "conn-1",
      provider: "antigravity",
      accessToken: "old-token",
      refreshToken: "refresh-token",
      providerSpecificData: { proxyPoolId: "pool-1" },
    });
    mocks.checkAndRefreshToken.mockResolvedValue({
      connectionId: "conn-1",
      accessToken: "fresh-token",
      providerSpecificData: { proxyPoolId: "pool-1" },
    });
    mocks.resolveConnectionProxyConfig.mockResolvedValue({
      connectionProxyEnabled: true,
      connectionProxyUrl: "http://127.0.0.1:8080",
      connectionNoProxy: "localhost",
      strictProxy: true,
      vercelRelayUrl: "",
    });
    mocks.onboardProjectForConnection.mockResolvedValue("real-project");
    mocks.getManualOnboardingInstructions.mockReturnValue({
      command: "agy login",
      retryAction: "Run the command, then click Onboard again.",
    });
  });

  it("refreshes, onboards, and persists the real project ID", async () => {
    const response = await POST({}, { params: Promise.resolve({ id: "conn-1" }) });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, projectId: "real-project" });
    expect(mocks.onboardProjectForConnection).toHaveBeenCalledWith(
      "conn-1",
      "fresh-token",
      "antigravity",
      expect.objectContaining({
        timeoutMs: 60_000,
        proxyOptions: expect.objectContaining({ strictProxy: true }),
      }),
    );
    expect(mocks.updateProviderConnection).toHaveBeenCalledWith("conn-1", { projectId: "real-project" });
  });

  it("returns manual agy recovery when Google rejects onboarding", async () => {
    mocks.onboardProjectForConnection.mockResolvedValue(null);

    const response = await POST({}, { params: Promise.resolve({ id: "conn-1" }) });

    expect(response.status).toBe(422);
    expect(response.body.manualRecovery).toEqual({
      command: "agy login",
      retryAction: "Run the command, then click Onboard again.",
    });
    expect(response.body.safety).toEqual(expect.objectContaining({
      realProjectIdOnly: true,
      syntheticProjectIds: false,
    }));
  });
});
