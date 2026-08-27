import { describe, expect, it } from "vitest";

import {
  FILTERS,
  FILTER_URLS,
  PROVIDER_FETCHERS,
  findProviderFetcher,
  extractModels,
} from "../../src/app/api/providers/suggested-models/filters.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";

describe("suggested-models extractModels", () => {
  it("unwraps bare arrays", () => {
    expect(extractModels([{ id: "a" }])).toEqual([{ id: "a" }]);
  });

  it("unwraps OpenAI {data:[...]} and {models:[...]} envelopes", () => {
    expect(extractModels({ data: [{ id: "a" }] })).toEqual([{ id: "a" }]);
    expect(extractModels({ models: [{ id: "b" }] })).toEqual([{ id: "b" }]);
  });

  it("unwraps models.dev-style catalogs (first value is a record map)", () => {
    const json = { someprovider: { "model-a": { name: "A" }, "model-b": {} } };
    expect(extractModels(json)).toEqual([
      { id: "model-a", name: "A" },
      { id: "model-b" },
    ]);
  });

  it("returns [] for junk input instead of throwing", () => {
    expect(extractModels(null)).toEqual([]);
    expect(extractModels("nope")).toEqual([]);
    expect(extractModels({ data: "not-an-array" })).toEqual([]);
  });
});

describe("suggested-models openai filter", () => {
  const openai = FILTERS.openai;

  it("keeps entries with string ids and defaults name to id", () => {
    expect(openai([{ id: "m1" }, { nope: true }, { id: 42 }])).toEqual([{ id: "m1", name: "m1" }]);
  });

  it("maps context_length / context_window / max_model_len to contextLength", () => {
    const out = openai([
      { id: "a", context_length: 1000 },
      { id: "b", context_window: 2000 },
      { id: "c", max_model_len: 3000 },
      { id: "d", context_length: "bad" },
    ]);
    expect(out.map((m) => m.contextLength)).toEqual([1000, 2000, 3000, undefined]);
  });

  it("is fail-open on malformed payloads", () => {
    expect(openai(null)).toEqual([]);
    expect(openai("x")).toEqual([]);
    expect(openai([null, undefined, {}])).toEqual([]);
  });
});

describe("registry-derived fetcher allowlist", () => {
  it("resolves explicit typed fetchers (openrouter)", () => {
    const f = findProviderFetcher("openrouter");
    expect(f).toMatchObject({
      url: "https://openrouter.ai/api/v1/models",
      type: "openrouter-free",
    });
  });

  it("defaults missing types to the generic openai filter (gorouter)", () => {
    const entry = REGISTRY.find((e) => e.id === "gorouter");
    expect(entry?.modelsFetcher?.type).toBeUndefined();
    expect(findProviderFetcher("gorouter")).toMatchObject({
      url: "https://api.gorouter.app/v1/models",
      type: "openai",
    });
  });

  it("returns null for unknown providers", () => {
    expect(findProviderFetcher("does-not-exist")).toBeNull();
  });

  it("registers every https modelsFetcher in the allowlist", () => {
    const expected = REGISTRY.filter(
      (e) => typeof e?.modelsFetcher?.url === "string" && e.modelsFetcher.url.startsWith("https://")
    );
    expect(PROVIDER_FETCHERS.length).toBeGreaterThanOrEqual(expected.length);
  });

  it("exposes special curated URLs alongside registry-derived ones", () => {
    expect(FILTER_URLS["openrouter-free"]).toBe("https://openrouter.ai/api/v1/models");
    expect(FILTER_URLS.openai).toBeDefined();
  });
});

describe("new free-tier providers are registered with refreshable model lists", () => {
  const cases = [
    ["ovh-ai-endpoints", "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models"],
    ["huggingface-router", "https://router.huggingface.co/v1/models"],
    ["modelscope", "https://api-inference.modelscope.cn/v1/models"],
  ];

  for (const [id, modelsUrl] of cases) {
    it(`${id} has an openai modelsFetcher + static models`, () => {
      const entry = REGISTRY.find((e) => e.id === id);
      expect(entry).toBeDefined();
      expect(entry.category).toBe("freeTier");
      expect(entry.modelsFetcher).toEqual({ url: modelsUrl, type: "openai" });
      expect(Array.isArray(entry.models)).toBe(true);
      expect(entry.models.length).toBeGreaterThan(0);
    });

    it(`${id} is resolvable through the suggested-models allowlist`, () => {
      expect(findProviderFetcher(id)?.type).toBe("openai");
    });
  }
});
