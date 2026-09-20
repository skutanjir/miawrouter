import { describe, expect, it } from "vitest";
import grokWeb from "../../open-sse/providers/registry/grok-web.js";
import {
  GROK_WEB_MODEL_MAP,
  resolveGrokWebModel,
} from "../../open-sse/executors/grok-web.js";
import { getThinkingLevels } from "../../open-sse/providers/thinkingLevels.js";
import { getModelUpstreamId } from "../../open-sse/config/providerModels.js";
import { applyThinking, stripThinkingSuffix } from "../../open-sse/translator/concerns/thinkingUnified.js";
import xai from "../../open-sse/providers/registry/xai.js";
import openai from "../../open-sse/providers/registry/openai.js";
import codex from "../../open-sse/providers/registry/codex.js";

describe("grok-web model modes", () => {
  it("maps every registry model to a grok.com mode", () => {
    const missing = grokWeb.models
      .map((model) => model.id)
      .filter((id) => !GROK_WEB_MODEL_MAP[id]);
    expect(missing).toEqual([]);
  });

  it("routes 4.5 / 4.6 / 4.3 instead of falling back to 4.1 Fast", () => {
    expect(resolveGrokWebModel("grok-4.6")).toMatchObject({
      grokModel: "grok-4-6",
      modelMode: "MODEL_MODE_GROK_4_6",
      isThinking: true,
    });
    expect(resolveGrokWebModel("grok-4.6-fast")).toMatchObject({
      grokModel: "grok-4-6",
      modelMode: "MODEL_MODE_FAST",
      isThinking: false,
    });
    expect(resolveGrokWebModel("grok-4.5-thinking")).toMatchObject({
      grokModel: "grok-4-5",
      modelMode: "MODEL_MODE_GROK_4_5_THINKING",
      isThinking: true,
    });
    expect(resolveGrokWebModel("grok-4.3")).toMatchObject({
      grokModel: "grok-4-3",
      modelMode: "MODEL_MODE_GROK_4_3",
    });
    expect(resolveGrokWebModel("unknown-grok")).toEqual(GROK_WEB_MODEL_MAP["grok-4.6"]);
  });
});

describe("xAI Grok effort catalog", () => {
  it("exposes 4.6 xhigh and 4.5 without xhigh", () => {
    expect(getThinkingLevels("xai", "grok-4.6")).toEqual(["low", "medium", "high", "xhigh"]);
    expect(getThinkingLevels("grok-cli", "grok-4.5")).toEqual(["low", "medium", "high"]);
    expect(getThinkingLevels("xai", "grok-4.3")).toEqual(["none", "low", "medium", "high", "xhigh"]);
  });

  it("maps dash effort ids to paren suffixes for applyThinking", () => {
    expect(getModelUpstreamId("xai", "grok-4.6-xhigh")).toBe("grok-4.6(xhigh)");
    expect(getModelUpstreamId("xai", "grok-4.5-low")).toBe("grok-4.5(low)");
    expect(getModelUpstreamId("xai", "grok-4.3-medium")).toBe("grok-4.3(medium)");
    expect(stripThinkingSuffix(getModelUpstreamId("xai", "grok-4.6-xhigh"))).toBe("grok-4.6");

    const body = {};
    applyThinking("openai", getModelUpstreamId("xai", "grok-4.6-xhigh"), body, "xai");
    expect(body.reasoning_effort).toBe("xhigh");
  });

  it("lists current imagine models", () => {
    const ids = xai.models.map((model) => model.id);
    expect(ids).toEqual(expect.arrayContaining([
      "grok-imagine-image-2.0",
      "grok-imagine-video-1.5",
      "grok-4.6-xhigh",
      "grok-4.20-reasoning",
    ]));
  });
});

describe("OpenAI / Codex thinkingConfig", () => {
  it("lists current OpenAI and Codex effort options", () => {
    expect(openai.thinkingConfig.options).toEqual([
      "auto", "none", "minimal", "low", "medium", "high", "xhigh", "max",
    ]);
    expect(codex.thinkingConfig.options).toEqual([
      "auto", "none", "low", "medium", "high", "xhigh", "max", "ultra",
    ]);
  });
});
