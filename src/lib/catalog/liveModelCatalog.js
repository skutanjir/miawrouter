import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { getProviderAlias } from "@/shared/constants/providers";
import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";

const EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"];
const MODEL_KINDS = new Set(["llm", "image", "embedding", "tts", "stt", "imageToText", "webSearch", "webFetch"]);
const EFFORT_SUFFIX = new RegExp(`-(${EFFORT_LEVELS.join("|")})$`, "i");
const CODEX_DEFAULT_CLIENT_VERSION = "0.153.4";
const CODEX_CACHE_DEFAULTS = {
  shell_type: "bash",
  visibility: "public",
  supported_in_api: true,
  priority: 1,
  additional_speed_tiers: [],
  service_tiers: [],
  availability_nux: null,
  upgrade: null,
  model_messages: null,
  include_skills_usage_instructions: true,
  include_plugin_usage_instructions: true,
  include_apps_usage_instructions: true,
  default_reasoning_summary: "none",
  support_verbosity: true,
  default_verbosity: "low",
  apply_patch_tool_type: "freeform",
  web_search_tool_type: "text_and_image",
  truncation_policy: { mode: "tokens", limit: 10000 },
  supports_image_detail_original: true,
  context_window: 1048576,
  max_context_window: 1048576,
  comp_hash: "3000",
  effective_context_window_percent: 95,
  experimental_supported_tools: ["send_user_message_async", "clock"],
  input_modalities: ["text", "image"],
  supports_search_tool: true,
  use_responses_lite: true,
  node_repl_auto_review_required: true,
  node_repl_disabled: false,
  tool_mode: "code_mode_only",
  multi_agent_version: "v2",
  multi_agent_reasoning_effort: "medium",
};

function modelKind(model) {
  const candidate = model?.kind || model?.type;
  return MODEL_KINDS.has(candidate) ? candidate : "llm";
}

function stripProviderPrefix(id, provider, alias) {
  for (const prefix of new Set([provider, alias])) {
    if (prefix && id.startsWith(`${prefix}/`)) return id.slice(prefix.length + 1);
  }
  return id;
}

function toEffort(value) {
  const effort = typeof value === "string" ? value : value?.effort;
  const normalized = String(effort || "").trim().toLowerCase();
  return EFFORT_LEVELS.includes(normalized) ? normalized : null;
}

function declaredReasoningLevels(model) {
  const raw = model?.supported_reasoning_levels || model?.supportedReasoningLevels;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(toEffort).filter(Boolean))];
}

function reasoningLevels(provider, id, model) {
  const declared = declaredReasoningLevels(model);
  if (declared.length) return declared;
  if (modelKind(model) !== "llm") return [];
  return getThinkingLevels(provider, id) || [];
}

function levelName(level) {
  return level === "xhigh" ? "xHigh" : level[0].toUpperCase() + level.slice(1);
}

function cacheLevels(levels) {
  return levels.map((effort) => ({ effort, description: `Reasoning effort: ${effort}` }));
}

export function normalizeLiveModels(connection, models) {
  const provider = String(connection?.provider || "");
  const providerAlias = getProviderAlias(provider);
  const rows = new Map();

  for (const model of Array.isArray(models) ? models : []) {
    const rawId = model?.id || model?.slug || model?.model || model?.name;
    if (!rawId) continue;
    const id = stripProviderPrefix(String(rawId), provider, providerAlias);
    if (!id) continue;
    const type = modelKind(model);
    const levels = reasoningLevels(provider, id, model);
    const base = {
      ...model,
      id,
      providerAlias,
      type,
      name: model?.name || model?.display_name || model?.displayName || id,
      source: "live",
      ...(levels.length ? { reasoningLevels: levels } : {}),
    };
    rows.set(`${id}|${type}`, base);

    if (provider !== "codex" || type !== "llm" || id.endsWith("-review") || EFFORT_SUFFIX.test(id)) continue;
    for (const effort of levels) {
      rows.set(`${id}-${effort}|${type}`, {
        ...base,
        id: `${id}-${effort}`,
        name: `${base.name} (${levelName(effort)})`,
        upstreamModelId: model?.upstreamModelId || id,
        effortPreset: effort,
      });
    }
  }

  return [...rows.values()];
}

