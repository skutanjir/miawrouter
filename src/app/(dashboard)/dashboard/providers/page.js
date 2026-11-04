"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  CardSkeleton,
  Badge,
  Toggle,
} from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import {
  FREE_PROVIDERS,
  FREE_TIER_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  OPENAI_COMPATIBLE_PREFIX,
  ANTHROPIC_COMPATIBLE_PREFIX,
  getProvidersByKind,
} from "@/shared/constants/providers";
import { getModelsByProviderId } from "@/shared/constants/models";
import Link from "next/link";
import { getErrorCode, getRelativeTime } from "@/shared/utils";
import { useNotificationStore } from "@/store/notificationStore";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import ModelAvailabilityBadge from "./components/ModelAvailabilityBadge";
import AddCompatibleModal from "./components/AddCompatibleModal";

import { Icon } from "@/shared/components/Icon";
function getStatusDisplay(connected, error, errorCode) {
  const parts = [];
  if (connected > 0) {
    parts.push(
      <Badge key="connected" variant="success" size="sm" dot>
        {connected} Connected
      </Badge>,
    );
  }
  if (error > 0) {
    const errText = errorCode
      ? `${error} Error (${errorCode})`
      : `${error} Error`;
    parts.push(
      <Badge key="error" variant="error" size="sm" dot>
        {errText}
      </Badge>,
    );
  }
  if (parts.length === 0) {
    return <span className="text-text-muted text-xs">No connections</span>;
  }
  return parts;
}

function getConnectionErrorTag(connection) {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "RUNTIME";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  )
    return "AUTH";
  if (explicitType === "upstream_rate_limited") return "429";
  if (explicitType === "upstream_unavailable") return "5XX";
  if (explicitType === "network_error") return "NET";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400)
    return String(numericCode);

  const fromMessage = getErrorCode(connection.lastError);
  if (fromMessage === "401" || fromMessage === "403") return "AUTH";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (
    msg.includes("runtime") ||
    msg.includes("not runnable") ||
    msg.includes("not installed")
  )
    return "RUNTIME";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "AUTH";

  return "ERR";
}

function SectionControlStrip({
  title,
  count,
  collapsible,
  collapsed,
  onToggleCollapse,
  children,
}) {
  return (
    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between py-1.5 border-b border-border/80">
      <div className="flex items-center gap-2.5 min-w-0">
        {collapsible && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            className="-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main cursor-pointer"
          >
            <Icon name={collapsed ? "chevron_right" : "expand_more"} className=" text-[18px]" />
          </button>
        )}
        <h2 className="text-xs sm:text-sm font-semibold tracking-tight text-text-main truncate">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[11px] font-medium text-text-muted px-2 py-0.5 rounded-full bg-surface-2 border border-border-subtle shrink-0 tabular-nums">
            {count}
          </span>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {children}
        </div>
      )}
    </div>
  );
}

SectionControlStrip.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  collapsible: PropTypes.bool,
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  children: PropTypes.node,
};

const FREE_INITIAL_VISIBLE = 12;

// getProviderStats memo, keyed by the `connections` snapshot. Sort comparators and
// every card call it (~1500x/render); without this each call rescans `connections`.
const statsCache = new WeakMap();

const APIKEY_INITIAL_VISIBLE = 20;

