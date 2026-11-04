"use client";

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";
import { isLocalConnection, isLocalEmbeddingModel } from "@/lib/privacy/privacyMode";

import { Icon } from "@/shared/components/Icon";
function getProviderConfig(providerId) {
  return AI_PROVIDERS[providerId] || { name: providerId };
}

function getProviderImageUrl(providerId) {
  return getProviderIconSrc(providerId);
}

function isProviderLocal(p) {
  if (!p) return false;
  const id = (p.provider || "").toLowerCase();
  if (id.includes("local") || id.startsWith("ollama")) return true;
  if (p.baseUrl && isLocalConnection({ baseUrl: p.baseUrl })) return true;
  if (p.providerSpecificData && isLocalConnection({ providerSpecificData: p.providerSpecificData })) return true;
  if (p.model && isLocalEmbeddingModel(p.model)) return true;
  return false;
}

function fmtCompactNum(n) {
  const val = Number(n) || 0;
  if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

function ChannelModule({
  index = 0,
  provider,
  activeRequest,
  recentTelemetry,
  isActive,
  isLast,
  isError,
  compact = false,
}) {
  const [imgError, setImgError] = useState(false);
  const providerId = provider.provider;
  const config = getProviderConfig(providerId);
  const label = (config.name !== providerId ? config.name : null) || provider.nodeName || provider.name || providerId;
  const imageUrl = getProviderImageUrl(providerId);
  const textIcon = config.textIcon || (providerId || "?").slice(0, 2).toUpperCase();
  const color = "var(--color-primary)";

  const isLocal = isProviderLocal(provider);
  const slotCode = `CH-${String(index + 1).padStart(2, "0")}`;

  // Status computation strictly from real data
  let status = "READY";
  let statusBadgeVariant = "ready";
  let statusBorder = "border-border hover:border-primary/35";
  let statusPillCls = "border-border-subtle bg-surface text-text-muted";

  if (isError) {
    status = "ERROR";
    statusBadgeVariant = "error";
    statusBorder = "border-danger/50 bg-danger/[0.03]";
    statusPillCls = "border-danger/30 bg-danger/10 text-danger";
  } else if (isActive) {
    status = "BUSY";
    statusBadgeVariant = "busy";
    statusBorder = "border-primary/60 bg-primary/[0.04] shadow-warm";
    statusPillCls = "border-primary/35 bg-primary/15 text-primary";
  } else if (isLast) {
    status = "RECENT";
    statusBadgeVariant = "recent";
    statusBorder = "border-warning/40 bg-warning/[0.03]";
    statusPillCls = "border-warning/30 bg-warning/10 text-warning";
  } else if (isLocal) {
    status = "LOCAL";
    statusBadgeVariant = "local";
    statusBorder = "border-success/35 bg-success/[0.02]";
    statusPillCls = "border-success/30 bg-success/10 text-success";
  }

  const activeModel = activeRequest?.model || recentTelemetry?.lastModel || null;
  const activeAccount = activeRequest?.account || null;
  const routeSubtitle =
    activeModel ||
    (isError
      ? "Last dispatch failed"
      : isLast
        ? "Last active route target"
        : isLocal
          ? "Local inference endpoint"
          : "Standby channel ready");

  if (compact) {
    return (
      <article
        className={`channel-bay-module ${isActive ? "channel-bay-module-busy" : ""} ${isError ? "channel-bay-module-error" : ""}`}
        data-status={status.toLowerCase()}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
            {imageUrl && !imgError ? (
              <img
                src={imageUrl}
                alt=""
                className="size-4 object-contain"
                loading="lazy"
                decoding="async"
                onError={() => {
                  const m = imageUrl?.match(/^\/providers\/([^/]+)\.png$/i);
                  if (m) markProviderIconMissing(m[1]);
                  setImgError(true);
                }}
              />
            ) : (
              <span className="font-mono text-[10px] font-bold" style={{ color }}>{textIcon}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-semibold text-text-main" title={label}>{label}</h3>
            <p className="truncate font-mono text-[11px] text-text-muted" title={routeSubtitle}>
              {routeSubtitle}
            </p>
          </div>
          <span className={`channel-bay-status channel-bay-status-${statusBadgeVariant} shrink-0`}>
            <span className="channel-bay-dot" aria-hidden="true" />
            {status}
          </span>
        </div>
      </article>
    );
  }

  return (
    <article
      className={`group relative flex flex-col justify-between gap-3 overflow-hidden rounded-xl border bg-surface-2/45 p-3.5 transition-all duration-150 ${statusBorder}`}
      data-status={status.toLowerCase()}
    >
      {/* Top Row: Provider Identity + Slot & Status Pill */}
      <div className="flex min-w-0 items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface shadow-2xs">
            {imageUrl && !imgError ? (
              <img
                src={imageUrl}
                alt=""
                className="size-5 object-contain"
                loading="lazy"
                decoding="async"
                onError={() => {
                  const m = imageUrl?.match(/^\/providers\/([^/]+)\.png$/i);
                  if (m) markProviderIconMissing(m[1]);
                  setImgError(true);
                }}
              />
            ) : (
              <span className="font-mono text-[11px] font-bold" style={{ color }}>{textIcon}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-semibold text-text-subtle">{slotCode}</span>
              <span className="text-text-subtle">·</span>
              <span className="font-mono text-[10px] text-text-muted">
                {isLocal ? "Local Node" : "Cloud API"}
              </span>
              <span className="text-text-subtle">·</span>
              <span className="font-mono text-[10px] text-text-subtle">{providerId}</span>
            </div>
            <h3 className="truncate text-sm font-semibold text-text-main" title={label}>
              {label}
            </h3>
          </div>
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${statusPillCls}`}>
          <span className="channel-bay-dot" aria-hidden="true" />
          {status}
        </span>
      </div>

      {/* Bottom Telemetry Strip */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 rounded-lg border border-border-subtle bg-surface/90 px-3 py-2 font-mono text-[11px]">
        <div className="min-w-0 sm:col-span-2 flex items-center gap-2">
          <Icon
            name={isActive ? "bolt" : isLast ? "history" : isError ? "warning" : "terminal"}
            className={`text-[13px] shrink-0 ${
              isActive
                ? "text-primary"
                : isLast
                  ? "text-warning"
                  : isError
                    ? "text-danger"
                    : "text-text-muted"
            }`}
          />
          <div className="min-w-0 flex-1">
            <span className="block text-[9.5px] uppercase tracking-wider text-text-muted">
              {activeModel ? "Active / Last Model" : "Channel State"}
            </span>
            <span className="block truncate font-semibold text-text-main" title={routeSubtitle}>
              {routeSubtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 border-t border-border-subtle pt-1.5 sm:border-t-0 sm:pt-0">
          {recentTelemetry && recentTelemetry.count > 0 ? (
            <div className="text-left sm:text-right">
              <span className="block text-[9.5px] uppercase tracking-wider text-text-muted">
                Recent Traffic
              </span>
              <span className="font-semibold text-text-main">
                {recentTelemetry.count} req · {fmtCompactNum(recentTelemetry.tokens)} tok
              </span>
            </div>
          ) : activeAccount ? (
            <span className="truncate max-w-[120px] rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-muted" title={activeAccount}>
              {activeAccount}
            </span>
          ) : (
            <div className="text-left sm:text-right">
              <span className="block text-[9.5px] uppercase tracking-wider text-text-muted">Traffic</span>
              <span className="text-text-muted">Idle</span>
            </div>
          )}
        </div>
      </div>

      {/* Subtle Bottom Signal Rail when active or recent */}
      {(isActive || isLast || isError) && (
        <div
          className={`h-0.5 w-full rounded-full ${
            isActive ? "bg-primary animate-pulse" : isError ? "bg-danger" : "bg-warning/70"
          }`}
          aria-hidden="true"
        />
      )}
    </article>
  );
}

ChannelModule.propTypes = {
  index: PropTypes.number,
  provider: PropTypes.shape({
    id: PropTypes.string,
    provider: PropTypes.string.isRequired,
    name: PropTypes.string,
    nodeName: PropTypes.string,
    baseUrl: PropTypes.string,
    providerSpecificData: PropTypes.object,
    model: PropTypes.string,
  }).isRequired,
  activeRequest: PropTypes.shape({
    provider: PropTypes.string,
    model: PropTypes.string,
    account: PropTypes.string,
    count: PropTypes.number,
  }),
  recentTelemetry: PropTypes.shape({
    count: PropTypes.number,
    tokens: PropTypes.number,
    lastModel: PropTypes.string,
  }),
  isActive: PropTypes.bool,
  isLast: PropTypes.bool,
  isError: PropTypes.bool,
  compact: PropTypes.bool,
};

export default function ProviderTopology({
  providers = [],
  activeRequests = [],
  recentRequests = [],
  lastProvider = "",
  errorProvider = "",
}) {
  const [filter, setFilter] = useState("all"); // all | active | local | errors
  const [layoutMode, setLayoutMode] = useState("matrix"); // matrix | flow

  const activeMap = useMemo(() => {
    const map = new Map();
    for (const req of activeRequests) {
      if (req.provider) {
        map.set(req.provider.toLowerCase(), req);
      }
    }
    return map;
  }, [activeRequests]);

  // Aggregate recent telemetry per provider and per model from recentRequests
  const { recentByProvider, topRecentModels } = useMemo(() => {
    const provMap = new Map();
    const modelMap = new Map();
    for (const r of recentRequests || []) {
      const pKey = (r.provider || "").toLowerCase();
      const tok = (Number(r.promptTokens) || 0) + (Number(r.completionTokens) || 0);
      if (pKey) {
        const prev = provMap.get(pKey) || { count: 0, tokens: 0, lastModel: r.model || null };
        provMap.set(pKey, {
          count: prev.count + 1,
          tokens: prev.tokens + tok,
          lastModel: prev.lastModel || r.model || null,
        });
      }
      if (r.model) {
        const mKey = `${r.model}::${r.provider || ""}`;
        const prevM = modelMap.get(mKey) || {
          model: r.model,
          provider: r.provider || "router",
          count: 0,
          tokens: 0,
        };
        modelMap.set(mKey, {
          ...prevM,
          count: prevM.count + 1,
          tokens: prevM.tokens + tok,
        });
      }
    }
    const sortedModels = Array.from(modelMap.values())
      .sort((a, b) => b.count - a.count || b.tokens - a.tokens)
      .slice(0, 4);
    return { recentByProvider: provMap, topRecentModels: sortedModels };
  }, [recentRequests]);

  const lastKey = (lastProvider || "").toLowerCase();
  const errorKey = (errorProvider || "").toLowerCase();

  // Categorize and sort providers (active/error first)
  const categorized = useMemo(() => {
    return providers.map((p) => {
      const pId = (p.provider || "").toLowerCase();
      const activeReq = activeMap.get(pId);
      const recentTelemetry = recentByProvider.get(pId) || null;
      const isActive = !!activeReq;
      const isError = !isActive && errorKey === pId;
      const isLast = !isActive && !isError && lastKey === pId;
      const isLocal = isProviderLocal(p);

      // Rank order: active (0), error (1), recent (2), local (3), standby (4)
      let rank = 4;
      if (isActive) rank = 0;
      else if (isError) rank = 1;
      else if (isLast) rank = 2;
      else if (isLocal) rank = 3;

      return {
        provider: p,
        activeReq,
        recentTelemetry,
        isActive,
        isError,
        isLast,
        isLocal,
        rank,
      };
    }).sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const nameA = a.provider.name || a.provider.provider || "";
      const nameB = b.provider.name || b.provider.provider || "";
      return nameA.localeCompare(nameB);
    });
  }, [providers, activeMap, recentByProvider, lastKey, errorKey]);

  // Counts for filters
  const counts = useMemo(() => {
    let active = 0;
    let local = 0;
    let errors = 0;
    for (const item of categorized) {
      if (item.isActive) active += 1;
      if (item.isLocal) local += 1;
      if (item.isError) errors += 1;
    }
    return {
      all: categorized.length,
      active,
      local,
      errors,
    };
  }, [categorized]);

  const filteredItems = useMemo(() => {
    if (filter === "active") return categorized.filter((item) => item.isActive);
    if (filter === "local") return categorized.filter((item) => item.isLocal);
    if (filter === "errors") return categorized.filter((item) => item.isError);
    return categorized;
  }, [categorized, filter]);

  const busyCount = counts.active;
  const lastProviderLabel = lastProvider
    ? (getProviderConfig(lastProvider)?.name || lastProvider)
    : "Standby";

  const totalRecentCount = (recentRequests || []).length;

  return (
    <section
      aria-label="Live provider routing"
      className="routing-panel flex h-full min-w-0 flex-col justify-between p-4 sm:p-5 gap-3.5"
    >
      <div className="flex flex-col gap-3.5 min-w-0">
        {/* Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="icon-box icon-box-sm text-primary">
              <Icon name="hub" className="text-[15px]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[14.5px] font-semibold text-text-main">Live routing topology</h2>
                <span className={`status-dot ${busyCount > 0 ? "status-dot-live" : "bg-text-muted/50"}`} />
                <span className="hidden sm:inline-flex items-center rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-text-muted">
                  SWITCHBOARD
                </span>
              </div>
              <p className="text-xs text-text-muted">
                {busyCount > 0
                  ? `${busyCount} active stream dispatching now`
                  : "Listening for incoming requests"}
                {` · ${providers.length} ${providers.length === 1 ? "channel" : "channels"}`}
              </p>
            </div>
          </div>

          {/* Filter & Layout toolbar */}
          {providers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-2 p-1" role="toolbar" aria-label="Filter channels">
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`min-h-[28px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none ${
                    filter === "all"
                      ? "bg-surface text-text-main font-semibold border border-border-subtle shadow-2xs"
                      : "text-text-muted hover:text-text-main hover:bg-surface/60"
                  }`}
                >
                  <span>All</span>
                  <span className="font-mono text-[10px] opacity-70">({counts.all})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("active")}
                  className={`min-h-[28px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none ${
                    filter === "active"
                      ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                      : "text-text-muted hover:text-text-main hover:bg-surface/60"
                  }`}
                >
                  <span>Active</span>
                  <span className="font-mono text-[10px] opacity-70">({counts.active})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("local")}
                  className={`min-h-[28px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none ${
                    filter === "local"
                      ? "bg-surface text-text-main font-semibold border border-border-subtle shadow-2xs"
                      : "text-text-muted hover:text-text-main hover:bg-surface/60"
                  }`}
                >
                  <span>Local</span>
                  <span className="font-mono text-[10px] opacity-70">({counts.local})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("errors")}
                  className={`min-h-[28px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 focus-visible:outline-none ${
                    filter === "errors"
                      ? "bg-danger/10 text-danger font-semibold border border-danger/30"
                      : "text-text-muted hover:text-text-main hover:bg-surface/60"
                  }`}
                >
                  <span>Errors</span>
                  <span className="font-mono text-[10px] opacity-70">({counts.errors})</span>
                </button>
              </div>

              <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-1 gap-0.5" role="group" aria-label="Topology view mode">
                <button
                  type="button"
                  onClick={() => setLayoutMode("matrix")}
                  title="Switchboard Matrix"
                  className={`min-h-[28px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none ${
                    layoutMode === "matrix"
                      ? "bg-surface text-text-main font-semibold border border-border-subtle shadow-2xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <Icon name="grid_view" className="text-[13px]" />
                  <span className="hidden sm:inline">Matrix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode("flow")}
                  title="Circuit Flow Diagram"
                  className={`min-h-[28px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none ${
                    layoutMode === "flow"
                      ? "bg-surface text-text-main font-semibold border border-border-subtle shadow-2xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <Icon name="hub" className="text-[13px]" />
                  <span className="hidden sm:inline">Circuit</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 3-Stage Signal Pipeline Banner (Ingress -> Router Core -> Upstream) */}
        <div className="rounded-xl border border-border bg-surface-2/40 p-2.5">
          <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)_auto_minmax(0,1fr)]">
            {/* Stage 01: Client Ingress */}
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 shadow-2xs">
              <div className="icon-box icon-box-sm text-primary">
                <Icon name="terminal" className="text-[14px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">01 · Ingress</span>
                  <span className="whitespace-nowrap font-mono text-[10px] text-primary">/v1/*</span>
                </div>
                <p className="truncate text-xs font-semibold text-text-main">Clients &amp; CLI Tools</p>
              </div>
            </div>

            {/* Signal Conduit 1 */}
            <div className="hidden md:flex flex-col items-center justify-center px-0.5" aria-hidden="true">
              <svg width="32" height="14" viewBox="0 0 32 14" className="overflow-visible">
                <path
                  d="M 0 7 H 32"
                  className={busyCount > 0 ? "routing-line routing-line-active" : "routing-line"}
                />
                <circle cx="16" cy="7" r="2.2" fill="var(--color-primary)" />
              </svg>
            </div>

            {/* Stage 02: MiawRouter Core Hub */}
            <div
              className={`flex min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 shadow-2xs transition-colors ${
                busyCount > 0
                  ? "border-primary/50 bg-primary/[0.06]"
                  : "border-primary/25 bg-surface"
              }`}
            >
              <div className="icon-box icon-box-sm text-primary">
                <Icon name="hub" className="text-[15px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    02 · Router Core
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] text-text-main">
                    <span className={`status-dot ${busyCount > 0 ? "status-dot-live" : "bg-success"}`} />
                    {busyCount > 0 ? `${busyCount} BUSY` : "READY"}
                  </span>
                </div>
                <p className="truncate font-mono text-[11px] text-text-muted">
                  Last route: <strong className="font-semibold text-text-main">{lastProviderLabel}</strong>
                </p>
              </div>
            </div>

            {/* Signal Conduit 2 */}
            <div className="hidden md:flex flex-col items-center justify-center px-0.5" aria-hidden="true">
              <svg width="32" height="14" viewBox="0 0 32 14" className="overflow-visible">
                <path
                  d="M 0 7 H 32"
                  className={busyCount > 0 ? "routing-line routing-line-active" : lastProvider ? "routing-line routing-line-recent" : "routing-line"}
                />
                <circle
                  cx="16"
                  cy="7"
                  r="2.2"
                  fill={busyCount > 0 ? "var(--color-primary)" : lastProvider ? "var(--color-warning)" : "var(--color-text-muted)"}
                />
              </svg>
            </div>

            {/* Stage 03: Upstream Pool */}
            <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 shadow-2xs">
              <div className="icon-box icon-box-sm text-primary">
                <Icon name="dns" className="text-[14px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-wider text-text-muted">03 · Upstream</span>
                  <span className="whitespace-nowrap font-mono text-[10px] text-text-main">
                    {counts.all} {counts.all === 1 ? "channel" : "channels"}
                  </span>
                </div>
                <p className="truncate font-mono text-[11px] text-text-muted">
                  {counts.active} busy · {counts.local} local · {counts.errors} err
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Switchboard Channel Bay */}
        <div className="min-w-0">
          {providers.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-2/40 text-xs text-text-muted">
              <div className="icon-box icon-box-sm text-text-muted">
                <Icon name="dns" className="text-[14px]" />
              </div>
              <span>No provider channels configured.</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-2/40 text-xs text-text-muted">
              <span>No provider channels match the selected filter.</span>
            </div>
          ) : layoutMode === "matrix" ? (
            <div
              className={`grid grid-cols-1 gap-2.5 ${filteredItems.length > 1 ? "md:grid-cols-2" : ""} max-h-[340px] overflow-auto pr-0.5`}
              role="list"
              aria-label="Provider switchboard channels"
            >
              {filteredItems.map(({ provider, activeReq, recentTelemetry, isActive, isLast, isError }, idx) => (
                <ChannelModule
                  key={provider.provider}
                  index={idx}
                  provider={provider}
                  activeRequest={activeReq}
                  recentTelemetry={recentTelemetry}
                  isActive={isActive}
                  isLast={isLast}
                  isError={isError}
                />
              ))}
            </div>
          ) : (
            <div className="routing-scroll overflow-auto max-h-[420px] rounded-xl border border-border-subtle bg-surface-2/30 p-2" tabIndex={0} aria-label="Routing diagram. Scroll to view all providers.">
              <div className="routing-canvas" style={{ height: Math.max(240, filteredItems.length * 78 + 48) }}>
                <svg className="routing-lines" viewBox={`0 0 1000 ${Math.max(240, filteredItems.length * 78 + 48)}`} preserveAspectRatio="none" aria-hidden="true">
                  <path d={`M 230 ${Math.max(240, filteredItems.length * 78 + 48) / 2} H 350`} className={busyCount ? "routing-line routing-line-active" : "routing-line"} />
                  {filteredItems.map((item, index) => {
                    const height = Math.max(240, filteredItems.length * 78 + 48);
                    const y = 24 + index * 78 + 34;
                    return <path key={item.provider.provider} d={`M 490 ${height / 2} C 555 ${height / 2}, 555 ${y}, 620 ${y}`} className={`routing-line ${item.isActive ? "routing-line-active" : item.isError ? "routing-line-error" : item.isLast ? "routing-line-recent" : ""}`} />;
                  })}
                </svg>
                <div className="routing-source routing-node">
                  <div className="icon-box icon-box-sm text-primary">
                    <Icon name="terminal" className="text-[16px]" />
                  </div>
                  <strong>Clients</strong>
                  <span>Apps &amp; CLI tools</span>
                </div>
                <div className={`routing-hub routing-node ${busyCount ? "routing-hub-active" : ""}`}>
                  <div className="icon-box text-primary">
                    <Icon name="hub" className="text-[18px]" />
                  </div>
                  <strong>MiawRouter</strong>
                  <span>{busyCount ? `${busyCount} active routes` : "Listening"}</span>
                </div>
                <div className="routing-destinations">
                  {filteredItems.map(({ provider, activeReq, recentTelemetry, isActive, isLast, isError }, idx) => (
                    <ChannelModule
                      key={provider.provider}
                      index={idx}
                      provider={provider}
                      activeRequest={activeReq}
                      recentTelemetry={recentTelemetry}
                      isActive={isActive}
                      isLast={isLast}
                      isError={isError}
                      compact
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Active Route Models & Telemetry Breakdown (fills remaining vertical space cleanly) */}
        {topRecentModels.length > 0 && (
          <div className="rounded-xl border border-border-subtle bg-surface-2/30 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Icon name="analytics" className="text-[13px] text-primary" />
                <span className="text-xs font-semibold text-text-main">Active Routed Models</span>
              </div>
              <span className="font-mono text-[10.5px] text-text-muted">
                Last {totalRecentCount} {totalRecentCount === 1 ? "request" : "requests"}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {topRecentModels.map((m) => {
                const share = totalRecentCount > 0 ? Math.round((m.count / totalRecentCount) * 100) : 0;
                return (
                  <div
                    key={`${m.model}-${m.provider}`}
                    className="flex flex-col gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-text-main" title={m.model}>
                        {m.model}
                      </span>
                      <span className="shrink-0 rounded border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                        {m.provider}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 font-mono text-[10.5px] text-text-muted">
                      <span>{m.count} dispatches ({share}%)</span>
                      <span className="text-text-main font-medium">{fmtCompactNum(m.tokens)} tok</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="routing-legend !mt-1">
        <span><i className="bg-primary" />Active request ({counts.active})</span>
        <span><i className="bg-warning" />Last route ({lastProvider ? 1 : 0})</span>
        <span><i className="bg-success" />Local ({counts.local})</span>
        <span><i className="bg-danger" />Failed ({counts.errors})</span>
        <span><i className="bg-text-muted/40" />Total channels ({counts.all})</span>
      </div>
    </section>
  );
}

ProviderTopology.propTypes = {
  providers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      provider: PropTypes.string.isRequired,
      name: PropTypes.string,
      nodeName: PropTypes.string,
      color: PropTypes.string,
      imageUrl: PropTypes.string,
    })
  ),
  activeRequests: PropTypes.arrayOf(
    PropTypes.shape({
      provider: PropTypes.string,
      model: PropTypes.string,
      account: PropTypes.string,
      count: PropTypes.number,
    })
  ),
  recentRequests: PropTypes.arrayOf(PropTypes.object),
  lastProvider: PropTypes.string,
  errorProvider: PropTypes.string,
};
