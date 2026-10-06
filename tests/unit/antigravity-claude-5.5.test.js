import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import vm from "node:vm";
import { getModelsByProviderId, getModelUpstreamId, isValidModel } from "../../open-sse/config/providerModels.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import { parseModel } from "../../open-sse/services/model.js";
import { AntigravityExecutor } from "../../open-sse/executors/antigravity.js";
import { openaiToAntigravityRequest } from "../../open-sse/translator/request/openai-to-gemini.js";
import { stripThinkingSuffix } from "../../open-sse/translator/concerns/thinkingUnified.js";
import { MITM_TOOLS } from "../../src/shared/constants/cliTools.js";

const require = createRequire(import.meta.url);
const { MODEL_SYNONYMS, MODEL_PATTERNS } = require("../../src/mitm/config.js");
const serverSource = fs.readFileSync(new URL("../../src/mitm/server.js", import.meta.url), "utf8");
// Exercise the runtime resolver without starting the TLS server or touching certificates.
const resolverSource = serverSource.match(/function getMappedModel\(tool, model\) \{[\s\S]*?\r?\n\}/)[0];
function resolveMitm(model, aliases) {
  return vm.runInNewContext(`${resolverSource}\ngetMappedModel('antigravity', model)`, {
    model, MODEL_SYNONYMS, MODEL_PATTERNS, getMitmAlias: () => aliases,
  });
}

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(async (url) => ({
    ok: true,
    status: 200,
    json: async () => url.includes(":loadCodeAssist")
      ? { cloudaicompanionProject: "test-project", paidTier: { id: "g1-pro-tier" } }
      : url.includes(":retrieveUserQuotaSummary") ? {} : {
        models: Object.fromEntries(["sonnet", "opus"].map((family) => [
          `models/claude-${family}-5-5-thinking`,
          { displayName: `Claude ${family} 5.5 (Thinking)`, quotaInfo: { remainingFraction: 0.6 } },
        ])),
      },
  })),
}));

describe("Antigravity Claude 5.5", () => {
  it.each(["sonnet", "opus"])("exposes %s 5.5 in the API catalog and optional MITM slots", (family) => {
    const id = `claude-${family}-5-5`;
    expect(getModelsByProviderId("antigravity").find((model) => model.id === id)?.name).toContain("5.5 (Thinking)");
    expect(isValidModel("ag", id)).toBe(true);
    // Upstream requires the dash tier ("claude-sonnet-5-5-high" → 200, "(high)" → 404
    // NOT_FOUND). The "(high)" level suffix is folded into the tier and stripped again
    // by stripThinkingSuffix before the wire call, so the effective id stays "-high".
    expect(stripThinkingSuffix(getModelUpstreamId("ag", `${id}(high)`))).toBe(`${id}-high`);
    expect(parseModel(`ag/${id}`)).toMatchObject({ provider: "antigravity", model: id });
    expect(MITM_TOOLS.antigravity.modelAliases).toContain(id);
    expect(MITM_TOOLS.antigravity.defaultModels.find((model) => model.id === id)).toMatchObject({ id, alias: id });
    expect(MITM_TOOLS.antigravity.defaultModels.find((model) => model.id === id)?.mandatory).toBeFalsy();
    expect(getCapabilitiesForModel("antigravity", id)).toMatchObject({ vision: true, reasoning: true, thinkingCanDisable: false });
    expect(getThinkingLevels("antigravity", id)).toEqual(["low", "medium", "high", "xhigh", "max"]);
  });

  it.each(["sonnet", "opus"])("routes %s 5.5 variants independently of the legacy 4.6 slot", (family) => {
    const id = `claude-${family}-5-5`;
    const legacy = family === "opus" ? "claude-opus-4-6-thinking" : "claude-sonnet-4-6";
    for (const variant of [id, `${id}-thinking`, `models/${id}-thinking`, `claude-${family}-5.5-thinking`]) {
      expect(resolveMitm(variant, { [id]: "ag/new-model", [legacy]: "ag/legacy-model" })).toBe("ag/new-model");
      expect(resolveMitm(variant, { [legacy]: "ag/legacy-model" })).toBeNull();
    }
    expect(resolveMitm(legacy, { [legacy]: "ag/legacy-model" })).toBe("ag/legacy-model");
  });

  it.each(["sonnet", "opus"])("keeps %s 5.5 in the upstream Cloud Code envelope", (family) => {
    const id = `claude-${family}-5-5`;
    const translated = openaiToAntigravityRequest(id, {
      messages: [{ role: "user", content: "Hello" }],
      tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object", properties: {} } } }],
    }, true, { projectId: "test-project" });
    const request = new AntigravityExecutor().transformRequest(id, translated, true, { projectId: "test-project" });
    expect(request).toMatchObject({ model: id, project: "test-project", userAgent: "antigravity", requestType: "agent" });
    expect(request.request.contents[0].parts).toContainEqual({ text: "Hello" });
    expect(request.request.tools[0].functionDeclarations[0].name).toBe("lookup");
  });

  it("normalizes thinking aliases into the new quota rows", async () => {
    const { getAntigravityUsage } = await import("../../open-sse/services/usage/google.js");
    const usage = await getAntigravityUsage("test-token", { projectId: "test-project" });
    for (const family of ["sonnet", "opus"]) {
      expect(usage.quotas[`claude-${family}-5-5`]).toMatchObject({ used: 400, total: 1000, remainingPercentage: 60 });
      expect(usage.quotas).not.toHaveProperty(`claude-${family}-5-5-thinking`);
    }
  });

  it("retains the 4.6 models during Google's transition period", () => {
    for (const id of ["claude-sonnet-4-6", "claude-opus-4-6-thinking"]) {
      expect(isValidModel("ag", id)).toBe(true);
    }
  });
});