function cacheRecordFromModel(model) {
  const slug = model.slug || `${model.providerAlias}/${model.id}`;
  const levels = (model.reasoningLevels || model.supportedReasoningLevels || [])
    .map(toEffort)
    .filter(Boolean);
  const contextWindow = Number(model.contextLength || model.contextWindow || model.context_window) || undefined;
  return {
    ...CODEX_CACHE_DEFAULTS,
    slug,
    display_name: model.name || model.displayName || model.id || slug,
    description: model.description || `Model ${slug} via MiawRouter`,
    default_reasoning_level: levels.includes("medium") ? "medium" : (levels[0] || "medium"),
    supported_reasoning_levels: cacheLevels(levels),
    ...(contextWindow ? { context_window: contextWindow, max_context_window: contextWindow } : {}),
  };
}

export function mergeCodexModelsCache(cache, models) {
  const next = cache && typeof cache === "object" ? { ...cache } : {};
  const entries = Array.isArray(next.models) ? [...next.models] : [];
  const bySlug = new Map(entries.map((entry, index) => [entry?.slug || entry?.id || `__entry_${index}`, entry]));

  for (const model of Array.isArray(models) ? models : []) {
    if (!model?.id || model.effortPreset || model.type === "image" || model.id.endsWith("-review")) continue;
    const generated = cacheRecordFromModel(model);
    const existing = bySlug.get(generated.slug);
    bySlug.set(generated.slug, existing ? { ...generated, ...existing, supported_reasoning_levels: generated.supported_reasoning_levels } : generated);
  }

  next.models = [...bySlug.values()];
  return next;
}

let cacheWriteQueue = Promise.resolve();

export function writeCodexModelsCache(models, { codexDir = path.join(os.homedir(), ".codex") } = {}) {
  const run = async () => {
    const cachePath = path.join(codexDir, "models_cache.json");
    let cache = { fetched_at: new Date().toISOString(), client_version: CODEX_DEFAULT_CLIENT_VERSION, models: [] };
    try {
      cache = JSON.parse(await fs.readFile(cachePath, "utf8"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    const merged = mergeCodexModelsCache(cache, models);
    merged.fetched_at = new Date().toISOString();
    if (!merged.client_version) merged.client_version = CODEX_DEFAULT_CLIENT_VERSION;
    await fs.mkdir(codexDir, { recursive: true });
    const tmpPath = `${cachePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(merged, null, 2));
    await fs.rename(tmpPath, cachePath);
    return merged;
  };
  cacheWriteQueue = cacheWriteQueue.then(run, run);
  return cacheWriteQueue;
}

export async function syncConnectionModelCatalog(connection, dependencies = {}) {
  if (!connection || connection.isActive === false) return { synced: 0, skipped: true };
  const resolve = dependencies.resolve || (async (conn) => {
    const { resolveProviderConnectionModels } = await import("@/app/api/providers/[id]/models/route.js");
    return resolveProviderConnectionModels(conn);
  });
  const upsert = dependencies.upsert || (async (models) => {
    const { upsertCustomModels } = await import("@/lib/db/repos/aliasRepo.js");
    return upsertCustomModels(models);
  });
  const writeCache = dependencies.writeCache || writeCodexModelsCache;

  try {
    let timer;
    try {
      const resultPromise = Promise.resolve(resolve(connection));
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("model catalog timeout")), dependencies.timeoutMs || 30_000);
      });
      const result = await Promise.race([resultPromise, timeoutPromise]);
      if (!result || result.error || !Array.isArray(result.models) || result.models.length === 0) {
        return { synced: 0, skipped: true, error: result?.error };
      }
      const rows = normalizeLiveModels(connection, result.models);
      if (!rows.length) return { synced: 0, skipped: true };
      await upsert(rows);
      if (connection.provider === "codex") {
        await writeCache(rows.filter((row) => !row.effortPreset && row.type === "llm"));
      }
      return { synced: rows.length };
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (error) {
    return { synced: 0, failed: true, error: error?.message || String(error) };
  }
}

export { EFFORT_LEVELS };
