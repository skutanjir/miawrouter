/**
 * Google usage handlers (Gemini CLI + Antigravity)
 */

import { CLIENT_METADATA } from "../../config/appConstants.js";
import { ANTIGRAVITY_IDE_USER_AGENT, ANTIGRAVITY_IDE_VERSION, ANTIGRAVITY_OAUTH_CLIENT } from "../../providers/shared.js";
import antigravityProvider from "../../providers/registry/antigravity.js";
import { U, parseResetTime, normalizeCloudCodeProjectId, fetchWithTimeout } from "./shared.js";

// Antigravity API config (from Quotio) — urls from registry, oauth client + dynamic UA kept here
const ANTIGRAVITY_CONFIG = {
  ...U("antigravity"),
  ...ANTIGRAVITY_OAUTH_CLIENT,
  userAgent: ANTIGRAVITY_IDE_USER_AGENT,
  // Chat and the official IDE burn quota on daily-cloudcode-pa. Prod often
  // returns 200 with remainingFraction=1.0, so the tracker never moves.
  quotaApiUrls: [
    "https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
    "https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels",
  ],
  quotaSummaryUrls: [
    "https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
    "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary",
  ],
};

const ANTIGRAVITY_QUOTA_MODEL_KEYS = new Map(
  antigravityProvider.models.flatMap((model) =>
    [model.id, model.upstreamModelId, model.alias, ...(model.aliases || [])]
      .filter(Boolean)
      .map((key) => [key, model.id])
  )
);

function normalizeAntigravityQuotaModelKey(modelKey) {
  const key = modelKey.replace(/^models\//, "");
  return ANTIGRAVITY_QUOTA_MODEL_KEYS.get(key) || key;
}

function resolveAntigravityPlan(subscriptionInfo) {
  const currentTier = subscriptionInfo?.currentTier;
  const paidTier = subscriptionInfo?.paidTier;
  const defaultTier = Array.isArray(subscriptionInfo?.allowedTiers)
    ? subscriptionInfo.allowedTiers.find((tier) => tier?.isDefault)
    : null;
  const candidates = [
    paidTier?.id,
    currentTier?.id,
    subscriptionInfo?.subscriptionType,
    subscriptionInfo?.tier,
    defaultTier?.id,
    paidTier?.name,
    currentTier?.name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const tokens = new Set(candidate.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
    if (tokens.has("ULTRA")) return "Ultra";
    if (tokens.has("PRO") || tokens.has("PREMIUM") || (tokens.has("GOOGLE") && tokens.has("ONE")) || (tokens.has("ONE") && tokens.has("AI"))) return "Pro";
    if (tokens.has("ENTERPRISE")) return "Enterprise";
    if (tokens.has("BUSINESS") || tokens.has("STANDARD")) return "Business";
    if (tokens.has("PLUS")) return "Plus";
    if (tokens.has("LITE") || tokens.has("LIGHT")) return "Lite";
    if (tokens.has("FREE") || tokens.has("INDIVIDUAL") || tokens.has("LEGACY")) return "Free";
  }

  return "Unknown";
}

/**
 * Gemini CLI Usage — fetch per-model quota via Cloud Code Assist API.
 * Uses retrieveUserQuota (same endpoint as `gemini /stats`) returning
 * per-model buckets with remainingFraction + resetTime.
 */
export async function getGeminiUsage(accessToken, providerSpecificData, proxyOptions = null) {
  if (!accessToken) {
    return { message: "Gemini CLI access token not available." };
  }

  try {
    // Resolve project id: prefer connection-stored id, else loadCodeAssist lookup.
    // #1271: OAuth save stores projectId on the connection, not providerSpecificData.
    let projectId = normalizeCloudCodeProjectId(providerSpecificData?.projectId);
    let plan = "";

    if (!projectId) {
      const subInfo = await getGeminiSubscriptionInfo(accessToken, proxyOptions);
      if (subInfo) {
        projectId = normalizeCloudCodeProjectId(subInfo?.cloudaicompanionProject);
        plan = subInfo?.currentTier?.name || plan;
      }
    }

    if (!projectId) {
      return {
        plan,
        message: "Gemini CLI project ID not available. Reconnect Gemini CLI, or configure a Google Cloud project with Gemini Code Assist access before checking quota.",
      };
    }

    const response = await fetchWithTimeout(
      U("gemini-cli").quotaUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project: projectId }),
      },
      10000,
      proxyOptions
    );

    if (!response.ok) {
      return { plan, message: `Gemini CLI quota error (${response.status}).` };
    }

    const data = await response.json();
    const quotas = {};

    if (Array.isArray(data.buckets)) {
      for (const bucket of data.buckets) {
        if (!bucket.modelId || bucket.remainingFraction == null) continue;

        const remainingFraction = Number(bucket.remainingFraction) || 0;
        const total = 1000; // Normalized base, matches antigravity convention
        const remaining = Math.round(total * remainingFraction);
        const used = Math.max(0, total - remaining);

        quotas[bucket.modelId] = {
          used,
          total,
          resetAt: parseResetTime(bucket.resetTime),
          remainingPercentage: remainingFraction * 100,
          unlimited: false,
        };
      }
    }

    return { plan, quotas };
  } catch (error) {
    return { message: `Gemini CLI error: ${error.message}` };
  }
}

