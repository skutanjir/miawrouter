import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { getUsageForProvider } from "../../open-sse/services/usage.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("Antigravity usage project id resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the projectId stored on the provider connection", async () => {
    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) {
        return jsonResponse({ cloudaicompanionProject: "wrong-project", currentTier: { name: "Pro" } });
      }
      if (url.includes(":fetchAvailableModels")) {
        return jsonResponse({ models: {} });
      }
      if (url.includes(":retrieveUserQuotaSummary")) {
        return jsonResponse({ error: "Not Found" }, 404);
      }
      return jsonResponse({}, 404);
    });

    await getUsageForProvider({
      provider: "antigravity",
      accessToken: "token",
      projectId: "ag-connection-project",
    });

    const modelCall = proxyAwareFetch.mock.calls.find(([url]) => url.includes(":fetchAvailableModels"));
    expect(modelCall).toBeTruthy();
    expect(JSON.parse(modelCall[1].body)).toEqual({ project: "ag-connection-project" });
  });
});
