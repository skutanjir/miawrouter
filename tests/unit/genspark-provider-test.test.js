import { afterEach, describe, expect, it, vi } from "vitest";
import { testApiKeyConnection } from "../../src/app/api/providers/[id]/test/testUtils.js";

describe("Genspark provider connection test", () => {
  afterEach(() => vi.restoreAllMocks());

  it("validates an API key through the Genspark models endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const result = await testApiKeyConnection({ provider: "genspark", apiKey: "test-key" });

    expect(result).toEqual({ valid: true, error: null });
    expect(fetchMock).toHaveBeenCalledWith("https://www.genspark.ai/api/tool_cli/me", {
      headers: { "X-Api-Key": "test-key" },
    });
  });
});
