/**
 * Pure utilities and validation logic for Cat Router CacheWire component.
 */

export const MAX_COUNT = 999999;
export const STORAGE_KEY = "miawrouter.cacheWire.v3";
export const ACT_MS = 1200;

export const KIND_META = {
  hit: { glyph: "●", word: "hit", cls: "text-signal" },
  activity: { glyph: "›", word: "activity", cls: "text-warn" },
  dedup: { glyph: "◆", word: "dedup", cls: "text-ink" },
};

export const LAYERS = [
  {
    id: "L0",
    name: "L0 Prompt",
    role: "Provider prompt cache",
    title: "L0 prompt-cache orchestration — breakpoints and provider cache_read usage",
    streamingScope: "Streaming & non-streaming",
  },
  {
    id: "L1",
    name: "L1 Exact",
    role: "Exact response cache",
    title: "L1 exact-match response cache (non-streaming requests only)",
    streamingScope: "Non-streaming only",
  },
  {
    id: "L2",
    name: "L2 Semantic",
    role: "Semantic response cache",
    title: "L2 semantic response cache via embedding similarity (non-streaming requests only)",
    streamingScope: "Non-streaming only",
  },
  {
    id: "L3",
    name: "L3 Dedup",
    role: "Content-address dedup",
    title: "L3 content-address dedup — activity and savings, not a provider cache hit",
    streamingScope: "Pre-dispatch body dedup",
  },
];

export const fmt = (n) => (n >= MAX_COUNT ? `${MAX_COUNT}+` : String(n));

