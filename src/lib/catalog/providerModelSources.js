import REGISTRY from "../../../open-sse/providers/registry/index.js";

export const MODEL_FETCH_TIMEOUT_MS = 12000;

export function buildRegistryModelSources(registry = REGISTRY) {
  return registry.flatMap((entry) => {
    if (entry.modelsFetcher === false) return [];
    const declared = entry.modelsFetcher;
    const validationUrl = entry.transport?.validateUrl;
    // Account/balance validation URLs do not return models.
    const fallbackUrl = typeof validationUrl === "string" && /\/(?:models|tags)\/?(?:\?|$)/.test(validationUrl) ? validationUrl : null;
    const url = declared?.url || fallbackUrl;
    if (typeof url !== "string" || !url.startsWith("https://")) return [];
    const auth = entry.transport?.auth?.apiKey || entry.transport?.auth || {};
    const raw = auth.scheme === "raw" || entry.transport?.format === "claude" || entry.transport?.format === "gemini";
    return [{
      ...declared, providerId: entry.id, url,
      type: declared?.type || "openai",
      headers: { ...entry.transport?.headers, ...declared?.headers },
      authHeader: declared?.authHeader || auth.header || (entry.transport?.format === "claude" ? "x-api-key" : entry.transport?.format === "gemini" ? "x-goog-api-key" : "Authorization"),
      authPrefix: declared?.authPrefix ?? (raw ? "" : "Bearer "),
    }];
  });
}

export const REGISTRY_MODEL_SOURCES = buildRegistryModelSources();
export const findRegistryModelSource = (id) => REGISTRY_MODEL_SOURCES.find((source) => source.providerId === id) || null;

export function parseRegistryModels(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data || payload?.models || payload?.results;
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.flatMap((row) => {
    const id = typeof row === "string" ? row : row?.id || row?.model || row?.name;
    if (typeof id !== "string" || !id) return [];
    const normalizedId = id.replace(/^models\//, "");
    const key = `${normalizedId}|${row?.kind || "llm"}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...(typeof row === "object" ? row : {}), id: normalizedId, name: row?.displayName || row?.display_name || row?.name || normalizedId }];
  });
}

export async function fetchRegistryModels(source, connection = {}, { fetchImpl = fetch } = {}) {
  const token = connection.authType === "oauth" ? connection.accessToken : connection.apiKey || connection.accessToken;
  const response = await fetchImpl(source.url, {
    method: "GET", redirect: "error", signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS),
    headers: { Accept: "application/json", ...source.headers, ...(token ? { [source.authHeader]: `${source.authPrefix}${token}` } : {}) },
  });
  if (!response.ok) return { models: [], status: response.status, authRequired: [401, 403].includes(response.status), warning: `Upstream model catalog returned HTTP ${response.status}.` };
  const payload = await response.json();
  const models = source.type === "mimo-free"
    ? Object.values(payload || {}).flatMap((provider) => Object.entries(provider?.models || {}).map(([id, model]) => ({ ...model, id, name: model.name || id }))).filter((model) => model.id.startsWith("mimo") || model.name.toLowerCase().includes("mimo"))
    : parseRegistryModels(payload);
  return { models, source: "live", fetchedAt: new Date().toISOString(), ...(models.length ? {} : { warning: "The upstream response did not contain a recognized model list." }) };
}
