/**
 * Project ID Service - Fetch and cache real Project IDs from Google Cloud Code API
 *
 *
 * Instead of generating a new project ID for every request, this service fetches
 * the real Project ID bound to the authenticated user's account. Keeping that
 * account-bound context can reduce false-positive validation/abuse flags compared
 * with synthetic per-request identities. If lookup is unavailable, callers fail
 * fast and can retry after account onboarding completes.
 */

import {
    CLOUD_CODE_API,
    LOAD_CODE_ASSIST_HEADERS,
    ANTIGRAVITY_LOAD_CODE_ASSIST_HEADERS,
    LOAD_CODE_ASSIST_METADATA,
    GEMINI_CLI_API_CLIENT,
    geminiCLIUserAgent,
} from "../config/appConstants.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

// ─── Cache ────────────────────────────────────────────────────────────────────
// connectionId -> { projectId: string|null, fetchedAt: number }
const projectIdCache = new Map();

/** How long a cached project ID is considered fresh (1 hour). */
const CACHE_TTL_MS = 60 * 60 * 1000;
const FAILED_CACHE_TTL_MS = 5 * 60 * 1000;

// Compatibility fallback is deliberately narrow: retry only client/profile
// statuses, never auth, quota, or transient server failures.
const COMPATIBILITY_RESPONSE_STATUSES = new Set([400, 403, 404]);

const DISCOVERY_PROFILES = {
    "gemini-cli": [
        {
            name: "gemini-cli-native",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": geminiCLIUserAgent(),
                "X-Goog-Api-Client": GEMINI_CLI_API_CLIENT,
                "Client-Metadata": JSON.stringify(LOAD_CODE_ASSIST_METADATA),
            },
            buildBody: (metadata, extra = {}) => ({ metadata, mode: 1, ...extra }),
        },
        {
            name: "cloud-code-legacy",
            headers: LOAD_CODE_ASSIST_HEADERS,
            buildBody: (metadata, extra = {}) => ({ metadata, mode: 1, ...extra }),
        },
    ],
    antigravity: [
        {
            name: "antigravity-ide",
            headers: ANTIGRAVITY_LOAD_CODE_ASSIST_HEADERS,
            buildBody: (metadata, extra = {}) => ({ metadata, ...extra }),
        },
        {
            name: "cloud-code-legacy",
            headers: LOAD_CODE_ASSIST_HEADERS,
            buildBody: (metadata, extra = {}) => ({ metadata, ...extra }),
        },
    ],
};

// ─── Pending-fetch deduplication ─────────────────────────────────────────────
// connectionId -> { promise: Promise<string|null>, controller: AbortController, startedAt: number }
const pendingFetches = new Map();

/** Abort and evict a pending fetch that has been running longer than this (2 min). */
const PENDING_TTL_MS = 2 * 60 * 1000;

// ─── Periodic cleanup ────────────────────────────────────────────────────────
/** How often the background sweep runs (10 min). */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

let _cleanupTimer = null;

/** Run one sweep immediately: evict stale cache entries and abort orphaned pending fetches. */
export function cleanupNow() {
    const now = Date.now();

    for (const [id, entry] of projectIdCache) {
        if (!entry || now - entry.fetchedAt >= CACHE_TTL_MS) {
            projectIdCache.delete(id);
        }
    }

    for (const [id, item] of pendingFetches) {
        if (!item || typeof item.startedAt !== "number") {
            pendingFetches.delete(id);
            continue;
        }
        if (now - item.startedAt > PENDING_TTL_MS) {
            try { item.controller.abort(); } catch (_) { /* ignore */ }
            pendingFetches.delete(id);
        }
    }
}

/** Start the periodic background cleanup (idempotent). Called automatically on module load. */
export function startCacheCleanup() {
    if (_cleanupTimer) return;
    _cleanupTimer = setInterval(() => {
        try { cleanupNow(); } catch (e) {
            console.warn("[ProjectId] cleanup sweep error:", e?.message ?? e);
        }
    }, CLEANUP_INTERVAL_MS);
    // Unref so the timer doesn't prevent Node from exiting when it is otherwise idle
    _cleanupTimer?.unref?.();
}

