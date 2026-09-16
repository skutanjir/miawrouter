import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getManualOnboardingInstructions,
  getProjectIdForConnection,
  onboardProjectForConnection,
  removeConnection,
  warmProjectIdForConnection,
} from "../../open-sse/services/projectId.js";
import {
  ANTIGRAVITY_LOAD_CODE_ASSIST_HEADERS,
  GEMINI_CLI_API_CLIENT,
  geminiCLIUserAgent,
} from "../../open-sse/config/appConstants.js";

const LOAD_CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist";
const ONBOARD_USER_URL = "https://cloudcode-pa.googleapis.com/v1internal:onboardUser";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getProjectIdForConnection fast lookup (allowOnboarding)", () => {
  it("default lookup reaches onboardUser when loadCodeAssist has no project", async () => {
    const connectionId = "conn-default-onboard";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // loadCodeAssist: no project, no tiers
      .mockResolvedValueOnce(jsonResponse({
        done: true,
        response: { cloudaicompanionProject: { id: "onboarded-project" } },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const pid = await getProjectIdForConnection(connectionId, "token", "gemini-cli");

    expect(pid).toBe("onboarded-project");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, LOAD_CODE_ASSIST_URL, expect.anything());
    expect(fetchMock).toHaveBeenNthCalledWith(2, ONBOARD_USER_URL, expect.anything());
    removeConnection(connectionId);
  });

  it("fast lookup returns null without polling onboardUser", async () => {
    const connectionId = "conn-fast-null";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})); // loadCodeAssist: no project
    vi.stubGlobal("fetch", fetchMock);

    const pid = await getProjectIdForConnection(connectionId, "token", "antigravity", { allowOnboarding: false });

    expect(pid).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // onboardUser never reached
    expect(fetchMock).toHaveBeenCalledWith(
      LOAD_CODE_ASSIST_URL,
      expect.objectContaining({
        headers: expect.objectContaining(ANTIGRAVITY_LOAD_CODE_ASSIST_HEADERS),
      })
    );
    removeConnection(connectionId);
  });

  it("fast lookup still returns a project found by loadCodeAssist", async () => {
    const connectionId = "conn-fast-hit";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ cloudaicompanionProject: { id: "load-project" } }));
    vi.stubGlobal("fetch", fetchMock);

    const pid = await getProjectIdForConnection(connectionId, "token", "antigravity", { allowOnboarding: false });

    expect(pid).toBe("load-project");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    removeConnection(connectionId);
  });

  it("fast lookup caches the null result for later calls", async () => {
    const connectionId = "conn-fast-cache";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})); // loadCodeAssist: no project
    vi.stubGlobal("fetch", fetchMock);

    await getProjectIdForConnection(connectionId, "token", "gemini-cli", { allowOnboarding: false });
    const pid = await getProjectIdForConnection(connectionId, "token", "gemini-cli", { allowOnboarding: false });

    expect(pid).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // second call served from cache
    removeConnection(connectionId);
  });

  it("manual onboarding clears a previous fast-lookup miss and retries", async () => {
    const connectionId = "conn-manual-onboard";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({})) // initial fast lookup miss
      .mockResolvedValueOnce(jsonResponse({})) // manual onboarding loadCodeAssist
      .mockResolvedValueOnce(jsonResponse({
        done: true,
        response: { cloudaicompanionProject: { id: "manual-project" } },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await getProjectIdForConnection(connectionId, "token", "gemini-cli", { allowOnboarding: false });
    const pid = await onboardProjectForConnection(connectionId, "token", "gemini-cli");

    expect(pid).toBe("manual-project");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    removeConnection(connectionId);
  });

  it("uses the native Gemini CLI compatibility profile", async () => {
    const connectionId = "conn-gemini-native-profile";
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ projectId: "native-project" }));
    vi.stubGlobal("fetch", fetchMock);

    const pid = await getProjectIdForConnection(connectionId, "token", "gemini-cli");
    const [, init] = fetchMock.mock.calls[0];

    expect(pid).toBe("native-project");
    expect(init.headers).toEqual(expect.objectContaining({
      "User-Agent": geminiCLIUserAgent(),
      "X-Goog-Api-Client": GEMINI_CLI_API_CLIENT,
    }));
    expect(JSON.parse(init.body)).toEqual(expect.objectContaining({ mode: 1 }));
    removeConnection(connectionId);
  });

  it("falls back to the legacy discovery profile on a compatibility status", async () => {
    const connectionId = "conn-discovery-fallback";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "unsupported client profile" } }, 403))
      .mockResolvedValueOnce(jsonResponse({ cloudaicompanionProject: "fallback-project" }));
    vi.stubGlobal("fetch", fetchMock);

    const pid = await getProjectIdForConnection(connectionId, "token", "gemini-cli");

    expect(pid).toBe("fallback-project");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    removeConnection(connectionId);
  });

  it("tries the next eligible tier when onboarding rejects the default tier", async () => {
    const connectionId = "conn-tier-fallback";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        allowedTiers: [
          { id: "tier-primary", isDefault: true },
          { id: "tier-fallback", isDefault: false },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "tier unavailable" } }, 400))
      .mockResolvedValueOnce(jsonResponse({
        done: true,
        response: { projectId: "tier-project" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const pid = await getProjectIdForConnection(connectionId, "token", "gemini-cli");

    expect(pid).toBe("tier-project");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(expect.objectContaining({ tierId: "tier-primary" }));
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual(expect.objectContaining({ tierId: "tier-fallback" }));
    removeConnection(connectionId);
  });

  it("warms and persists a project ID for a newly connected Google account", async () => {
    const connectionId = "conn-background-warmup";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ cloudaicompanionProject: "warm-project" }));
    const persist = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const pid = await warmProjectIdForConnection({
      connection: { id: connectionId, provider: "antigravity", accessToken: "token" },
      persist,
    });

    expect(pid).toBe("warm-project");
    expect(persist).toHaveBeenCalledWith("warm-project");
    removeConnection(connectionId);
  });

  it("returns manual recovery instructions when Google onboarding is rejected", () => {
    expect(getManualOnboardingInstructions("antigravity")).toEqual(expect.objectContaining({
      command: "agy login",
      retryAction: "Run the command, then click Onboard again.",
    }));
  });
});