/**
 * Get Gemini CLI subscription info via loadCodeAssist
 */
async function getGeminiSubscriptionInfo(accessToken, proxyOptions = null) {
  try {
    const response = await fetchWithTimeout(
      U("gemini-cli").loadCodeAssistUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ metadata: CLIENT_METADATA }),
      },
      10000,
      proxyOptions
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Parse fraction remaining from bucket (0..1) across possible upstream shapes
 */
function extractRemainingFraction(bucket) {
  if (bucket == null || typeof bucket !== "object") return null;

  const candidates = [
    bucket.remainingFraction,
    bucket.remaining_fraction,
    bucket.remaining?.remainingFraction,
    bucket.remaining?.remaining_fraction,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, Math.min(1, candidate));
    }
  }

  if (bucket.remaining && typeof bucket.remaining === "object") {
    if (
      bucket.remaining.case === "remainingFraction" &&
      typeof bucket.remaining.value === "number" &&
      Number.isFinite(bucket.remaining.value)
    ) {
      return Math.max(0, Math.min(1, bucket.remaining.value));
    }
  }

  return null;
}

/**
 * Classify bucket and group into normalized quota key and metadata
 */
function classifyQuotaBucket(group, bucket) {
  const groupText = `${group?.displayName || ""} ${group?.name || ""} ${group?.id || ""}`.toLowerCase();
  const bucketText = `${bucket?.bucketId || ""} ${bucket?.window || ""} ${bucket?.kind || ""} ${bucket?.label || ""} ${bucket?.displayName || ""}`.toLowerCase();

  // Determine window: 5h vs weekly
  let isWeekly = false;
  if (bucketText.includes("week") || groupText.includes("week")) {
    isWeekly = true;
  }

  // Determine family: gemini vs claude/gpt (3p)
  let isGemini = false;
  if (bucketText.includes("gemini") || groupText.includes("gemini")) {
    isGemini = true;
  } else if (
    bucketText.includes("3p") ||
    bucketText.includes("claude") ||
    bucketText.includes("gpt") ||
    groupText.includes("claude") ||
    groupText.includes("gpt")
  ) {
    isGemini = false;
  } else {
    // Default fallback if ambiguous
    isGemini = false;
  }

  const quotaKey = isGemini
    ? (isWeekly ? "gemini_weekly" : "gemini_5h")
    : (isWeekly ? "claude_gpt_weekly" : "claude_gpt_5h");

  const displayName = isGemini
    ? (isWeekly ? "Gemini weekly" : "Gemini 5 hour")
    : (isWeekly ? "Claude weekly" : "Claude 5 hour");

  return {
    quotaKey,
    displayName,
    window: isWeekly ? "weekly" : "hourly",
    family: isGemini ? "gemini" : "claude",
    secondaryMetadata: {
      groupName: group?.displayName || group?.name || null,
      description: group?.description || bucket?.description || null,
    },
  };
}

