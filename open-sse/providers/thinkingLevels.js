// Resolve valid thinking levels per model — drives UI level picker (suffix "model(level)").
// Reuses capabilities.js (thinkingFormat/canDisable) so this file only maps format→levels (DRY).
import { getCapabilitiesForModel } from "./capabilities.js";
import { matchPattern } from "./pricing.js";
import { resolveKiroEffortPath } from "../config/kiroConstants.js";

// Shared level sets (deduped) — verified against provider docs + wire in thinkingUnified.applyFormat.
const L = {
  base: ["none", "low", "medium", "high"],                          // qwen, step, hunyuan, gemini-budget
  onOff: ["none", "thinking"],                                      // zai (binary), minimax (adaptive)
  openai: ["none", "minimal", "low", "medium", "high", "xhigh"],    // GPT-5.x / o-series (no "max")
  levelMax: ["none", "low", "medium", "high", "max"],               // kimi; Claude 4.6 without xhigh
  claudeAdaptive: ["none", "low", "medium", "high", "xhigh", "max"], // Opus 5 / Fable 5.1 / Sonnet 5
  budgetX: ["none", "low", "medium", "high", "xhigh", "max"],       // claude-budget (not Haiku)
  gemini: ["minimal", "low", "medium", "high"],                     // gemini-3 thinkingLevel (no disable)
  hiMax: ["none", "high", "max"],                                   // deepseek (low/med→high, xhigh→max)
  grok45: ["low", "medium", "high"],                                // grok-4.5: cannot disable; xhigh→high
  grok46: ["low", "medium", "high", "xhigh"],                       // grok-4.6+: cannot disable
  grok43: ["none", "low", "medium", "high", "xhigh"],               // grok-4.3 can disable
};

const FORMAT_LEVELS = {
  openai: L.openai,
  "claude-adaptive": L.claudeAdaptive,
  "claude-budget": L.budgetX,
  "gemini-level": L.gemini,
  "gemini-budget": L.base,
  zai: L.onOff,
  qwen: L.base,
  kimi: L.levelMax,
  deepseek: L.hiMax,
  minimax: L.onOff,
  hunyuan: L.base,
  step: L.base,
};

// Verified 2026-09-30: API efforts differ from ChatGPT/Codex presets.
// https://developers.openai.com/api/docs/models/gpt-6.1-sol
// https://learn.chatgpt.com/docs/models
const API_GPT_6_LEVELS = ["none", "low", "medium", "high", "xhigh", "max"];
const CODEX_GPT_5_6_LEVELS = ["low", "medium", "high", "xhigh", "max"];
const CODEX_GPT_6_ASTRA_LEVELS = [...CODEX_GPT_5_6_LEVELS, "ultra"];