/** Stop the periodic background cleanup (e.g. during graceful shutdown). */
export function stopCacheCleanup() {
    if (!_cleanupTimer) return;
    clearInterval(_cleanupTimer);
    _cleanupTimer = null;
}

// Start automatically when the module is first imported
startCacheCleanup();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the Project ID for a connection, with caching.
 * Returns null on failure so callers can surface an onboarding error.
 *
 * @param {string} connectionId - The connection identifier for cache keying
 * @param {string} accessToken  - Valid OAuth access token
 * @param {string} [provider]   - Provider key, controls endpoint + headers selection
 * @param {object} [options]    - Behavior options
 * @param {boolean} [options.allowOnboarding=true] - When false, skip the onboardUser
 *        polling fallback and return null if loadCodeAssist yields no project (fast
 *        request path; callers can fail fast and trigger background onboarding).
 * @param {number} [options.timeoutMs] - Abort the lookup after this many milliseconds.
 * @param {object} [options.proxyOptions] - Connection-scoped proxy routing options.
 * @returns {Promise<string|null>} Real project ID or null
 */
export async function getProjectIdForConnection(connectionId, accessToken, provider = "gemini-cli", options = {}) {
    if (!connectionId || !accessToken) return null;

    // Return cached value if still fresh
    const cached = projectIdCache.get(connectionId);
    const cacheTtl = cached?.projectId ? CACHE_TTL_MS : FAILED_CACHE_TTL_MS;
    if (cached && Date.now() - cached.fetchedAt < cacheTtl) {
        return cached.projectId;
    }

    // Deduplicate concurrent fetches for the same connection
    if (pendingFetches.has(connectionId)) {
        return pendingFetches.get(connectionId).promise;
    }

    // Each fetch gets its own AbortController so it can be canceled via removeConnection()
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.max(1, options.timeoutMs)
        : (options.allowOnboarding === false ? 8_000 : 60_000);
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const promise = (async () => {
        try {
            const projectId = await fetchProjectId(accessToken, controller.signal, provider, options);
            if (projectId) {
                projectIdCache.set(connectionId, {projectId, fetchedAt: Date.now()});
                return projectId;
            }
            console.warn("[ProjectId] could not fetch projectId for connection", connectionId.slice(0, 8));
            projectIdCache.set(connectionId, {projectId: null, fetchedAt: Date.now()});
            return null;
        } catch (error) {
            console.warn(`[ProjectId] Error fetching project ID: ${error.message}`);
            projectIdCache.set(connectionId, {projectId: null, fetchedAt: Date.now()});
            return null;
        } finally {
            clearTimeout(timeoutId);
            pendingFetches.delete(connectionId);
        }
    })();

    pendingFetches.set(connectionId, {promise, controller, startedAt: Date.now()});
    return promise;
}

/**
 * Force a real project lookup with onboarding enabled.
 * Used by first-request recovery and the manual connection action.
 */
export async function onboardProjectForConnection(connectionId, accessToken, provider = "gemini-cli", options = {}) {
    if (!connectionId || !accessToken) return null;
    invalidateProjectId(connectionId);
    return getProjectIdForConnection(connectionId, accessToken, provider, {
        ...options,
        allowOnboarding: true,
    });
}

/**
 * Warm a newly-created Google connection without blocking the OAuth response.
 * The caller owns persistence so this service stays independent from the DB.
 */
export async function warmProjectIdForConnection({ connection, proxyOptions = null, persist } = {}) {
    if (!connection?.id || !connection?.accessToken) return null;
    if (connection.projectId) return connection.projectId;
    if (connection.provider !== "antigravity" && connection.provider !== "gemini-cli") return null;

    const projectId = await onboardProjectForConnection(
        connection.id,
        connection.accessToken,
        connection.provider,
        { timeoutMs: 60_000, proxyOptions },
    );
    if (projectId && typeof persist === "function") await persist(projectId);
    return projectId;
}

/**
 * Return the official CLI recovery step when Cloud Code onboarding is refused.
 */
