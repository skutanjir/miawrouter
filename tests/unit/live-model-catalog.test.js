import { describe, expect, it, vi } from "vitest";

import {
  mergeCodexModelsCache,
  normalizeLiveModels,
  syncConnectionModelCatalog,
} from "../../src/lib/catalog/liveModelCatalog.js";

describe("live model catalog", () => {
  it("expands live Codex models with every declared effort and maps variants upstream", () => {
    const rows = normalizeLiveModels(
      { provider: "codex" },
      [{
        id: "gpt-6-sol",
        display_name: "GPT 6 Sol",
        supported_reasoning_levels: [
          { effort: "low", description: "fast" },
          { effort: "high", description: "deep" },
        ],
      }, {
        id: "gpt-6-sol-review",
        display_name: "GPT 6 Sol Review",
        supported_reasoning_levels: [{ effort: "high" }],
      }]
    );

    expect(rows.map((row) => row.id)).toEqual([
      "gpt-6-sol",
      "gpt-6-sol-low",
      "gpt-6-sol-high",
      "gpt-6-sol-review",
    ]);
    expect(rows.find((row) => row.id === "gpt-6-sol-high")).toMatchObject({
      upstreamModelId: "gpt-6-sol",
      effortPreset: "high",
      providerAlias: "cx",
    });
    expect(rows.some((row) => row.id === "gpt-6-sol-review-high")).toBe(false);
  });

  it("falls back to the existing Codex effort rules when live metadata is absent", () => {
    const rows = normalizeLiveModels(
      { provider: "codex" },
      [{ id: "gpt-5.6-luna", name: "GPT 5.6 Luna" }]
    );

    expect(rows.map((row) => row.id)).toEqual([
      "gpt-5.6-luna",
      "gpt-5.6-luna-low",
      "gpt-5.6-luna-medium",
      "gpt-5.6-luna-high",
      "gpt-5.6-luna-xhigh",
      "gpt-5.6-luna-max",
    ]);

    const gpt6Rows = normalizeLiveModels(
      { provider: "codex" },
      [{ id: "gpt-6-luna", name: "GPT 6 Luna" }]
    );
    expect(gpt6Rows.map((row) => row.id)).toEqual([
      "gpt-6-luna",
      "gpt-6-luna-low",
      "gpt-6-luna-medium",
      "gpt-6-luna-high",
      "gpt-6-luna-xhigh",
      "gpt-6-luna-max",
    ]);
  });

  it("merges Codex cache records without dropping unrelated entries", () => {
    const cache = {
      models: [
        { id: "legacy/model", custom_field: "keep-id-entry" },
        { slug: "other/model", custom_field: "keep" },
        { slug: "cx/gpt-6-sol", supported_reasoning_levels: [{ effort: "low" }] },
      ],
    };

    const merged = mergeCodexModelsCache(cache, [{
      providerAlias: "cx",
      id: "gpt-6-sol",
      name: "GPT 6 Sol",
      reasoningLevels: ["low", "high"],
    }]);

    expect(merged.models.find((model) => model.slug === "other/model")).toEqual({
      slug: "other/model",
      custom_field: "keep",
    });
    expect(merged.models.find((model) => model.id === "legacy/model")).toEqual({
      id: "legacy/model",
      custom_field: "keep-id-entry",
    });
    expect(merged.models.find((model) => model.slug === "cx/gpt-6-sol")).toMatchObject({
      display_name: "GPT 6 Sol",
      supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
    });
  });

  it("syncs one connection and keeps provider errors fail-open", async () => {
    const upsert = vi.fn(async () => ({ added: 1, updated: 0 }));
    const writeCache = vi.fn(async () => undefined);
    const resolve = vi.fn(async () => ({
      models: [{ id: "new-model", name: "New Model" }],
    }));

    await expect(syncConnectionModelCatalog(
      { id: "c1", provider: "openai", apiKey: "sk-test", isActive: true },
      { resolve, upsert, writeCache }
    )).resolves.toMatchObject({ synced: 1 });
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({ id: "new-model", providerAlias: "openai" }),
    ]);
    expect(writeCache).not.toHaveBeenCalled();

    resolve.mockRejectedValueOnce(new Error("offline"));
    await expect(syncConnectionModelCatalog(
      { id: "c1", provider: "openai", apiKey: "sk-test", isActive: true },
      { resolve, upsert, writeCache }
    )).resolves.toMatchObject({ synced: 0, failed: true });
  });
});