const PATTERN_THINKING = [
  { provider: "codex", pattern: "*gpt-6.1-sol*", levels: CODEX_GPT_6_ASTRA_LEVELS },
  { provider: "codex", pattern: "*gpt-6-astra*", levels: CODEX_GPT_6_ASTRA_LEVELS },
  { provider: "codex", pattern: "*gpt-6-sol*", levels: [...CODEX_GPT_5_6_LEVELS, "ultra"] },
  { provider: "codex", pattern: "*gpt-6-luna*", levels: CODEX_GPT_5_6_LEVELS },
  { provider: "codex", pattern: "*gpt-5.6-sol*", levels: [...CODEX_GPT_5_6_LEVELS, "ultra"] },
  { provider: "codex", pattern: "*gpt-5.6-terra*", levels: [...CODEX_GPT_5_6_LEVELS, "ultra"] },
  { provider: "codex", pattern: "*gpt-5.6-luna*", levels: CODEX_GPT_5_6_LEVELS },
  { pattern: "*gpt-6.1-sol*", levels: API_GPT_6_LEVELS.filter((level) => level !== "none") },
  { pattern: "*gpt-6-astra*", levels: API_GPT_6_LEVELS.filter((level) => level !== "none") },
  { pattern: "*gpt-6*", levels: API_GPT_6_LEVELS },
  { provider: "kiro", pattern: "*gpt-5.6*", levels: API_GPT_6_LEVELS },
  { pattern: "*gpt-5.6*", levels: API_GPT_6_LEVELS },
  { pattern: "*gpt-5.5-pro*", levels: ["medium", "high", "xhigh"] },
  { pattern: "*gpt-5.4-pro*", levels: ["medium", "high", "xhigh"] },
  { pattern: "*gpt-5.5*", levels: ["none", "low", "medium", "high", "xhigh"] },
  { pattern: "*gpt-5.4*", levels: ["none", "low", "medium", "high", "xhigh"] },
  { pattern: "*codex*", levels: ["low", "medium", "high", "xhigh"] },
  { pattern: "*gpt-5.2*", levels: ["none", "low", "medium", "high", "xhigh"] },
  { pattern: "*gpt-5.1*", levels: L.base },
  { pattern: "*gpt-5*", levels: ["minimal", "low", "medium", "high"] },
  { pattern: "*o1*", levels: ["low", "medium", "high"] },
  { pattern: "*o3*", levels: ["low", "medium", "high"] },
  { pattern: "*o4*", levels: ["low", "medium", "high"] },
  { pattern: "*claude*haiku*", levels: null },
  { pattern: "*claude*opus-4.5*", levels: L.base },
  { pattern: "*claude*opus-4-5*", levels: L.base },
  { pattern: "*claude*opus-4.6*", levels: L.levelMax },
  { pattern: "*claude*opus-4-6*", levels: L.levelMax },
  { pattern: "*claude*sonnet-4.6*", levels: L.levelMax },
  { pattern: "*claude*sonnet-4-6*", levels: L.levelMax },
  { pattern: "*grok-4.7*", levels: L.grok46 },
  { pattern: "*grok-4.6*", levels: L.grok46 },
  { pattern: "*grok-4.5*", levels: L.grok45 },
  { pattern: "*grok-4.3*", levels: L.grok43 },
  { pattern: "*grok-4.20-multi-agent*", levels: L.grok46 },
];

// Returns valid thinking levels for a model, or null when the model has no reasoning.
export function getThinkingLevels(provider, model, metadata) {
  const declared = metadata?.reasoningLevels || metadata?.supported_reasoning_levels || metadata?.supportedReasoningLevels;
  if (Array.isArray(declared)) {
    const valid = [...new Set(declared.map((level) => typeof level === "string" ? level : level?.effort).filter((level) => ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra", "thinking"].includes(level)))];
    if (valid.length) return valid;
  }
  if (provider === "kiro" && resolveKiroEffortPath(model) === null) return null;
  const caps = getCapabilitiesForModel(provider, model);
  if (!caps.reasoning) return null;
  const hit = PATTERN_THINKING.find((entry) =>
    (!entry.provider || entry.provider === provider) && matchPattern(entry.pattern, model)
  );
  if (hit && hit.levels === null) return null;
  let levels = hit?.levels || FORMAT_LEVELS[caps.thinkingFormat] || L.base;
  if (caps.thinkingCanDisable === false) levels = levels.filter((l) => l !== "none");
  return levels;
}

// Translate unsupported client levels to the closest supported effort. "auto"
// means omit effort and let the upstream use its model-specific default.
export function normalizeThinkingLevel(level, supportedLevels) {
  if (!level || level === "auto") return null;
  if (!supportedLevels?.length || supportedLevels.includes(level)) return level;
  if (level === "minimal" && supportedLevels.includes("low")) return "low";
  const order = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
  const index = order.indexOf(level);
  if (index < 0) return null;
  return [...supportedLevels].reverse().find((candidate) => order.indexOf(candidate) >= 0 && order.indexOf(candidate) <= index)
    || supportedLevels[0];
}
