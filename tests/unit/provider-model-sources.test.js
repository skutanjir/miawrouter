import { describe, it, expect, vi } from "vitest";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { buildRegistryModelSources, findRegistryModelSource, parseRegistryModels, fetchRegistryModels } from "../../src/lib/catalog/providerModelSources.js";

describe("provider model sources", () => {
  it("keeps all registry model identities unique within their service kind", () => {
    expect(new Set(REGISTRY.map((p) => p.id)).size).toBe(REGISTRY.length);
    for (const p of REGISTRY) {
      const ids = (p.models || []).map((m) => `${m.id}|${m.kind || "llm"}`);
      expect(new Set(ids).size, p.id).toBe(ids.length);
    }
  });
  it("does not treat account validation as a model list", () => {
    expect(buildRegistryModelSources([{ id: "account", transport: { validateUrl: "https://example.com/account" } }])).toEqual([]);
  });
  it("preserves raw provider headers and declared prefixes", () => {
    expect(findRegistryModelSource("anthropic")).toMatchObject({ authHeader: "x-api-key", authPrefix: "", headers: { "anthropic-version": "2023-06-01" } });
    expect(findRegistryModelSource("gemini")).toMatchObject({ authHeader: "x-goog-api-key", authPrefix: "" });
  });
  it("normalizes Gemini, Ollama and string model lists", () => {
    expect(parseRegistryModels({ models: [{ name: "models/gemini-test", displayName: "Gemini Test" }, { id: "gemini-test" }] })).toEqual([{ name: "Gemini Test", displayName: "Gemini Test", id: "gemini-test" }]);
    expect(parseRegistryModels({ models: [{ model: "local:latest" }] })[0].id).toBe("local:latest");
    expect(parseRegistryModels(["one", "one", "two"]).map((m) => m.id)).toEqual(["one", "two"]);
  });
  it("sends authentication to a fixed endpoint with redirects disabled", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ data: [{ id: "model" }] }));
    const result = await fetchRegistryModels(findRegistryModelSource("anthropic"), { apiKey: "test-key" }, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("https://api.anthropic.com/"), expect.objectContaining({ redirect: "error", headers: expect.objectContaining({ "x-api-key": "test-key" }) }));
    expect(result).toMatchObject({ source: "live", models: [{ id: "model" }] });
  });
  it("reports account authorization failures without calling them live catalogs", async () => {
    const result = await fetchRegistryModels(findRegistryModelSource("openai"), {}, { fetchImpl: async () => new Response("", { status: 401 }) });
    expect(result).toMatchObject({ models: [], authRequired: true, status: 401 });
    expect(result.source).toBeUndefined();
  });
});
