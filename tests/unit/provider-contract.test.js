import { describe, it, expect, vi, afterEach } from "vitest";
import { runProviderContract } from "../helpers/providerContract.js";
import REGISTRY from "../../open-sse/providers/registry/index.js";
import { getCapabilitiesForModel } from "../../open-sse/providers/capabilities.js";

/**
 * Derives provider capabilities dynamically from registry definitions and capabilities table.
 * If features or configurations exist, map them cleanly.
 */
function deriveProviderCapabilities(id) {
  const entry = REGISTRY.find((p) => p.id === id);
  if (!entry) {
    throw new Error(`Provider ${id} not found in registry`);
  }

  // Determine a default test model
  const firstModel = entry.models?.[0]?.id || "default";
  const modelCaps = getCapabilitiesForModel(id, firstModel);

  // Check features, transport flags, serviceKinds
  const serviceKinds = new Set(entry.serviceKinds || ["llm"]);
  const features = entry.features || {};
  const transport = entry.transport || {};

  const hasTools = modelCaps.tools !== false && !serviceKinds.has("embedding") && !serviceKinds.has("tts");
  const hasReasoning = Boolean(modelCaps.reasoning || entry.models?.some((m) => m.supportsReasoning) || transport.thinkingFormat || transport.reasoningInject);
  const hasVision = Boolean(modelCaps.vision || entry.models?.some((m) => m.supportsVision) || serviceKinds.has("imageToText"));
  const hasUsage = Boolean(features.usage || features.usageApikey || id === "deepseek" || id === "openrouter" || id === "groq");
  const hasCacheUsage = Boolean(id === "deepseek" || id === "openrouter");
  const forceStream = Boolean(transport.forceStream);

  return {
    testModel: firstModel,
    streaming: true,
    nonStreaming: !forceStream,
    tools: hasTools,
    reasoning: hasReasoning,
    usage: hasUsage,
    cacheUsage: hasCacheUsage,
    vision: hasVision,
  };
}

describe("Provider Contract Test Suite", () => {
  // 1. llm7 (OpenAI-compatible apikey provider, standard LLM capabilities)
  const llm7Caps = deriveProviderCapabilities("llm7");
  runProviderContract({
    id: "llm7",
    capabilities: {
      ...llm7Caps,
      usage: false, // llm7 registry does not declare usage feature flag
      cacheUsage: false, // llm7 does not expose cached prompt token tracking
    },
  });

  // 2. openrouter (OpenAI-compatible with tools, reasoning, usage, cacheUsage, vision)
  const openrouterCaps = deriveProviderCapabilities("openrouter");
  runProviderContract({
    id: "openrouter",
    capabilities: {
      ...openrouterCaps,
      testModel: "anthropic/claude-3.7-sonnet",
      tools: true,
      reasoning: true,
      usage: true,
      cacheUsage: true,
      vision: true,
    },
  });

  // 3. groq (OpenAI-compatible ultra-fast provider, tools: true, reasoning: false, vision: true via imageToText, usage: true)
  const groqCaps = deriveProviderCapabilities("groq");
  runProviderContract({
    id: "groq",
    capabilities: {
      ...groqCaps,
      testModel: "llama-3.3-70b-versatile",
      tools: true,
      reasoning: false, // groq default Llama models do not emit reasoning_content
      usage: true,
      cacheUsage: false, // groq standard api does not expose cached token details
      vision: true,
    },
  });

  // 4. deepseek (Native multi-endpoint provider with usage, cacheUsage, reasoning)
  const deepseekCaps = deriveProviderCapabilities("deepseek");
  runProviderContract({
    id: "deepseek",
    capabilities: {
      ...deepseekCaps,
      testModel: "deepseek-flash",
      tools: true,
      reasoning: true,
      usage: true,
      cacheUsage: true,
      vision: true,
    },
  });

  // 5. commandcode (CommandCode executor with forceStream NDJSON translation, reasoning, tools)
  const commandcodeCaps = deriveProviderCapabilities("commandcode");
  runProviderContract({
    id: "commandcode",
    capabilities: {
      ...commandcodeCaps,
      testModel: "gpt-5.6-sol",
      nonStreaming: false, // forceStream: true in transport
      tools: true,
      reasoning: true,
      usage: false, // commandcode NDJSON usage is step-based
      cacheUsage: false,
      vision: true,
    },
  });
});