export default function ProvidersPage() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [connections, setConnections] = useState([]);
  const [providerNodes, setProviderNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllApikey, setShowAllApikey] = useState(false);
  const [showAllFree, setShowAllFree] = useState(false);
  const [freeCollapsed, setFreeCollapsed] = useState(() => {
    try {
      return globalThis.localStorage?.getItem("providers:free-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [showAddCompatibleModal, setShowAddCompatibleModal] = useState(false);
  const [showAddAnthropicCompatibleModal, setShowAddAnthropicCompatibleModal] =
    useState(false);
  const [testingMode, setTestingMode] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const notify = useNotificationStore();
  const searchQuery = useHeaderSearchStore((s) => s.query);
  const registerSearch = useHeaderSearchStore((s) => s.register);
  const unregisterSearch = useHeaderSearchStore((s) => s.unregister);

  useEffect(() => {
    registerSearch("Search providers...");
    return () => unregisterSearch();
  }, [registerSearch, unregisterSearch]);

  const toggleFreeCollapsed = () => {
    setFreeCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("providers:free-collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const matchSearch = (name) =>
    !searchQuery.trim() ||
    name.toLowerCase().includes(searchQuery.trim().toLowerCase());

  const sortByPriority = (entries, authType) =>
    [...entries].sort(([ka, a], [kb, b]) => {
      const sa = getProviderStats(ka, authType);
      const sb = getProviderStats(kb, authType);
      const ca = sa.connected > 0 ? 1 : 0;
      const cb = sb.connected > 0 ? 1 : 0;
      if (ca !== cb) return cb - ca;
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;
      return (a.name || "").localeCompare(b.name || "");
    });

  useEffect(() => {
    let cancelled = false;

    const fetchConnections = async () => {
      try {
        const connectionsRes = await fetch("/api/providers");
        const connectionsData = await connectionsRes.json();
        if (!cancelled && connectionsRes.ok) {
          setConnections(connectionsData.connections || []);
        }
      } catch (error) {
        console.log("Error fetching providers:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Custom OpenAI/Anthropic nodes are secondary — defer past first paint
    const fetchNodes = async () => {
      try {
        const nodesRes = await fetch("/api/provider-nodes");
        const nodesData = await nodesRes.json();
        if (!cancelled && nodesRes.ok) {
          setProviderNodes(nodesData.nodes || []);
        }
      } catch (error) {
        console.log("Error fetching provider-nodes:", error);
      }
    };

    fetchConnections();

    let idleId;
    let timeoutId;
    const scheduleNodes = () => {
      if (cancelled) return;
      fetchNodes();
    };
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(scheduleNodes, { timeout: 3000 });
    } else {
      timeoutId = setTimeout(scheduleNodes, 500);
    }

    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);

  // Per-render memo: getProviderStats is called from sort comparators plus every
  // card (~1500x/render) and each call otherwise rescans `connections`. Cache on
  // the connections snapshot so a render costs one scan, rebuilt when state changes.
  const getProviderStats = (providerId, authType) => {
    const authTypes = Array.isArray(authType) ? authType : [authType];
    const key = `${providerId}\u0000${authTypes.join("\u0000")}`;
    let cache = statsCache.get(connections);
    if (!cache) {
      cache = new Map();
      statsCache.set(connections, cache);
    }
    const hit = cache.get(key);
    if (hit) return hit;

    const providerConnections = connections.filter(
      (c) => c.provider === providerId && authTypes.includes(c.authType),
    );

    const getEffectiveStatus = (conn) => {
      const isCooldown = Object.entries(conn).some(
        ([k, v]) =>
          k.startsWith("modelLock_") && v && new Date(v).getTime() > Date.now(),
      );
      return conn.testStatus === "unavailable" && !isCooldown
        ? "active"
        : conn.testStatus;
    };

    const connected = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "active" || status === "success";
    }).length;

    const errorConns = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return (
        status === "error" || status === "expired" || status === "unavailable"
      );
    });

    const error = errorConns.length;
    const total = providerConnections.length;
    const allDisabled =
      total > 0 && providerConnections.every((c) => c.isActive === false);

    const latestError = errorConns.sort(
      (a, b) => new Date(b.lastErrorAt || 0) - new Date(a.lastErrorAt || 0),
    )[0];
    const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
    const errorTime = latestError?.lastErrorAt
      ? getRelativeTime(latestError.lastErrorAt)
      : null;

    const result = { connected, error, total, errorCode, errorTime, allDisabled };
    cache.set(key, result);
    return result;
  };

  // Toggle all connections for a provider on/off. authType may be a single
  // string or an array (kiro counts oauth + api_key/apikey together).
  const handleToggleProvider = async (providerId, authType, newActive) => {
    const authTypes = Array.isArray(authType) ? authType : [authType];
    const matches = (c) =>
      c.provider === providerId && authTypes.includes(c.authType);
    const providerConns = connections.filter(matches);
    setConnections((prev) =>
      prev.map((c) => (matches(c) ? { ...c, isActive: newActive } : c)),
    );
    await Promise.allSettled(
      providerConns.map((c) =>
        fetch(`/api/providers/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newActive }),
        }),
      ),
    );
  };

  const handleBatchTest = async (mode, providerId = null) => {
    if (testingMode) return;
    setTestingMode(mode === "provider" ? providerId : mode);
    setTestResults(null);
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, providerId }),
      });
      const data = await res.json();
      setTestResults(data);
      if (data.summary) {
        const { passed, failed, total } = data.summary;
        if (failed === 0) notify.success(`All ${total} tests passed`);
        else notify.warning(`${passed}/${total} passed, ${failed} failed`);
      }
    } catch (error) {
      setTestResults({ error: "Test request failed" });
      notify.error("Provider test failed");
    } finally {
      setTestingMode(null);
    }
  };

  const compatibleProviders = providerNodes
    .filter((node) => node.type === "openai-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || "OpenAI Compatible",
      color: "#10A37F",
    }))
    .filter((p) => matchSearch(p.name))
    .sort((a, b) => {
      const ca = getProviderStats(a.id, "apikey").connected > 0 ? 0 : 1;
      const cb = getProviderStats(b.id, "apikey").connected > 0 ? 0 : 1;
      return ca - cb || a.name.localeCompare(b.name);
    });

  const anthropicCompatibleProviders = providerNodes
    .filter((node) => node.type === "anthropic-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || "Anthropic Compatible",
      color: "#D97757",
      textIcon: "AC",
    }))
    .filter((p) => matchSearch(p.name))
    .sort((a, b) => {
      const ca = getProviderStats(a.id, "apikey").connected > 0 ? 0 : 1;
      const cb = getProviderStats(b.id, "apikey").connected > 0 ? 0 : 1;
      return ca - cb || a.name.localeCompare(b.name);
    });
  const dualAuthTypes = (info, key) => {
    if (key === "kiro") return ["oauth", "apikey", "api_key"];
    const modes = info?.authModes;
    // Free-tier and API-key providers default to supporting apikey even when the
    // registry entry omits authModes (e.g. cloudflare-ai, byteplus, ollama,
    // vertex) — otherwise their apikey connections are invisible on the grid card.
    if (!Array.isArray(modes)) {
      return key in FREE_TIER_PROVIDERS || key in APIKEY_PROVIDERS
        ? ["oauth", "apikey", "api_key"]
        : "oauth";
    }
    if (!modes.includes("apikey")) return "oauth";
    return ["oauth", "apikey", "api_key"];
  };

  const oauthEntries = sortByPriority(
    Object.entries(OAUTH_PROVIDERS).filter(([, info]) => !info.hidden && matchSearch(info.name)),
    "oauth",
  );
  const freeEntries = Object.entries(FREE_PROVIDERS)
    .filter(([, info]) => !info.hidden && matchSearch(info.name))
    .sort(([ka, a], [kb, b]) => {
      const ca = getProviderStats(ka, dualAuthTypes(a, ka)).connected > 0 ? 0 : 1;
      const cb = getProviderStats(kb, dualAuthTypes(b, kb)).connected > 0 ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const noAuthDiff = (b.noAuth ? 1 : 0) - (a.noAuth ? 1 : 0);
      if (noAuthDiff !== 0) return noAuthDiff;
      return (a.name || "").localeCompare(b.name || "");
    });

  // Free Tier cards may be oauth-only (e.g. kimchi) or dual-auth, so count via
  // dualAuthTypes per provider instead of a fixed "apikey" — otherwise oauth
  // connections are invisible here (mismatch with the detail page).
  const freeTierEntries = Object.entries(FREE_TIER_PROVIDERS)
    .filter(
      ([, info]) =>
        !info.hidden &&
        !info.disabled &&
        info.available !== false &&
        matchSearch(info.name) &&
        (info.serviceKinds ?? ["llm"]).includes("llm"),
    )
    .sort(([ka, a], [kb, b]) => {
      const ca = getProviderStats(ka, dualAuthTypes(a, ka)).connected > 0 ? 0 : 1;
      const cb = getProviderStats(kb, dualAuthTypes(b, kb)).connected > 0 ? 0 : 1;
      if (ca !== cb) return ca - cb;
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      if (pa !== pb) return pa - pb;
      const noAuthDiff = (b.noAuth ? 1 : 0) - (a.noAuth ? 1 : 0);
      if (noAuthDiff !== 0) return noAuthDiff;
      return (a.name || "").localeCompare(b.name || "");
    });
  // API Key: connected providers first, then alphabetical by name
  const apikeyEntries = Object.entries(APIKEY_PROVIDERS)
    .filter(
      ([, info]) =>
        !info.hidden &&
        (info.serviceKinds ?? ["llm"]).includes("llm") &&
        matchSearch(info.name),
    )
    .sort(([ka, a], [kb, b]) => {
      const ca = getProviderStats(ka, "apikey").connected > 0 ? 0 : 1;
      const cb = getProviderStats(kb, "apikey").connected > 0 ? 0 : 1;
      if (ca !== cb) return ca - cb;
      return (a.name || "").localeCompare(b.name || "");
    });
  const webCookieEntries = sortByPriority(
    Object.entries(WEB_COOKIE_PROVIDERS).filter(
      ([, info]) => !info.hidden && matchSearch(info.name),
    ),
  );
  const webCookieAuthTypes = (providerId) =>
    providerId === "kimi-web" ? ["cookie", "apikey", "api_key"] : "cookie";
  const mediaProviders = ["embedding", "image", "imageToText", "tts", "stt", "video", "music"]
    .flatMap((kind) => getProvidersByKind(kind).map((provider) => ({ ...provider, kind })))
    .filter((provider, index, list) => list.findIndex((entry) => entry.id === provider.id) === index)
    .filter((provider) => matchSearch(provider.name))
    .sort((a, b) => {
      const ca = getProviderStats(a.id, ["apikey", "api_key", "oauth", "cookie"]).connected > 0 ? 0 : 1;
      const cb = getProviderStats(b.id, ["apikey", "api_key", "oauth", "cookie"]).connected > 0 ? 0 : 1;
      return ca - cb || a.name.localeCompare(b.name);
    });
  const webProviders = ["webSearch", "webFetch"]
    .flatMap((kind) => getProvidersByKind(kind).map((provider) => ({ ...provider, kind })))
    .filter((provider, index, list) => list.findIndex((entry) => entry.id === provider.id) === index)
    .filter((provider) => matchSearch(provider.name))
    .sort((a, b) => {
      const ca = getProviderStats(a.id, ["apikey", "api_key", "oauth", "cookie"]).connected > 0 ? 0 : 1;
      const cb = getProviderStats(b.id, ["apikey", "api_key", "oauth", "cookie"]).connected > 0 ? 0 : 1;
      return ca - cb || a.name.localeCompare(b.name);
    });
  const isSearching = !!searchQuery.trim();
  const showCategory = (category) => categoryFilter === "all" || categoryFilter === category;
  const visibleApikeyEntries =
    isSearching || showAllApikey
      ? apikeyEntries
      : apikeyEntries.slice(0, APIKEY_INITIAL_VISIBLE);
  const hiddenApikeyCount = apikeyEntries.length - APIKEY_INITIAL_VISIBLE;
  const freeCombined = [
    ...freeEntries.map(([key, info]) => ({ key, info, tier: false })),
    ...freeTierEntries.map(([key, info]) => ({ key, info, tier: true })),
  ];
  const visibleFree =
    isSearching || showAllFree
      ? freeCombined
      : freeCombined.slice(0, FREE_INITIAL_VISIBLE);
  const hiddenFreeCount = freeCombined.length - FREE_INITIAL_VISIBLE;
  // Searching must reveal matches even while the section is collapsed.
  const isFreeCollapsed = freeCollapsed && !isSearching;

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const hasAnyResult =
    (showCategory("oauth") && oauthEntries.length > 0) ||
    (showCategory("free") && (freeEntries.length > 0 || freeTierEntries.length > 0)) ||
    (showCategory("apikey") && (apikeyEntries.length > 0 || compatibleProviders.length > 0 || anthropicCompatibleProviders.length > 0)) ||
    (showCategory("web") && (webCookieEntries.length > 0 || webProviders.length > 0)) ||
    (showCategory("media") && mediaProviders.length > 0);

  return (
    <div className="flex min-w-0 flex-col gap-5 px-1 sm:px-0">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-1.5 shadow-soft" role="group" aria-label="Filter providers by category">
        {[
          ["all", "All", "apps"],
          ["oauth", "OAuth", "oauth"],
          ["apikey", "API key", "key"],
          ["free", "Free", "redeem"],
          ["web", "Web", "globe"],
          ["media", "Media", "perm_media"],
        ].map(([value, label, iconName]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategoryFilter(value)}
            aria-pressed={categoryFilter === value}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all",
              categoryFilter === value
                ? "bg-primary text-bg shadow-2xs font-semibold"
                : "text-text-muted hover:bg-surface-2 hover:text-text-main",
            )}
          >
            <Icon name={iconName} weight="duotone" className="text-[15px]" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {!hasAnyResult && (
        <div className="text-center py-10 border border-dashed border-border rounded-xl bg-surface-2/40">
          <Icon name={"search_off"} className="text-[32px] text-text-muted mb-2 mx-auto" />
          <p className="text-text-muted text-sm">{isSearching ? "No providers match your search" : "No providers in this category"}</p>
        </div>
      )}

      {/* Custom Providers (OpenAI/Anthropic Compatible) — dynamic */}
      {showCategory("apikey") && (
      <div className="flex flex-col gap-3">
        <SectionControlStrip
          title="Custom Providers (OpenAI/Anthropic Compatible)"
          count={compatibleProviders.length + anthropicCompatibleProviders.length}
        >
          <button
            type="button"
            onClick={() => setShowAddAnthropicCompatibleModal(true)}
            className="h-7 px-2.5 text-xs font-medium text-text-muted hover:text-text-main border border-border hover:border-primary/40 rounded-md bg-surface hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
          >
            <Icon name={"add"} className=" text-[14px]" />
            Add Anthropic Compatible
          </button>
          <button
            type="button"
            onClick={() => setShowAddCompatibleModal(true)}
            className="h-7 px-2.5 text-xs font-medium text-text-muted hover:text-text-main border border-border hover:border-primary/40 rounded-md bg-surface hover:bg-surface-2 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
          >
            <Icon name={"add"} className=" text-[14px]" />
            Add OpenAI Compatible
          </button>
        </SectionControlStrip>

        {compatibleProviders.length === 0 &&
        anthropicCompatibleProviders.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 border border-dashed border-border rounded-xl text-text-muted text-xs sm:text-sm">
            <Icon name={"extension"} className=" text-[18px]" />
            <span>No custom providers — use buttons above to add OpenAI/Anthropic compatible endpoints</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {[...compatibleProviders, ...anthropicCompatibleProviders].map(
              (info) => (
                <ApiKeyProviderCard
                  key={info.id}
                  providerId={info.id}
                  provider={info}
                  stats={getProviderStats(info.id, "apikey")}
                  authType="compatible"
                  onToggle={(active) =>
                    handleToggleProvider(info.id, "apikey", active)
                  }
                />
              ),
            )}
          </div>
        )}
      </div>
      )}

      {/* OAuth Providers */}
      {showCategory("oauth") && oauthEntries.length > 0 && (
      <div className="flex flex-col gap-3">
        <SectionControlStrip
          title="OAuth Providers"
          count={oauthEntries.length}
        >
          <ModelAvailabilityBadge />
          <button
            type="button"
            onClick={() => handleBatchTest("oauth")}
            disabled={!!testingMode}
            className={cn(
              "h-7 px-2.5 text-xs font-medium rounded-md border transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto",
              testingMode === "oauth"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-surface border-border text-text-muted hover:text-text-main hover:border-primary/40 hover:bg-surface-2"
            )}
            title="Test all OAuth connections"
            aria-label="Test all OAuth connections"
          >
            <Icon name={testingMode === "oauth" ? "progress_activity" : "play_arrow"} className={cn(" text-[14px]", testingMode === "oauth" && "animate-spin")} />
            {testingMode === "oauth" ? "Testing..." : "Test All"}
          </button>
        </SectionControlStrip>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {oauthEntries.map(([key, info]) => {
            const authTypes = dualAuthTypes(info, key);
            return (
              <ProviderCard
                key={key}
                providerId={key}
                provider={info}
                stats={getProviderStats(key, authTypes)}
                authType="oauth"
                onToggle={(active) => handleToggleProvider(key, authTypes, active)}
              />
            );
          })}
        </div>
      </div>
      )}

      {/* Free Tier Providers */}
      {showCategory("free") && (freeEntries.length > 0 || freeTierEntries.length > 0) && (
      <div className="flex flex-col gap-3">
        <SectionControlStrip
          title="Free & Keyless"
          count={freeEntries.length + freeTierEntries.length}
          collapsible
          collapsed={isFreeCollapsed}
          onToggleCollapse={toggleFreeCollapsed}
        >
          <button
            type="button"
            onClick={() => handleBatchTest("free")}
            disabled={!!testingMode}
            className={cn(
              "h-7 px-2.5 text-xs font-medium rounded-md border transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto",
              testingMode === "free"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-surface border-border text-text-muted hover:text-text-main hover:border-primary/40 hover:bg-surface-2"
            )}
            title="Test all Free provider connections"
            aria-label="Test all Free provider connections"
          >
            <Icon name={testingMode === "free" ? "progress_activity" : "play_arrow"} className={cn(" text-[14px]", testingMode === "free" && "animate-spin")} />
            {testingMode === "free" ? "Testing..." : "Test All"}
          </button>
        </SectionControlStrip>

        {!isFreeCollapsed && (
          <>
            <p className="text-xs text-text-muted leading-relaxed -mt-1 max-w-3xl">
              <span className="font-medium text-text-main">Keyless</span> providers work without a key.
              OpenCode Free through a third-party router is unavailable upstream — use{" "}
              <span className="font-medium text-text-main">OpenCode Zen</span> (API key) or{" "}
              <span className="font-medium text-text-main">Pollinations</span> (<span className="font-mono">pol</span>).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {visibleFree.map(({ key, info, tier }) => {
                // Dual-auth (e.g. kiro): count/toggle oauth + apikey/api_key so the
                // card total matches the provider detail page.
                const freeAuthTypes = dualAuthTypes(info, key);
                return tier ? (
                  <ApiKeyProviderCard
                    key={key}
                    providerId={key}
                    provider={info}
                    stats={getProviderStats(key, freeAuthTypes)}
                    authType={Array.isArray(freeAuthTypes) ? (freeAuthTypes[0] ?? "apikey") : freeAuthTypes}
                    onToggle={(active) => handleToggleProvider(key, freeAuthTypes, active)}
                  />
                ) : (
                  <ProviderCard
                    key={key}
                    providerId={key}
                    provider={info}
                    stats={getProviderStats(key, freeAuthTypes)}
                    authType="free"
                    onToggle={(active) =>
                      handleToggleProvider(key, freeAuthTypes, active)
                    }
                  />
                );
              })}
            </div>

            {!isSearching && !showAllFree && hiddenFreeCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllFree(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2.5 text-xs sm:text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5 cursor-pointer"
              >
                <Icon name={"expand_more"} className=" text-[16px]" />
                Show all {freeCombined.length} providers
              </button>
            )}
          </>
        )}
      </div>
      )}

      {/* API Key Providers — fixed list */}
      {showCategory("apikey") && apikeyEntries.length > 0 && (
      <div className="flex flex-col gap-3">
        <SectionControlStrip
          title="API Key Providers"
          count={apikeyEntries.length}
        >
          <button
            type="button"
            onClick={() => handleBatchTest("apikey")}
            disabled={!!testingMode}
            className={cn(
              "h-7 px-2.5 text-xs font-medium rounded-md border transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto",
              testingMode === "apikey"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-surface border-border text-text-muted hover:text-text-main hover:border-primary/40 hover:bg-surface-2"
            )}
            title="Test all API Key connections"
            aria-label="Test all API Key connections"
          >
            <Icon name={testingMode === "apikey" ? "progress_activity" : "play_arrow"} className={cn(" text-[14px]", testingMode === "apikey" && "animate-spin")} />
            {testingMode === "apikey" ? "Testing..." : "Test All"}
          </button>
        </SectionControlStrip>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {visibleApikeyEntries.map(([key, info]) => (
            <ApiKeyProviderCard
              key={key}
              providerId={key}
              provider={info}
              stats={getProviderStats(key, "apikey")}
              authType="apikey"
              onToggle={(active) => handleToggleProvider(key, "apikey", active)}
            />
          ))}
        </div>
        {!isSearching && !showAllApikey && hiddenApikeyCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAllApikey(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 py-2.5 text-xs sm:text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5 cursor-pointer"
          >
            <Icon name={"expand_more"} className=" text-[16px]" />
            Show all {apikeyEntries.length} providers
          </button>
        )}
      </div>
      )}

      {showCategory("web") && (webCookieEntries.length > 0 || webProviders.length > 0) && (
      <div className="flex flex-col gap-3">
        <SectionControlStrip title="Web providers" count={webCookieEntries.length + webProviders.length} />
        {webProviders.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {webProviders.map((provider) => (
              <MediaDirectoryCard key={provider.id} provider={provider} connections={connections} />
            ))}
          </div>
        )}
        {webCookieEntries.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {webCookieEntries.map(([key, info]) => (
              <ApiKeyProviderCard
                key={key}
                providerId={key}
                provider={info}
                stats={getProviderStats(key, webCookieAuthTypes(key))}
                authType="cookie"
                onToggle={(active) => handleToggleProvider(key, webCookieAuthTypes(key), active)}
              />
            ))}
          </div>
        )}
      </div>
      )}
      {showCategory("media") && mediaProviders.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="border-b border-border py-1.5 text-sm font-semibold text-text-main">Media providers <span className="ml-1 text-xs font-normal text-text-muted">{mediaProviders.length}</span></h2>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {mediaProviders.map((provider) => (
              <MediaDirectoryCard
                key={provider.id}
                provider={provider}
                connections={connections}
              />
            ))}
          </div>
        </section>
      )}

      <AddCompatibleModal
        variant="openai"
        isOpen={showAddCompatibleModal}
        onClose={() => setShowAddCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddCompatibleModal(false);
        }}
      />
      <AddCompatibleModal
        variant="anthropic"
        isOpen={showAddAnthropicCompatibleModal}
        onClose={() => setShowAddAnthropicCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddAnthropicCompatibleModal(false);
        }}
      />

      {/* Test Results Modal */}
      {testResults && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-[6vh] sm:pt-[10vh]"
          onClick={() => setTestResults(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-surface border border-border rounded-xl w-full max-w-[600px] max-h-[86vh] sm:max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-surface/95 backdrop-blur-sm rounded-t-xl">
              <h3 className="font-semibold text-sm">Test Results</h3>
              <button
                type="button"
                onClick={() => setTestResults(null)}
                className="p-1 rounded-lg hover:bg-bg text-text-muted hover:text-text-main transition-colors cursor-pointer"
                aria-label="Close test results"
              >
                <Icon name={"close"} className=" text-lg" />
              </button>
            </div>
            <div className="p-5">
              <ProviderTestResultsView results={testResults} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ providerId, provider, stats, authType, onToggle }) {
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isNoAuth = !!provider.noAuth;

  const authLabels = {
    oauth: "OAuth",
    free: isNoAuth ? "Keyless" : "Free",
    apikey: "API Key",
    api_key: "API Key",
    compatible: "Custom",
    cookie: "Cookie",
  };
  const authLabel = authLabels[authType] || (typeof authType === "string" ? authType : "OAuth");
  const needsApiKey = !isNoAuth && !allDisabled && connected === 0 && (authType === "apikey" || authType === "api_key" || authType === "free");

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group block min-w-0">
      <div
        className={cn(
          "provider-directory-card relative flex items-center justify-between gap-3.5 rounded-xl border bg-surface p-3.5 transition-all duration-150 cursor-pointer",
          connected > 0
            ? "border-primary/35 shadow-soft"
            : "border-border hover:border-primary/35",
          allDisabled && "opacity-55"
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5 flex-1">
          <div
            className="size-10 shrink-0 rounded-xl flex items-center justify-center border border-border-subtle bg-surface-2 shadow-2xs group-hover:scale-105 transition-transform"
          >
            <ProviderIcon
              src={`/providers/${provider.id}.png`}
              alt={provider.name}
              size={24}
              className="object-contain rounded max-w-[24px] max-h-[24px]"
              fallbackIcon={provider.icon}
              fallbackText={
                provider.textIcon || provider.id.slice(0, 2).toUpperCase()
              }
              fallbackColor={provider.color}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="truncate text-sm font-bold text-text-main group-hover:text-primary transition-colors leading-tight">
                {provider.name}
              </h3>
              <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-muted border border-border-subtle">
                {authLabel}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="text-text-muted font-mono text-[11px]">{stats.total} conn</span>
              <span className="text-text-subtle">·</span>
              <span className="text-text-muted font-mono text-[11px]">{getModelsByProviderId(providerId).length} models</span>
              {allDisabled ? (
                <Badge variant="default" size="sm">
                  <span className="flex items-center gap-1">
                    <Icon name={"pause_circle"} className=" text-[12px]" />
                    Disabled
                  </span>
                </Badge>
              ) : isNoAuth ? (
                <Badge variant="success" size="sm" dot>Ready</Badge>
              ) : needsApiKey ? (
                <Badge variant="warning" size="sm">
                  <span className="flex items-center gap-1">
                    <Icon name={"key"} className=" text-[12px]" />
                    Needs API key
                  </span>
                </Badge>
              ) : (
                <>
                  {getStatusDisplay(connected, error, errorCode)}
                  {provider.billingTier === "subscription" && (
                    <Badge variant="default" size="sm">
                      <span className="flex items-center gap-1">
                        <Icon name={"workspace_premium"} className=" text-[12px]" />
                        Subscription
                      </span>
                    </Badge>
                  )}
                  {errorTime && (
                    <span className="text-text-muted text-[11px]">{errorTime}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {stats.total > 0 && (
            <div
              className="opacity-100 transition-opacity sm:opacity-80 sm:group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Toggle
                size="sm"
                checked={!allDisabled}
                onChange={onToggle}
                ariaLabel={`${provider.name} routing`}
                title={allDisabled ? "Enable provider" : "Disable provider"}
              />
            </div>
          )}
          <Icon name={"chevron_right"} className="text-[16px] text-text-muted/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

ProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    color: PropTypes.string,
    textIcon: PropTypes.string,
    billingTier: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    errorTime: PropTypes.string,
    total: PropTypes.number,
    allDisabled: PropTypes.bool,
  }).isRequired,
  authType: PropTypes.string,
  onToggle: PropTypes.func,
};

function ApiKeyProviderCard({
  providerId,
  provider,
  stats,
  authType,
  onToggle,
}) {
  const { connected, error, errorCode, errorTime, allDisabled } = stats;
  const isCompatible = providerId.startsWith(OPENAI_COMPATIBLE_PREFIX);
  const isAnthropicCompatible = providerId.startsWith(
    ANTHROPIC_COMPATIBLE_PREFIX,
  );

  const authLabel = isCompatible
    ? "OpenAI"
    : isAnthropicCompatible
      ? "Anthropic"
      : authType === "cookie"
        ? "Cookie"
        : authType === "free"
          ? (provider.noAuth ? "Keyless" : "Free")
          : "API Key";

  const isNoAuth = !!provider.noAuth;
  const needsApiKey = !isNoAuth && !allDisabled && connected === 0;

  const getIconPath = () => {
    if (isCompatible && provider.apiType)
      return provider.apiType === "responses"
        ? "/providers/oai-r.png"
        : "/providers/oai-cc.png";
    if (isAnthropicCompatible) return "/providers/anthropic-m.png";
    return getProviderIconSrc(provider.id);
  };

  return (
    <Link href={`/dashboard/providers/${providerId}`} className="group block min-w-0">
      <div
        className={cn(
          "provider-directory-card relative flex items-center justify-between gap-3.5 rounded-xl border bg-surface p-3.5 transition-all duration-150 cursor-pointer",
          connected > 0
            ? "border-primary/35 shadow-soft"
            : "border-border hover:border-primary/35",
          allDisabled && "opacity-55"
        )}
      >
        <div className="flex min-w-0 items-center gap-3.5 flex-1">
          <div
            className="size-10 shrink-0 rounded-xl flex items-center justify-center border border-border-subtle bg-surface-2 shadow-2xs group-hover:scale-105 transition-transform"
          >
            <ProviderIcon
              src={getIconPath()}
              alt={provider.name}
              size={24}
              className="object-contain rounded max-w-[24px] max-h-[24px]"
              fallbackIcon={provider.icon}
              fallbackText={
                provider.textIcon || provider.id.slice(0, 2).toUpperCase()
              }
              fallbackColor={provider.color}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="truncate text-sm font-bold text-text-main group-hover:text-primary transition-colors leading-tight">
                {provider.name}
              </h3>
              <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-text-muted border border-border-subtle">
                {authLabel}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
              <span className="text-text-muted font-mono text-[11px]">{stats.total} conn</span>
              <span className="text-text-subtle">·</span>
              <span className="text-text-muted font-mono text-[11px]">{getModelsByProviderId(providerId).length} models</span>
              {allDisabled ? (
                <Badge variant="default" size="sm">
                  <span className="flex items-center gap-1">
                    <Icon name={"pause_circle"} className=" text-[12px]" />
                    Disabled
                  </span>
                </Badge>
              ) : isNoAuth ? (
                <Badge variant="success" size="sm" dot>Ready</Badge>
              ) : needsApiKey ? (
                <Badge variant="warning" size="sm">
                  <span className="flex items-center gap-1">
                    <Icon name={"key"} className=" text-[12px]" />
                    Needs API key
                  </span>
                </Badge>
              ) : (
                <>
                  {getStatusDisplay(connected, error, errorCode)}
                  {provider.billingTier === "subscription" && (
                    <Badge variant="default" size="sm">
                      <span className="flex items-center gap-1">
                        <Icon name={"workspace_premium"} className=" text-[12px]" />
                        Subscription
                      </span>
                    </Badge>
                  )}
                  {isCompatible && (
                    <Badge variant="default" size="sm">
                      {provider.apiType === "responses" ? "Responses" : "Chat"}
                    </Badge>
                  )}
                  {isAnthropicCompatible && (
                    <Badge variant="default" size="sm">
                      Messages
                    </Badge>
                  )}
                  {errorTime && (
                    <span className="text-text-muted text-[11px]">{errorTime}</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {stats.total > 0 && (
            <div
              className="opacity-100 transition-opacity sm:opacity-80 sm:group-hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Toggle
                size="sm"
                checked={!allDisabled}
                onChange={onToggle}
                ariaLabel={`${provider.name} routing`}
                title={allDisabled ? "Enable provider" : "Disable provider"}
              />
            </div>
          )}
          <Icon name={"chevron_right"} className="text-[16px] text-text-muted/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

ApiKeyProviderCard.propTypes = {
  providerId: PropTypes.string.isRequired,
  provider: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    color: PropTypes.string,
    textIcon: PropTypes.string,
    apiType: PropTypes.string,
    billingTier: PropTypes.string,
  }).isRequired,
  stats: PropTypes.shape({
    connected: PropTypes.number,
    error: PropTypes.number,
    errorCode: PropTypes.string,
    errorTime: PropTypes.string,
    total: PropTypes.number,
    allDisabled: PropTypes.bool,
  }).isRequired,
  authType: PropTypes.string,
  onToggle: PropTypes.func,
};

function MediaDirectoryCard({ provider, connections }) {
  const providerConnections = connections.filter((connection) => connection.provider === provider.id);
  const connected = providerConnections.filter((connection) => (
    connection.isActive !== false &&
    (connection.testStatus === "active" || connection.testStatus === "success" || !connection.testStatus)
  )).length;
  const kind = provider.kind || (provider.serviceKinds || []).find((service) => service !== "llm") || "image";
  const modelCount = getModelsByProviderId(provider.id).length;

  return (
    <Link href={`/dashboard/media-providers/${kind}/${provider.id}`} className="provider-directory-card group flex min-w-0 items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 transition-all hover:border-primary/35">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-2 shadow-2xs group-hover:scale-105 transition-transform">
        <ProviderIcon providerId={provider.id} alt={provider.name} size={24} className="object-contain" fallbackIcon={provider.icon} fallbackText={provider.textIcon} fallbackColor={provider.color} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-bold text-text-main group-hover:text-primary transition-colors">{provider.name}</h3>
        <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-text-muted font-mono text-[11px]">
          <span className="capitalize font-sans font-medium">{kind}</span>
          <span>·</span>
          <span>{providerConnections.length} conn</span>
          <span>·</span>
          <span>{modelCount} models</span>
        </div>
      </div>
      <Badge variant={connected ? "success" : "default"} dot={connected > 0} size="sm">{connected ? `${connected} connected` : "Not connected"}</Badge>
    </Link>
  );
}

MediaDirectoryCard.propTypes = {
  provider: PropTypes.object.isRequired,
  connections: PropTypes.arrayOf(PropTypes.object).isRequired,
};

function ProviderTestResultsView({ results }) {
  if (results.error && !results.results) {
    return (
      <div className="text-center py-6">
        <Icon name={"error"} className="mb-2 block text-danger text-[32px]" />
        <p className="text-sm text-danger">{results.error}</p>
      </div>
    );
  }

  const { summary, mode } = results;
  const items = results.results || [];
  const modeLabel =
    {
      oauth: "OAuth",
      free: "Free",
      apikey: "API Key",
      provider: "Provider",
      all: "All",
    }[mode] || mode;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {summary && (
        <div className="flex flex-wrap items-center gap-2 text-xs mb-1 sm:gap-3">
          <span className="text-text-muted">{modeLabel} Test</span>
          <Badge variant="success" size="sm">{summary.passed} passed</Badge>
          {summary.failed > 0 && <Badge variant="error" size="sm">{summary.failed} failed</Badge>}
          <span className="text-text-muted sm:ml-auto">{summary.total} tested</span>
        </div>
      )}
      {items.map((r, i) => (
        <div
          key={r.connectionId || i}
          className="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-xs sm:flex-nowrap"
        >
          <Icon name={r.valid ? "check_circle" : "error"} className={cn("text-[16px]", r.valid ? "text-success" : "text-danger")} />
          <div className="min-w-0 flex-[1_1_160px]">
            <span className="block truncate font-medium sm:inline">
              {r.connectionName}
            </span>
            <span className="block truncate text-text-muted sm:ml-1.5 sm:inline">
              ({r.provider})
            </span>
          </div>
          {r.latencyMs !== undefined && (
            <span className="shrink-0 text-text-muted font-mono tabular-nums">
              {r.latencyMs}ms
            </span>
          )}
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
              r.valid ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            )}
          >
            {r.valid ? "OK" : r.diagnosis?.type || "ERROR"}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <div className="text-center py-4 text-text-muted text-sm">
          No active connections found for this group.
        </div>
      )}
    </div>
  );
}

ProviderTestResultsView.propTypes = {
  results: PropTypes.shape({
    mode: PropTypes.string,
    results: PropTypes.array,
    summary: PropTypes.shape({
      total: PropTypes.number,
      passed: PropTypes.number,
      failed: PropTypes.number,
    }),
    error: PropTypes.string,
  }).isRequired,
};
