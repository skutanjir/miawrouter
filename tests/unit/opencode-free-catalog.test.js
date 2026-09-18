import { describe, expect, it } from "vitest";

import opencodeRegistry from "../../open-sse/providers/registry/opencode.js";
import opencodeZenRegistry from "../../open-sse/providers/registry/opencode-zen.js";
import { FREE_TIER_MODEL_RECORDS } from "../../open-sse/config/freeTierCatalog.js";

// Snapshot of https://opencode.ai/zen/v1/models free ids, verified 2026-09-18.
// Both the keyless `opencode` provider and the API-key `opencode-zen` provider
// read the same catalog, so their static fallback lists must agree with it.
// Refresh procedure: GET https://opencode.ai/zen/v1/models and take every id
// that ends in "-free" plus "big-pickle".
const LIVE_FREE_IDS = [
  "big-pickle",
  "deepseek-v4-flash-free",
  "mimo-v2.5-free",
  "ling-3.0-flash-fin-free",
  "muse-spark-1.2-contributor-free",
  "muse-spark-1.3-contributor-free",
  "nemotron-3-ultra-free",
  "nemotron-3.5-lightning-free",
];

// Free ids the registry used to advertise but upstream now answers with
// `401 ModelError: Model <id> is not supported`. They must not come back.
const DEAD_FREE_IDS = [
  "laguna-s-2.1-free",
  "longcat-2.0-free",
  "hy3-free",
  "hy3-preview-free",
  "minimax-m3-free",
  "minimax-m2.1-free",
  "minimax-m2.5-free",
  "glm-5-free",
  "glm-4.7-free",
  "mimo-v2-flash-free",
  "mimo-v2-omni-free",
  "mimo-v2-pro-free",
  "qwen3.6-plus-free",
  "ling-3.0-flash-free",
  "x-preview-f-free",
  "kimi-k2.5-free",
  "north-mini-code-free",
];

const freeIdsOf = (entry) =>
  entry.models.filter((m) => m.isFreeTier).map((m) => m.id).sort();

describe("OpenCode free model catalog", () => {
  it("lists exactly the upstream free set for the keyless provider", () => {
    expect(freeIdsOf(opencodeRegistry)).toEqual([...LIVE_FREE_IDS].sort());
  });

  it("lists exactly the upstream free set for the API-key provider", () => {
    expect(freeIdsOf(opencodeZenRegistry)).toEqual([...LIVE_FREE_IDS].sort());
  });

  it("drops free models upstream no longer serves", () => {
    for (const registry of [opencodeRegistry, opencodeZenRegistry]) {
      const ids = registry.models.map((m) => m.id);
      for (const dead of DEAD_FREE_IDS) expect(ids).not.toContain(dead);
    }
  });

  it("keeps the free-tier catalog records inside the live set", () => {
    const records = FREE_TIER_MODEL_RECORDS.filter(
      (r) => r.provider === "opencode" || r.provider === "opencode-zen",
    );
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) expect(LIVE_FREE_IDS).toContain(record.modelId);
  });

  it("does not advertise dead ids in the free-tier catalog", () => {
    const ids = FREE_TIER_MODEL_RECORDS.filter(
      (r) => r.provider === "opencode" || r.provider === "opencode-zen",
    ).map((r) => r.modelId);
    for (const dead of DEAD_FREE_IDS) expect(ids).not.toContain(dead);
  });
});