/**
 * Fetch grouped quota summary via retrieveUserQuotaSummary with endpoint fallback.
 * Best-effort: failures never block or throw out of getAntigravityUsage.
 */
async function fetchAntigravityQuotaSummary(accessToken, projectId, proxyOptions = null) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": ANTIGRAVITY_CONFIG.userAgent,
    "Content-Type": "application/json",
    "X-Client-Name": "antigravity",
    "X-Client-Version": ANTIGRAVITY_IDE_VERSION,
  };

  const body = JSON.stringify(projectId ? { project: projectId } : {});

  for (const url of ANTIGRAVITY_CONFIG.quotaSummaryUrls) {
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body,
      }, 8000, proxyOptions);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      const groups = data?.groups || data?.response?.groups || data?.summary?.groups;
      if (!Array.isArray(groups) || groups.length === 0) {
        continue;
      }

      const summaryQuotas = {};

      for (const group of groups) {
        if (!group || !Array.isArray(group.buckets)) continue;
        for (const bucket of group.buckets) {
          const remainingFraction = extractRemainingFraction(bucket);
          if (remainingFraction === null) continue;

          const resetTime = bucket.resetTime || bucket.reset_time || bucket.resetAt;
          const { quotaKey, displayName, window, family, secondaryMetadata } = classifyQuotaBucket(group, bucket);

          const total = 1000;
          const remainingPercentage = remainingFraction * 100;
          const remaining = Math.round(total * remainingFraction);
          const used = total - remaining;

          summaryQuotas[quotaKey] = {
            used,
            total,
            resetAt: parseResetTime(resetTime),
            remainingPercentage,
            unlimited: false,
            displayName,
            window,
            family,
            secondaryMetadata,
            rawGroup: group.displayName || group.name || null,
          };
        }
      }

      if (Object.keys(summaryQuotas).length > 0) {
        return summaryQuotas;
      }
    } catch {
      // Continue to next endpoint fallback
    }
  }

  return null;
}

/**
 * Antigravity Usage - Fetch quota from Google Cloud Code API
 */
