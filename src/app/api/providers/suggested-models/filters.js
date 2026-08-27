// Fixed upstream URL per fetcher, derived from the provider registries themselves.
// The route ignores any client-supplied URL and fetches only URLs registered here,
// so /api/providers/suggested-models cannot be used as an authenticated SSRF proxy.
//
// Sources:
//  - open-sse/providers/registry/* `modelsFetcher` entries (provider id → url/type).
//    Entries without an explicit `type` default to the generic OpenAI-compatible
//    response shape (`{ data: [{ id }] }`, bare arrays and `{ models: [...] }` too).
//  - Named special filters below keep their curated shaping (free-only cuts etc.).
import REGISTRY from "open-sse/providers/registry/index.js";
import { OPENCODE_MODELS_URL, classifyModelFree } from "@/lib/catalog/opencodeCatalog";

export const FILTER_URLS = {
  "openrouter-free": "https://openrouter.ai/api/v1/models",
  "opencode-free": OPENCODE_MODELS_URL,
  "mimo-free": "https://models.dev/api.json",
};

export const FILTERS = {
  "openrouter-free": (models) =>
    models
      .filter(
        (m) =>
          m.pricing?.prompt === "0" &&
          m.pricing?.completion === "0" &&
          m.context_length >= 200000
      )
      .map((m) => ({ id: m.id, name: m.name, contextLength: m.context_length }))
      .sort((a, b) => b.contextLength - a.contextLength),

  // Shared classifier: documented free id, -free suffix, explicit zero pricing, or settings override
  // (no hardcoded rotating list — the free set changes upstream).
  "opencode-free": (models) =>
    models
      .filter((m) => classifyModelFree(m))
      .map((m) => ({ id: m.id, name: m.id })),

  // models.dev returns a large catalog; keep only mimo models
  "mimo-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.id?.startsWith("mimo") || m.name?.toLowerCase().includes("mimo"))
      .map((m) => ({ id: m.id, name: m.name || m.id })),

  // Generic OpenAI-compatible /v1/models shape — works for any provider whose
  // registry declares a modelsFetcher without a specialized filter type. Also
  // tolerates id-less entries keyed by `name` (e.g. Pollinations).
  openai: (models) =>
    (Array.isArray(models) ? models : [])
      .map((m) => {
        const id = typeof m?.id === "string" && m.id ? m.id : typeof m?.name === "string" ? m.name : null;
        if (!id) return null;
        return {
          id,
          name: (typeof m.name === "string" && m.name) || (typeof m.display_name === "string" && m.display_name) || id,
          ...(Number.isFinite(m.context_length) ? { contextLength: m.context_length } : {}),
          ...(Number.isFinite(m.context_window) ? { contextLength: m.context_window } : {}),
          ...(Number.isFinite(m.max_model_len) ? { contextLength: m.max_model_len } : {}),
        };
      })
      .filter(Boolean),
};

// Registry-derived allowlist: providerId → { url, type }. Built once per server
// process; a provider id param is resolved here before anything is fetched.
export const PROVIDER_FETCHERS = [];
const seenProviders = new Set();

for (const entry of REGISTRY) {
  const fetcher = entry.modelsFetcher;
  if (fetcher && typeof fetcher.url === "string" && fetcher.url.startsWith("https://")) {
    const type = typeof fetcher.type === "string" && FILTERS[fetcher.type] ? fetcher.type : "openai";
    if (!FILTER_URLS[type]) FILTER_URLS[type] = fetcher.url;
    PROVIDER_FETCHERS.push({ providerId: entry.id, url: fetcher.url, type });
    seenProviders.add(entry.id);
  } else if (entry.transport?.validateUrl && typeof entry.transport.validateUrl === "string" && entry.transport.validateUrl.startsWith("https://") && !seenProviders.has(entry.id)) {
    // Automatically enable upstream model resolution for any provider with a validateUrl models endpoint
    const url = entry.transport.validateUrl;
    PROVIDER_FETCHERS.push({ providerId: entry.id, url, type: "openai" });
    seenProviders.add(entry.id);
  }
}

export function findProviderFetcher(providerId) {
  return PROVIDER_FETCHERS.find((f) => f.providerId === providerId) || null;
}

// Normalize any known upstream response envelope into a plain model array.
export function extractModels(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.models)) return json.models;
  if (json && typeof json === "object") {
    // models.dev-style catalogs: { "provider-id": { "model-id": {...} } }
    const first = Object.values(json)[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      return Object.entries(first).map(([id, m]) => ({ id, ...m }));
    }
  }
  return [];
}
