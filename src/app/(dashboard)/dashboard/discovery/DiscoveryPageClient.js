"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, CardSkeleton } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

const API_URL = "/api/discovery";

const TYPE_META = {
  provider: { icon: "dns", variant: "primary", label: "Provider" },
  model: { icon: "model", variant: "info", label: "Model" },
  agent: { icon: "smart_toy", variant: "success", label: "Agent" },
  skill: { icon: "extension", variant: "warning", label: "Skill" },
  endpoint: { icon: "api", variant: "default", label: "Endpoint" },
};

function resolveLink(item) {
  if (item.type === "provider" && item.id) return `/dashboard/providers/${item.id}`;
  if (item.type === "skill") return "/dashboard/agent-skills";
  if (item.type === "endpoint") return "/dashboard/api-endpoints";
  if (item.type === "agent") return "/dashboard/cloud-agents";
  return null;
}

function SourceStatuses({ sources }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map((s) => {
        const isUp = s.status === "available";
        return (
          <div
            key={s.id}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${
              isUp
                ? "bg-success/5 border-success/20 text-success"
                : "bg-danger/5 border-danger/20 text-danger"
            }`}
          >
            <Icon name={isUp ? "check_circle" : "error"} className="text-[12px]" />
            <span className="font-semibold">{s.id}</span>
            {isUp ? (
              <span className="text-text-muted font-mono">({s.count})</span>
            ) : (
              <span className="truncate">{s.error || "Unavailable"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DiscoveryPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState(null);
  const debounceRef = useRef(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const load = useCallback(async (searchQuery, type) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("query", searchQuery.slice(0, 100));
      if (type) params.set("type", type);
      const url = `${API_URL}?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load discovery data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(debouncedQuery, typeFilter);
  }, [load, debouncedQuery, typeFilter]);

  const items = data?.items || [];
  const counts = data?.counts || {};
  const sources = data?.sources || [];

  const types = ["provider", "model", "agent", "skill", "endpoint"];

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="explore" className="text-primary text-[24px]" />
            Unified Discovery
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Search across registered providers, models, local and cloud agents, skills, and endpoints.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => load(debouncedQuery, typeFilter)}
          disabled={loading}
          icon="refresh"
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card className="border-danger/30 text-xs text-danger" padding="sm">
          {error}
        </Card>
      )}

      {/* ── Summary Stats ────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="explore" className="text-[16px]" />
            <span>Total Entities</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : counts.total ?? items.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">indexed across system</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="hub" className="text-[16px]" />
            <span>Active Sources</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : sources.filter((s) => s.status === "available").length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">of {sources.length} sources online</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="category" className="text-[16px]" />
            <span>Categories</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : Object.keys(counts.byType || {}).filter((k) => (counts.byType[k] ?? 0) > 0).length || types.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">providers, models, agents, skills</p>
        </div>
      </div>

      {/* ── Source Statuses ───────────────────────────────────────── */}
      <SourceStatuses sources={sources} />

      {/* ── Toolbar: Search + Filter Pills ────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Search across all capabilities…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={100}
              className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs font-sans"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} className="text-text-muted hover:text-text-main cursor-pointer">
                <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border overflow-x-auto text-xs">
          <button
            onClick={() => setTypeFilter(null)}
            className={`px-3 py-1 rounded transition-colors cursor-pointer font-medium whitespace-nowrap ${
              !typeFilter
                ? "bg-surface text-text-main font-semibold shadow-xs"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            All ({counts.total ?? items.length})
          </button>
          {types.map((t) => {
            const count = counts[t] ?? counts.byType?.[t] ?? 0;
            const meta = TYPE_META[t];
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                className={`px-3 py-1 rounded transition-colors cursor-pointer font-medium whitespace-nowrap flex items-center gap-1 ${
                  typeFilter === t
                    ? "bg-surface text-text-main font-semibold shadow-xs"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <Icon name={meta.icon} className="text-[12px]" />
                <span>{meta.label}</span>
                <span className="font-mono text-[10px] text-text-muted">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Searchable Catalog List ──────────────────────────────── */}
      {loading ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <Card padding="md">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Icon name="search_off" className="text-[32px] text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-main">
              {debouncedQuery ? `No results for "${debouncedQuery}"` : "No discovery entities available"}
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Try adjusting your search terms or clearing the type filter.
            </p>
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {items.map((item, i) => {
            const meta = TYPE_META[item.type] || TYPE_META.endpoint;
            const link = resolveLink(item);

            const Content = (
              <div className="flex items-start justify-between gap-4 p-3.5 hover:bg-surface-2/60 transition-colors cursor-pointer group">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="size-8 rounded-md bg-surface-2 border border-border-subtle flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name={meta.icon} className="text-primary text-[16px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xs font-semibold text-text-main truncate">
                        {item.name || item.id}
                      </h2>
                      <Badge variant={meta.variant} size="sm">
                        {meta.label}
                      </Badge>
                      {item.status && item.status !== "available" && (
                        <Badge variant="warning" size="sm" dot>
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-text-muted">
                      {item.id && item.id !== item.name && (
                        <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle">
                          {item.id}
                        </code>
                      )}
                      {item.source && (
                        <span>via {item.source}</span>
                      )}
                      {item.path && (
                        <code className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle">
                          {item.path}
                        </code>
                      )}
                      {item.provider && (
                        <span>provider: {item.provider}</span>
                      )}
                    </div>
                  </div>
                </div>

                {link && (
                  <div className="shrink-0 flex items-center pt-1 text-text-muted group-hover:text-primary transition-colors">
                    <Icon name="arrow_forward" className="text-[16px]" />
                  </div>
                )}
              </div>
            );

            return link ? (
              <Link key={`${item.type}-${item.id}-${i}`} href={link} className="block">
                {Content}
              </Link>
            ) : (
              <div key={`${item.type}-${item.id}-${i}`}>
                {Content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
