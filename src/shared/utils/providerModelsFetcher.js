// Fetch and cache suggested models for providers that expose a public models API
// Fetches via backend proxy to avoid CORS issues. The backend resolves the fixed
// upstream URL from the provider registry (SSRF-safe); the `url`/`type` params are
// only used to match legacy filter types.

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const cache = new Map(); // key: providerId|fetcher.url → { data, expiresAt }

/**
 * Fetch suggested models for a provider using its modelsFetcher config.
 * Results are cached in-memory for CACHE_TTL_MS.
 * @param {{ url: string, type?: string }} fetcher
 * @param {string} [providerId] registry id — lets the backend resolve the allowlisted URL
 * @returns {Promise<Array<{ id: string, name: string, contextLength?: number }>>}
 */
export async function fetchSuggestedModels(fetcher, providerId) {
  if (!fetcher?.url) return [];

  const cacheKey = `${providerId || ""}|${fetcher.url}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  try {
    const params = new URLSearchParams({ url: fetcher.url });
    if (providerId) params.set("provider", providerId);
    if (fetcher.type) params.set("type", fetcher.type);
    const res = await fetch(`/api/providers/suggested-models?${params}`);
    if (!res.ok) return [];
    const json = await res.json();
    const data = json.data ?? [];
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  } catch {
    return [];
  }
}