export function getManualOnboardingInstructions(provider = "antigravity") {
    if (provider !== "antigravity" && provider !== "gemini-cli") return null;
    return {
        command: provider === "antigravity" ? "agy login" : "gemini auth login",
        retryAction: "Run the command, then click Onboard again.",
    };
}

/**
 * Invalidate the cached project ID for a connection.
 * Call this when a connection's credentials are fully revoked or refreshed.
 */
export function invalidateProjectId(connectionId) {
    projectIdCache.delete(connectionId);
}

/**
 * Fully remove a connection: abort any in-flight fetch and delete its cached project ID.
 * Wire this into your connection close / disconnect lifecycle events to prevent memory leaks.
 *
 * @param {string} connectionId
 */
export function removeConnection(connectionId) {
    if (!connectionId) return;
    projectIdCache.delete(connectionId);
    const pending = pendingFetches.get(connectionId);
    if (pending) {
        try { pending.controller.abort(); } catch (_) { /* ignore */ }
        pendingFetches.delete(connectionId);
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Fetch project ID via loadCodeAssist endpoint.
 * Falls back to onboardUser when loadCodeAssist returns no project,
 * unless onboarding is disabled (fast request path).
 *
 * @param {string}      accessToken
 * @param {AbortSignal} signal
 * @param {string}      provider
 * @param {object}      [options]
 * @param {boolean}     [options.allowOnboarding=true] - false skips onboardUser polling
 * @returns {Promise<string|null>}
 */
async function fetchProjectId(accessToken, signal, provider, options = {}) {
    const endpoints = CLOUD_CODE_API[provider] || CLOUD_CODE_API["gemini-cli"];
    const profiles = DISCOVERY_PROFILES[provider] || DISCOVERY_PROFILES["gemini-cli"];
    let lastCompatibilityError = null;

    for (const profile of profiles) {
        const response = await projectFetch(endpoints.loadCodeAssist, {
            method: "POST",
            headers: { ...profile.headers, "Authorization": `Bearer ${accessToken}` },
            body: JSON.stringify(profile.buildBody(LOAD_CODE_ASSIST_METADATA)),
            signal
        }, options.proxyOptions);

        if (!response.ok) {
            const errorText = await response.text().catch(() => "");
            const message = `loadCodeAssist failed: HTTP ${response.status} ${errorText.slice(0, 200)}`;
            if (COMPATIBILITY_RESPONSE_STATUSES.has(response.status) && profile !== profiles[profiles.length - 1]) {
                lastCompatibilityError = message;
                console.warn(`[ProjectId] ${profile.name} rejected discovery profile; trying compatibility fallback`);
                continue;
            }
            throw new Error(lastCompatibilityError ? `${lastCompatibilityError}; ${message}` : message);
        }

        const data = await response.json();
        const projectId = extractProjectId(data);
        if (projectId) return projectId;

        if (options.allowOnboarding === false) {
            return null;
        }

        const onboardedProjectId = await onboardUser(
            accessToken,
            extractTierIds(data),
            signal,
            endpoints,
            provider,
            options.proxyOptions,
            profile,
        );
        if (onboardedProjectId) return onboardedProjectId;

        if (profile === profiles[profiles.length - 1]) return null;
        console.warn(`[ProjectId] ${profile.name} returned no project after onboarding; trying compatibility fallback`);
    }

    return null;
}

/**
 * Fetch project ID via onboardUser endpoint (polls until done).
 *
 * @param {string}      accessToken
 * @param {string}      tierID
 * @param {AbortSignal} externalSignal  – propagated from the connection's AbortController
 * @returns {Promise<string|null>}
 */
async function onboardUser(accessToken, tierIDs, externalSignal, endpoints, provider, proxyOptions = null, profile) {
    const tiers = Array.isArray(tierIDs) && tierIDs.length > 0 ? tierIDs : ["legacy-tier"];
    const MAX_ATTEMPTS = 5;

    for (const tierID of tiers) {
        console.log(`[ProjectId] Onboarding user with tier: ${tierID}`);

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            // Bail out immediately if the connection was removed
            if (externalSignal?.aborted) return null;

            // Per-attempt timeout controller; forwards external abort as well
            const localCtrl = new AbortController();
            const timeoutId = setTimeout(() => localCtrl.abort(), 30_000);
            const forwardAbort = () => localCtrl.abort();
            externalSignal?.addEventListener("abort", forwardAbort);

            try {
                const response = await projectFetch(endpoints.onboardUser, {
                    method: "POST",
                    headers: { ...profile.headers, "Authorization": `Bearer ${accessToken}` },
                    body: JSON.stringify(profile.buildBody(LOAD_CODE_ASSIST_METADATA, { tierId: tierID })),
                    signal: localCtrl.signal
                }, proxyOptions);

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text().catch(() => "");
                    if (COMPATIBILITY_RESPONSE_STATUSES.has(response.status)) {
                        console.warn(`[ProjectId] tier ${tierID} rejected: HTTP ${response.status}; trying next tier`);
                        break;
                    }
                    throw new Error(`onboardUser HTTP ${response.status}: ${errorText.slice(0, 200)}`);
                }

                const data = await response.json();

                if (data.done === true || data.done === "true") {
                    const projectId = extractProjectIdFromOnboard(data);
                    if (projectId) {
                        console.log(`[ProjectId] Successfully onboarded, project ID: ${projectId}`);
                        return projectId;
                    }
                    console.warn("[ProjectId] onboardUser completed without project_id; trying next tier");
                    break;
                }

                // Server not done yet – wait and retry
                console.log(`[ProjectId] Onboard attempt ${attempt}/${MAX_ATTEMPTS}: not done yet, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === "AbortError") {
                    console.warn(`[ProjectId] onboardUser attempt ${attempt} aborted (timeout or connection removed)`);
                    if (externalSignal?.aborted) return null;   // connection gone – stop retrying
                    continue;
                }
                if (attempt === MAX_ATTEMPTS) {
                    console.warn(`[ProjectId] onboardUser failed after ${MAX_ATTEMPTS} attempts: ${error.message}`);
                    break;
                }
                // Continue to next attempt instead of throwing (which would skip remaining retries)
                console.warn(`[ProjectId] onboardUser attempt ${attempt} failed: ${error.message}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            } finally {
                clearTimeout(timeoutId);
                externalSignal?.removeEventListener("abort", forwardAbort);
            }
        }
    }

    return null;
}

function projectFetch(url, init, proxyOptions = null) {
    const useProxy = proxyOptions?.connectionProxyEnabled === true ||
        Boolean(proxyOptions?.vercelRelayUrl) ||
        proxyOptions?.strictProxy === true;
    return useProxy ? proxyAwareFetch(url, init, proxyOptions) : fetch(url, init);
}

/**
 * Extract project ID from loadCodeAssist response.
 */
function extractProjectId(data) {
    if (!data) return null;

    const candidates = [
        data.cloudaicompanionProject,
        data.projectId,
        data.project,
        data.response?.cloudaicompanionProject,
        data.response?.projectId,
        data.response?.project,
        data.session?.projectId,
    ];

    for (const candidate of candidates) {
        const id = normalizeProjectId(candidate);
        if (id) return id;
    }

    return null;
}

/**
 * Extract project ID from onboardUser response.
 */
function extractProjectIdFromOnboard(data) {
    return extractProjectId(data);
}

function extractTierIds(data) {
    const tiers = [];
    const add = (value) => {
        const id = typeof value === "string" ? value.trim() : value?.id?.trim?.();
        if (id && !tiers.includes(id)) tiers.push(id);
    };

    const allowedTiers = Array.isArray(data?.allowedTiers) ? [...data.allowedTiers] : [];
    allowedTiers.sort((a, b) => Number(b?.isDefault === true) - Number(a?.isDefault === true));
    allowedTiers.forEach(add);
    add(data?.currentTier);
    add(data?.tierId);
    add(data?.response?.tierId);
    add("legacy-tier");
    return tiers;
}

function normalizeProjectId(value) {
    if (value && typeof value === "object") {
        return normalizeProjectId(value.id || value.projectId || value.project || value.name);
    }
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const resourceMatch = trimmed.match(/(?:^|\/)projects\/([^/]+)/);
    return resourceMatch ? resourceMatch[1] : trimmed;
}