export const fmtBytes = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "0 B";
  if (num >= 1048576) return `${(num / 1048576).toFixed(1)} MB`;
  if (num >= 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${Math.round(num)} B`;
};

export function timeOf(ts) {
  const ms = Number(ts);
  const d = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

const LOCAL_MODEL_RE =
  /^(ollama|llama\.cpp|vllm|whisper|koka|local|localhost|127\.\d|10\.\d|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i;

export function isLocalEmbeddingModel(model) {
  if (!model || typeof model !== "string") return false;
  return LOCAL_MODEL_RE.test(model);
}

/**
 * Computes effective cache layer enablement accounting for privacyMode postures.
 * - strict / private-no-cache / local-only: disables L1, L2, L3 regardless of toggles
 * - private-cache: enables L1/L3 if toggled; disables L2 if embedding model is not local
 * - normal: raw toggle settings apply
 */
export function computeEffectiveCacheLayers(settings, { error = false } = {}) {
  if (error) {
    return {
      L0: null,
      L1: null,
      L2: null,
      L3: null,
      privacyMode: null,
      loaded: false,
      error: true,
    };
  }

  if (!settings || typeof settings !== "object") {
    return {
      L0: null,
      L1: null,
      L2: null,
      L3: null,
      privacyMode: null,
      loaded: false,
      error: false,
    };
  }

  const mode = settings.privacyMode || "normal";
  const rawL1 = settings.cacheL1Enabled !== false;
  const rawL2 = settings.cacheL2Enabled === true;
  const rawL3 = settings.cacheL3Enabled === true;

  if (mode === "strict" || mode === "private-no-cache" || mode === "local-only") {
    return {
      L0: true,
      L1: false,
      L2: false,
      L3: false,
      privacyMode: mode,
      loaded: true,
      error: false,
    };
  }

  if (mode === "private-cache") {
    const l2Local = isLocalEmbeddingModel(settings.semanticCacheModel);
    return {
      L0: true,
      L1: rawL1,
      L2: rawL2 && l2Local,
      L3: rawL3,
      privacyMode: mode,
      loaded: true,
      error: false,
    };
  }

  return {
    L0: true,
    L1: rawL1,
    L2: rawL2,
    L3: rawL3,
    privacyMode: mode,
    loaded: true,
    error: false,
  };
}

export function createInitialState() {
  return {
    hits: { L0: 0, L1: 0, L2: 0 },
    misses: { L0: 0, L1: 0, L2: 0 },
    lookups: { L0: 0, L1: 0, L2: 0 },
    events: 0,
    savings: { refs: 0, bytes: 0 },
    interlock: { restored: 0, stable: 0, breakpoints: null },
    latest: "",
  };
}

export function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const num = (v, max, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : fallback;
  };
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const hits = obj(raw.hits);
  const misses = obj(raw.misses);
  const lookups = obj(raw.lookups);
  const savings = obj(raw.savings);
  const interlock = obj(raw.interlock);

  // Require v3 structure: if raw lacks misses or lookups objects, it's stale shape from v2
  if (!raw.misses || !raw.lookups) return null;

  return {
    hits: {
      L0: num(hits.L0, MAX_COUNT),
      L1: num(hits.L1, MAX_COUNT),
      L2: num(hits.L2, MAX_COUNT),
    },
    misses: {
      L0: num(misses.L0, MAX_COUNT),
      L1: num(misses.L1, MAX_COUNT),
      L2: num(misses.L2, MAX_COUNT),
    },
    lookups: {
      L0: num(lookups.L0, MAX_COUNT),
      L1: num(lookups.L1, MAX_COUNT),
      L2: num(lookups.L2, MAX_COUNT),
    },
    events: num(raw.events, MAX_COUNT),
    savings: {
      refs: num(savings.refs, MAX_COUNT),
      bytes: num(savings.bytes, Number.MAX_SAFE_INTEGER),
    },
    interlock: {
      restored: num(interlock.restored, MAX_COUNT),
      stable: num(interlock.stable, MAX_COUNT),
      breakpoints:
        interlock.breakpoints === null || interlock.breakpoints === undefined
          ? null
          : num(interlock.breakpoints, MAX_COUNT, null),
    },
    latest: typeof raw.latest === "string" ? raw.latest.slice(0, 300) : "",
  };
}

export function loadState(customStorageKey = STORAGE_KEY) {
  if (typeof window === "undefined" || !window.sessionStorage) return null;
  try {
    const raw = sessionStorage.getItem(customStorageKey);
    if (!raw) return null;
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Determine layer status badge, hit status, lookups/misses, hit rate, and notices.
 * Accurately distinguishes:
 * - disabled in settings
 * - config loading
 * - config error / fetch failure
 * - privacy restricted
 * - non-streaming-only limitation
 * - active with truthful hits / lookups / hit-rate
 * - unavailable where real data cannot distinguish
 */
export function getLayerStatus(layerId, state, config) {
  // If config is explicitly null/undefined (still loading)
  if (config === null || config === undefined) {
    return {
      enabled: false,
      statusLabel: "Loading…",
      badgeText: "loading",
      badgeKind: "neutral",
      hasHits: false,
      hitRate: null,
      subDetail: null,
      notice: null,
      reason: "loading settings",
    };
  }

  if (config.error) {
    return {
      enabled: false,
      statusLabel: "Error",
      badgeText: "error",
      badgeKind: "off",
      hasHits: false,
      hitRate: null,
      subDetail: null,
      notice: "Failed to load layer settings",
      reason: "config fetch error",
    };
  }

  const isEnabled = !!config[layerId];
  const privacyMode = config.privacyMode;
  let reason = null;

  if (!isEnabled) {
    if (privacyMode && privacyMode !== "normal") {
      reason = `privacy: ${privacyMode}`;
    } else {
      reason = "disabled in settings";
    }
  }

  if (layerId === "L0") {
    // L0 prompt cache is provider-driven; always enabled if provider supports it
    const hits = state?.hits?.L0 || 0;
    const misses = state?.misses?.L0 || 0;
    const lookups = state?.lookups?.L0 || 0;
    // Denominator is valid when lookups > 0 or (hits + misses) > 0
    const totalKnown = lookups > 0 ? lookups : hits + misses;
    const hitRate = totalKnown > 0 ? Math.round((hits / totalKnown) * 100) : null;
    const hasHits = hits > 0;

    let statusLabel = hasHits ? `${fmt(hits)} hits` : "No hits yet";
    let badgeText = hasHits ? `${fmt(hits)} hits` : "idle";
    let badgeKind = hasHits ? "signal" : "neutral";

    if (totalKnown > 0) {
      statusLabel = misses > 0 ? `${fmt(hits)} hits · ${fmt(misses)} misses` : `${fmt(hits)} hits`;
      badgeText = hitRate !== null ? `${hitRate}% hit` : `${fmt(hits)} hits`;
      badgeKind = hasHits ? "signal" : "neutral";
    }

    return {
      enabled: true,
      statusLabel,
      badgeText,
      badgeKind,
      hasHits,
      hitRate,
      subDetail: totalKnown > 0 ? `${fmt(hits)}/${fmt(totalKnown)} hits` : null,
      notice: "Provider prompt cache",
      reason: null,
    };
  }

  if (layerId === "L1") {
    if (!isEnabled) {
      return {
        enabled: false,
        statusLabel: "Disabled",
        badgeText: "disabled",
        badgeKind: "off",
        hasHits: false,
        hitRate: null,
        subDetail: null,
        notice: "Non-streaming only",
        reason,
      };
    }

    const hits = state?.hits?.L1 || 0;
    const misses = state?.misses?.L1 || 0;
    const lookups = state?.lookups?.L1 || 0;
    const totalKnown = lookups > 0 ? lookups : hits + misses;
    const hitRate = totalKnown > 0 ? Math.round((hits / totalKnown) * 100) : null;
    const hasHits = hits > 0;

    let statusLabel = hasHits ? `${fmt(hits)} hits` : "No hits yet";
    let badgeText = hasHits ? `${fmt(hits)} hits` : "active";
    let badgeKind = hasHits ? "signal" : "neutral";

    if (totalKnown > 0) {
      statusLabel = misses > 0 ? `${fmt(hits)} hits · ${fmt(misses)} misses` : `${fmt(hits)} hits`;
      badgeText = hitRate !== null ? `${hitRate}% hit` : `${fmt(hits)} hits`;
      badgeKind = hasHits ? "signal" : "neutral";
    }

    return {
      enabled: true,
      statusLabel,
      badgeText,
      badgeKind,
      hasHits,
      hitRate,
      subDetail: totalKnown > 0 ? `${fmt(hits)}/${fmt(totalKnown)} hits` : null,
      notice: "Non-streaming only",
      reason: null,
    };
  }

  if (layerId === "L2") {
    if (!isEnabled) {
      return {
        enabled: false,
        statusLabel: "Disabled",
        badgeText: "disabled",
        badgeKind: "off",
        hasHits: false,
        hitRate: null,
        subDetail: null,
        notice: "Non-streaming only",
        reason,
      };
    }

    const hits = state?.hits?.L2 || 0;
    const misses = state?.misses?.L2 || 0;
    const lookups = state?.lookups?.L2 || 0;
    const totalKnown = lookups > 0 ? lookups : hits + misses;
    const hitRate = totalKnown > 0 ? Math.round((hits / totalKnown) * 100) : null;
    const hasHits = hits > 0;

    let statusLabel = hasHits ? `${fmt(hits)} hits` : "No hits yet";
    let badgeText = hasHits ? `${fmt(hits)} hits` : "active";
    let badgeKind = hasHits ? "signal" : "neutral";

    if (totalKnown > 0) {
      statusLabel = misses > 0 ? `${fmt(hits)} hits · ${fmt(misses)} misses` : `${fmt(hits)} hits`;
      badgeText = hitRate !== null ? `${hitRate}% hit` : `${fmt(hits)} hits`;
      badgeKind = hasHits ? "signal" : "neutral";
    }

    return {
      enabled: true,
      statusLabel,
      badgeText,
      badgeKind,
      hasHits,
      hitRate,
      subDetail: totalKnown > 0 ? `${fmt(hits)}/${fmt(totalKnown)} hits` : null,
      notice: "Non-streaming only",
      reason: null,
    };
  }

  if (layerId === "L3") {
    if (!isEnabled) {
      return {
        enabled: false,
        statusLabel: "Disabled",
        badgeText: "disabled",
        badgeKind: "off",
        hasHits: false,
        hitRate: null,
        subDetail: null,
        notice: null,
        reason,
      };
    }

    const refs = state?.savings?.refs || 0;
    const bytes = state?.savings?.bytes || 0;
    const hasHits = refs > 0;

    return {
      enabled: true,
      statusLabel: refs > 0 ? `${fmt(refs)} refs` : "No dedup yet",
      badgeText: refs > 0 ? `${fmt(refs)} refs` : "active",
      badgeKind: hasHits ? "neutral" : "neutral",
      hasHits,
      hitRate: null, // L3 dedup does not have hits/misses or a hit rate
      subDetail: bytes > 0 ? `${fmtBytes(bytes)} saved` : null,
      notice: "Body dedup (no hit rate)",
      reason: null,
    };
  }

  return {
    enabled: true,
    statusLabel: "—",
    badgeText: "—",
    badgeKind: "neutral",
    hasHits: false,
    hitRate: null,
    subDetail: null,
    notice: null,
    reason: null,
  };
}

/**
 * Validates and safely parses an incoming raw telemetry cache event from SSE.
 * Clamps refs & bytesSaved >= 0 before accumulation.
 * Validates finite similarity.
 */
export function parseCacheWireEvent(ev) {
  if (!ev || typeof ev !== "object" || Array.isArray(ev)) return null;

  let layer = null;
  let kind = null;
  let label = null;
  let outcome = null; // "hit" | "miss" | "probe" | "dedup" | null

  if (ev.type === "cache_probe" || ev.type === "cache_usage") layer = "L0";
  else if (ev.type === "cache_l1") layer = "L1";
  else if (ev.type === "cache_l2") layer = "L2";
  else if (ev.type === "cache_l3") layer = "L3";

  // Validate finite similarity
  const rawSim = Number(ev.similarity);
  const validSim = Number.isFinite(rawSim) && rawSim >= 0 && rawSim <= 1 ? rawSim : null;

  // Validate and clamp refs & bytesSaved >= 0
  const rawRefs = Number(ev.refs);
  const refs = Number.isFinite(rawRefs) && rawRefs >= 0 ? Math.floor(rawRefs) : 0;

  const rawBytes = Number(ev.bytesSaved);
  const bytesSaved = Number.isFinite(rawBytes) && rawBytes >= 0 ? Math.floor(rawBytes) : 0;

  if (layer) {
    if (ev.type === "cache_probe") {
      kind = "activity";
      label = "L0 probe";
      outcome = "probe";
    } else if (ev.type === "cache_usage") {
      const readVal = Number(ev.cacheRead);
      const isHit = Number.isFinite(readVal) && readVal > 0;
      kind = isHit ? "hit" : "activity";
      label = `${layer} ${isHit ? "hit" : "miss"}`;
      outcome = isHit ? "hit" : "miss";
    } else if (ev.type === "cache_l3") {
      kind = "dedup";
      label = "L3 dedup";
      outcome = "dedup";
    } else if (ev.action === "hit") {
      kind = "hit";
      label =
        ev.type === "cache_l2" && validSim !== null
          ? `L2 hit · ${(validSim * 100).toFixed(1)}%`
          : `${layer} hit`;
      outcome = "hit";
    } else if (ev.action === "miss") {
      kind = "activity";
      label = `${layer} miss`;
      outcome = "miss";
    } else {
      kind = "activity";
      label = `${layer} ${ev.action ?? "activity"}`;
      outcome = null;
    }
  }

  return {
    layer,
    kind,
    label,
    outcome,
    validSim,
    refs,
    bytesSaved,
  };
}
