import { describe, expect, it } from "vitest";

import opencodeRegistry from "../../open-sse/providers/registry/opencode.js";
import opencodeZenRegistry from "../../open-sse/providers/registry/opencode-zen.js";
import { FREE_TIER_MODEL_RECORDS } from "../../open-sse/config/freeTierCatalog.js";
import { OpenCodeExecutor } from "../../open-sse/executors/opencode.js";
import { AI_PROVIDERS } from "../../src/shared/constants/providers.js";

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

// The keyless provider is unusable, not merely degraded: upstream's Console
// inference backend gates the free tier to the OpenCode client and answers every
// other caller with `403 FreeTierError`, header identity included. These guards
// stop a future "why is oc missing?" edit from silently re-advertising it.
describe("OpenCode keyless provider is hidden", () => {
  it("hides the keyless provider from registry pickers", () => {
    expect(opencodeRegistry.hidden).toBe(true);
  });

  it("drops it from the model-selector no-auth list", () => {
    // FREE_PROVIDERS intentionally keeps hidden entries so the detail page can
    // still resolve them (same convention as bluesminds/iflow/gitlab); the
    // selector filters on `hidden`, which it previously did not.
    expect(AI_PROVIDERS.opencode).toMatchObject({ alias: "oc", noAuth: true, hidden: true });
    expect(opencodeRegistry.hidden).toBe(true);
  });

  it("keeps the provider records that other code still resolves", () => {
    expect(AI_PROVIDERS.opencode).toMatchObject({ alias: "oc", noAuth: true });
    expect(opencodeRegistry.models.length).toBeGreaterThan(0);
  });

  it("points users at the routes that do work", () => {
    const notice = opencodeRegistry.display.notice;
    expect(notice.text).toMatch(/OpenCode CLI/);
    expect(notice.text).toMatch(/opencode-zen|OpenCode Zen|API key/);
    expect(notice.apiKeyUrl).toBe("https://opencode.ai/auth");
  });

  it("still maps 403 FreeTierError to an actionable message", () => {
    const executor = new OpenCodeExecutor();
    const parsed = executor.parseError(
      { status: 403 },
      JSON.stringify({
        error: {
          type: "FreeTierError",
          message: "OpenCode's free tier can only be used from within OpenCode",
        },
      }),
    );
    expect(parsed.status).toBe(403);
    expect(parsed.message).toMatch(/OpenCode CLI/);
  });

  it("refuses to call upstream instead of paying a guaranteed 403", async () => {
    const executor = new OpenCodeExecutor();
    await expect(executor.execute()).rejects.toMatchObject({
      status: 403,
      code: "free_tier_unavailable",
    });
  });
});