export async function getAntigravityUsage(accessToken, providerSpecificData, proxyOptions = null) {
  try {
    // Resolve project id: prefer connection-stored id, else loadCodeAssist lookup.
    let projectId = normalizeCloudCodeProjectId(providerSpecificData?.projectId);
    let subscriptionInfo = null;

    if (!projectId) {
      subscriptionInfo = await getAntigravitySubscriptionInfo(accessToken, proxyOptions);
      projectId = subscriptionInfo?.cloudaicompanionProject || null;
    } else {
      subscriptionInfo = await getAntigravitySubscriptionInfo(accessToken, proxyOptions);
    }

    const quotaHeaders = {
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": ANTIGRAVITY_CONFIG.userAgent,
      "Content-Type": "application/json",
      "X-Client-Name": "antigravity",
      "X-Client-Version": ANTIGRAVITY_IDE_VERSION,
    };
    const quotaBody = JSON.stringify(projectId ? { project: projectId } : {});

    let response = null;
    for (const url of ANTIGRAVITY_CONFIG.quotaApiUrls) {
      try {
        response = await fetchWithTimeout(url, {
          method: "POST",
          headers: quotaHeaders,
          body: quotaBody,
        }, 10000, proxyOptions);
        if (response.ok || response.status === 401 || response.status === 403) break;
      } catch {
        // try next host
      }
    }
    if (!response) {
      throw new Error("Antigravity API error: no quota host responded");
    }

    if (response.status === 403) {
      return {
        message: "Antigravity quota API access forbidden. Chat may still work.",
        quotas: {}
      };
    }

    if (response.status === 401) {
      return {
        message: "Antigravity quota API authentication expired. Chat may still work.",
        quotas: {}
      };
    }

    if (!response.ok) {
      throw new Error(`Antigravity API error: ${response.status}`);
    }

    const data = await response.json();
    const quotas = {};

    // Best effort: fetch grouped quota summary (5h and weekly windows)
    const summaryQuotas = await fetchAntigravityQuotaSummary(accessToken, projectId, proxyOptions);
    if (summaryQuotas) {
      Object.assign(quotas, summaryQuotas);
    }

    // Parse model quotas (inspired by vscode-antigravity-cockpit)
    const modelEntries = [];
    if (data.models) {
      for (const [modelKey, info] of Object.entries(data.models)) {
        // Skip models without quota info
        if (!info.quotaInfo) {
          continue;
        }

        // Internal discovery entries are not user-selectable.
        if (info.isInternal) {
          continue;
        }

        const normalizedModelKey = normalizeAntigravityQuotaModelKey(modelKey);

        const remainingFraction = extractRemainingFraction(info.quotaInfo);
        if (remainingFraction === null) continue;
        const remainingPercentage = remainingFraction * 100;

        // Convert percentage to used/total for UI compatibility
        const total = 1000; // Normalized base
        const remaining = Math.round(total * remainingFraction);
        const used = total - remaining;
        const resetTime = info.quotaInfo.resetTime || info.quotaInfo.reset_time || info.quotaInfo.resetAt;

        quotas[normalizedModelKey] = {
          used,
          total,
          resetAt: parseResetTime(resetTime),
          remainingPercentage,
          unlimited: false,
          displayName: info.displayName || normalizedModelKey,
        };

        modelEntries.push({
          modelKey: normalizedModelKey,
          remainingFraction,
        });
      }
    }

    // retrieveUserQuotaSummary 5h buckets often remain stale at 1.0 (100%) even when
    // active model usage has occurred. Per-model fetchAvailableModels is authoritative
    // for short-window usage. Replace the fake 100% bar with the most-consumed model
    // remaining so grouped UI still moves instead of hiding per-model rows.
    for (const [key, familyName] of [["gemini_5h", "gemini"], ["claude_gpt_5h", "claude"]]) {
      if (!quotas[key]) continue;
      const familyModels = modelEntries.filter(({ modelKey }) => {
        const lower = modelKey.toLowerCase();
        if (familyName === "gemini") return lower.includes("gemini");
        return lower.includes("claude") || lower.includes("gpt");
      });
      if (familyModels.length === 0) continue;
      const minFraction = Math.min(...familyModels.map((m) => m.remainingFraction));
      if (minFraction < 0.999 && quotas[key].remainingPercentage >= 99.9) {
        const total = 1000;
        const remaining = Math.round(total * minFraction);
        quotas[key] = {
          ...quotas[key],
          used: total - remaining,
          total,
          remainingPercentage: minFraction * 100,
        };
      }
    }

    return {
      plan: resolveAntigravityPlan(subscriptionInfo),
      quotas,
      subscriptionInfo,
    };
  } catch (error) {
    console.error("[Antigravity Usage] Error:", error.message, error.cause);
    return { message: `Antigravity error: ${error.message}` };
  }
}

/**
 * Get Antigravity subscription info
 */
async function getAntigravitySubscriptionInfo(accessToken, proxyOptions = null) {
  try {
    const response = await fetchWithTimeout(ANTIGRAVITY_CONFIG.loadProjectApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "User-Agent": ANTIGRAVITY_CONFIG.userAgent,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ metadata: CLIENT_METADATA, mode: 1 }),
    }, 10000, proxyOptions);

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("[Antigravity Subscription] Error:", error.message);
    return null;
  }
}
