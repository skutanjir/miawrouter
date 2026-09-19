"use client";

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { AI_PROVIDERS } from "@/shared/constants/providers";
import { getProviderIconSrc, markProviderIconMissing } from "@/shared/utils/providerIcon";
import { isLocalConnection, isLocalEmbeddingModel } from "@/lib/privacy/privacyMode";

function getProviderConfig(providerId) {
  return AI_PROVIDERS[providerId] || { color: "#6b7280", name: providerId };
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

function ChannelModule({
  provider,
  activeRequest,
  isActive,
  isLast,
  isError,
}) {
  const [imgError, setImgError] = useState(false);
  const providerId = provider.provider;
  const config = getProviderConfig(providerId);
  const label = (config.name !== providerId ? config.name : null) || provider.nodeName || provider.name || providerId;
  const imageUrl = getProviderImageUrl(providerId);
  const textIcon = config.textIcon || (providerId || "?").slice(0, 2).toUpperCase();
  const color = config.color || "#6b7280";

  const isLocal = isProviderLocal(provider);

  // Status computation strictly from real data
  let status = "READY";
  let statusBadgeVariant = "ready";
  if (isError) {
    status = "ERROR";
    statusBadgeVariant = "error";
  } else if (isActive) {
    status = "BUSY";
    statusBadgeVariant = "busy";
  } else if (isLast) {
    status = "RECENT";
    statusBadgeVariant = "recent";
  } else if (isLocal) {
    status = "LOCAL";
    statusBadgeVariant = "local";
  }

  const activeModel = activeRequest?.model || null;
  const activeAccount = activeRequest?.account || null;

  return (
    <div
      className={`channel-bay-module flex flex-col justify-between ${isActive ? "channel-bay-module-busy" : ""} ${isError ? "channel-bay-module-error" : ""}`}
      data-status={status.toLowerCase()}
    >
      <div>
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-6 h-6 rounded flex items-center justify-center shrink-0 border border-border-subtle bg-surface"
              style={{ backgroundColor: `${color}12` }}
            >
              {imageUrl && !imgError ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="w-4 h-4 rounded-xs object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={() => {
                    const m = imageUrl?.match(/^\/providers\/([^/]+)\.png$/i);
                    if (m) markProviderIconMissing(m[1]);
                    setImgError(true);
                  }}
                />
              ) : (
                <span className="text-[10px] font-bold" style={{ color }}>{textIcon}</span>
              )}
            </div>
            <span className="text-xs font-semibold text-ink truncate" title={label}>
              {label}
            </span>
          </div>

          <span
            className={`channel-bay-status channel-bay-status-${statusBadgeVariant}`}
            title={`Status: ${status}`}
          >
            <span className="channel-bay-dot" aria-hidden="true" />
            <span className="channel-bay-status-text">{status}</span>
          </span>
        </div>

        <div className="mt-2.5 flex flex-col gap-1 text-[11px]">
          {activeModel ? (
            <div className="flex items-center gap-1.5 min-w-0" title={`Model: ${activeModel}`}>
              <span className="text-muted text-[10px] font-mono shrink-0 uppercase tracking-wider">Model</span>
              <span className="font-mono text-ink truncate">{activeModel}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 text-muted">
              <span className="text-[10px] font-mono uppercase tracking-wider">State</span>
              <span className="truncate">
                {isError
                  ? "Last dispatch failed"
                  : isLast
                  ? "Dispatched recently"
                  : isLocal
                  ? "Direct local instance"
                  : "Standby route"}
              </span>
            </div>
          )}

          {activeAccount && (
            <div className="flex items-center gap-1.5 min-w-0" title={`Account: ${activeAccount}`}>
              <span className="text-muted text-[10px] font-mono shrink-0 uppercase tracking-wider">Acct</span>
              <span className="text-muted truncate font-mono">{activeAccount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ChannelModule.propTypes = {
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
  isActive: PropTypes.bool,
  isLast: PropTypes.bool,
  isError: PropTypes.bool,
};

export default function ProviderTopology({
  providers = [],
  activeRequests = [],
  lastProvider = "",
  errorProvider = "",
}) {
  const [filter, setFilter] = useState("all"); // all | active | local | errors

  const activeMap = useMemo(() => {
    const map = new Map();
    for (const req of activeRequests) {
      if (req.provider) {
        map.set(req.provider.toLowerCase(), req);
      }
    }
    return map;
  }, [activeRequests]);

  const lastKey = (lastProvider || "").toLowerCase();
  const errorKey = (errorProvider || "").toLowerCase();

  // Categorize and sort providers (active/error first)
  const categorized = useMemo(() => {
    return providers.map((p) => {
      const pId = (p.provider || "").toLowerCase();
      const activeReq = activeMap.get(pId);
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
  }, [providers, activeMap, lastKey, errorKey]);

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

  return (
    <section
      aria-label="Provider switchboard channel bay"
      className="flex min-w-0 flex-col rounded-[var(--radius-brand)] border border-border-subtle bg-chassis p-3.5 sm:p-4 shadow-soft"
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded flex items-center justify-center bg-surface border border-border-subtle text-muted shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[18px]">hub</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Channel Bay
            </h2>
            <p className="text-xs text-muted">
              Live provider topology & dispatch channels
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            aria-live="polite"
            aria-atomic="true"
            className="inline-flex items-center gap-1.5 rounded border border-border-subtle bg-surface px-2.5 py-1 text-xs font-mono font-medium text-ink shadow-xs"
          >
            <span
              className={`inline-block size-2 rounded-full ${busyCount > 0 ? "bg-signal motion-safe:animate-pulse" : "bg-muted/40"}`}
              aria-hidden="true"
            />
            <span>{busyCount > 0 ? `${busyCount} active dispatch${busyCount > 1 ? "es" : ""}` : "All idle"}</span>
          </span>
          <span className="hidden sm:inline-block text-xs font-mono text-muted border-l border-border-subtle pl-2">
            {providers.length} {providers.length === 1 ? "channel" : "channels"}
          </span>
        </div>
      </div>

      {/* Filter toolbar */}
      {providers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filter channels">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === "all"
                ? "bg-surface text-ink font-semibold border border-border-subtle shadow-xs"
                : "text-muted hover:text-ink hover:bg-surface/50"
            }`}
          >
            <span>All</span>
            <span className="font-mono text-[10px] opacity-70">({counts.all})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === "active"
                ? "bg-surface text-signal font-semibold border border-signal/40 shadow-xs"
                : "text-muted hover:text-ink hover:bg-surface/50"
            }`}
          >
            <span>Active</span>
            <span className="font-mono text-[10px] opacity-70">({counts.active})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("local")}
            className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === "local"
                ? "bg-surface text-ink font-semibold border border-border-subtle shadow-xs"
                : "text-muted hover:text-ink hover:bg-surface/50"
            }`}
          >
            <span>Local</span>
            <span className="font-mono text-[10px] opacity-70">({counts.local})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("errors")}
            className={`min-h-[44px] sm:min-h-[32px] px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filter === "errors"
                ? "bg-surface text-fail font-semibold border border-fail/40 shadow-xs"
                : "text-muted hover:text-ink hover:bg-surface/50"
            }`}
          >
            <span>Errors</span>
            <span className="font-mono text-[10px] opacity-70">({counts.errors})</span>
          </button>
        </div>
      )}

      {/* Switchboard Channel Bay Grid with capped height & internal scroll */}
      <div className="mt-3 flex-1 min-w-0">
        {providers.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-xs text-muted">
            No provider channels configured.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-xs text-muted">
            No provider channels match the selected filter.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 min-w-0">
              {filteredItems.map(({ provider, activeReq, isActive, isLast, isError }) => (
                <ChannelModule
                  key={provider.provider}
                  provider={provider}
                  activeRequest={activeReq}
                  isActive={isActive}
                  isLast={isLast}
                  isError={isError}
                />
              ))}
            </div>
          </div>
        )}
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
  lastProvider: PropTypes.string,
  errorProvider: PropTypes.string,
};
