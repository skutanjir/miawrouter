"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import Card from "@/shared/components/Card";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { num, fmt, fmtBytes, pctOf, mergeServerStats } from "./cacheStatsUtils";

import { Icon } from "@/shared/components/Icon";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

const POLL_MS = 30_000; // background poll to keep stats fresh
const STORAGE_KEY = "miawrouter.cacheStatsPanel.v1";

const LAYER_META = {
  L0: { name: "Provider prompt cache", note: "reported by the provider" },
  L1: { name: "Local exact match", note: "in-memory response cache" },
  L2: { name: "Local semantic", note: "embedding-based reuse" },
  L3: { name: "Content dedup", note: "references, not a cache hit" },
};

function storageKey(period) {
  return `${STORAGE_KEY}.${period}`;
}

function loadPersisted(period) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(period));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistStats(period, stats) {
  if (typeof window === "undefined" || !stats) return;
  try {
    sessionStorage.setItem(storageKey(period), JSON.stringify(stats));
  } catch {
    // best-effort
  }
}

function RateBar({ pct, tone = "primary" }) {
  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      role="img"
      aria-label={pct === null ? "no data" : `${pct}% of recorded attempts`}
    >
      {pct !== null && (
        <span className={tone === "primary" ? "bg-primary" : "bg-warning"} style={{ width: `${pct}%` }} aria-hidden="true" />
      )}
    </div>
  );
}

function LayerCard({ meta, hits, total, sub, rateLabel, title }) {
  const pct = pctOf(hits, total);
  return (
    <div
      className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-border-subtle bg-surface-2/40 p-3"
      title={title}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-text-main">{meta.name}</span>
        <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-text-main">
          {pct === null ? "—" : `${pct}%`}
        </span>
      </div>
      <span className="text-xs text-text-muted">{meta.note} · {rateLabel}</span>
      <RateBar pct={pct} />
      <span className="truncate font-mono text-xs tabular-nums text-text-muted">{sub}</span>
    </div>
  );
}

export default function CacheStatsPanel({ period: periodProp, setPeriod: setPeriodProp }) {
  const [periodLocal, setPeriodLocal] = useState(periodProp || "7d");
  const setPeriod = setPeriodProp ?? setPeriodLocal;
  const activePeriod = periodProp ?? periodLocal;

  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate from sessionStorage on mount (once)
  useEffect(() => {
    if (hydratedRef.current) return;
    const stored = loadPersisted(activePeriod);
    if (stored) {
      setStats(stored);
      setStatus("ready");
    }
    hydratedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist stats whenever they change
  useEffect(() => {
    if (!hydratedRef.current) return;
    persistStats(activePeriod, stats);
  }, [activePeriod, stats]);

  // Fetch from server; merge into existing stats so live counters don't drop.
  // Uses functional updater so we never need `stats` in the dependency array.
  const fetchStats = useCallback(async ({ showRefresh = false } = {}) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/cache/stats?period=${activePeriod}`, { cache: "no-store" });
      const data = res.ok ? await res.json() : null;
      if (data) {
        setStats((prev) => mergeServerStats(prev, data));
        setStatus("ready");
      } else {
        // Only show error if we have no existing data at all
        setStatus((prev) => (prev === "ready" ? "ready" : "error"));
        setError("Cache metrics are not available yet.");
      }
    } catch {
      setStatus((prev) => (prev === "ready" ? "ready" : "error"));
      setError("Failed to load cache metrics.");
    } finally {
      setRefreshing(false);
    }
  }, [activePeriod]);

  // Initial load + on period/retry change
  useEffect(() => {
    // If we already hydrated valid data for this period, skip the loading state
    const stored = loadPersisted(activePeriod);
    if (stored && retryKey === 0) {
      setStats(stored);
      setStatus("ready");
      // Still fetch fresh data in the background
      fetchStats();
    } else {
      setStatus("loading");
      setStats(null);
      fetchStats();
    }
  }, [activePeriod, retryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background poll to keep stats fresh
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      fetchStats();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [fetchStats]);

  // Subscribe to cache SSE events — trigger a refresh when cache activity arrives
  useEffect(() => {
    let debounceTimer = null;
    const es = new EventSource("/api/events?type=cache");
    es.onmessage = () => {
      // Debounce: multiple events may arrive in bursts
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchStats(), 2000);
    };
    es.onerror = () => {
      // EventSource will auto-reconnect; no action needed
    };
    return () => {
      es.close();
      clearTimeout(debounceTimer);
    };
  }, [fetchStats]);

  const layers = stats?.layers || {};
  const ctx = stats?.context || {};
  const timeline = Array.isArray(stats?.timeline) ? stats.timeline : [];

  const l0 = layers.L0 || {};
  const l1 = layers.L1 || {};
  const l2 = layers.L2 || {};
  const l3 = layers.L3 || {};

  const l0Hits = num(l0.hits);
  const l0Probes = num(l0.probes);
  const l1Hits = num(l1.hits);
  const l1Attempts = num(l1.attempts);
  const l2Hits = num(l2.hits);
  const l2Attempts = num(l2.attempts);
  const l3Refs = num(l3.refs);
  const l3Bytes = num(l3.bytesSaved);

  const requests = num(ctx.requests);
  const bypassed = num(ctx.bypassed);
  const dispatched = num(ctx.dispatched);
  const reasons = ctx.bypassReasons && typeof ctx.bypassReasons === "object" ? ctx.bypassReasons : {};

  const hasAny =
    (l0Hits !== null && l0Probes !== null) ||
    l1Hits !== null ||
    l2Hits !== null ||
    l3Refs !== null ||
    requests !== null ||
    timeline.length > 0;

  const hasTimeline = timeline.some((t) => Number(t.hits) > 0 || Number(t.misses) > 0 || Number(t.providerHits) > 0);

  const chartData = timeline.map((t) => ({
    label: t.label ?? "",
    "Local hits": num(t.hits) ?? 0,
    Misses: num(t.misses) ?? 0,
    "Provider reads": num(t.providerHits) ?? 0,
  }));

  const handleManualRefresh = () => {
    fetchStats({ showRefresh: true });
  };

  return (
    <Card
      title="Cache stats"
      subtitle={`Hit rates and provider cache reads · ${activePeriod}`}
      icon="database"
      padding="sm"
      action={
        <div className="flex items-center gap-2">
          <SegmentedControl
            ariaLabel="Cache stats period"
            options={PERIODS}
            value={activePeriod}
            onChange={setPeriod}
            size="sm"
          />
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-main transition-colors hover:bg-surface-2 disabled:opacity-50"
            aria-label="Refresh cache stats"
            title="Refresh now"
          >
            <Icon name={refreshing ? "progress_activity" : "refresh"} className={`text-[14px] ${refreshing ? "animate-spin" : ""}`} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      }
    >
      {status === "loading" && (
        <div className="flex h-40 items-center justify-center text-sm text-text-muted" role="status" aria-live="polite">
          Loading cache stats…
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-[10px] border border-danger/35 bg-danger/5 p-6 text-sm text-danger"
        >
          <span>{error}</span>
          <span className="text-xs text-text-muted">
            The endpoint /api/cache/stats did not answer. Retry, or check that the router is running.
          </span>
          <button
            type="button"
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-md border border-border px-3 py-1 text-xs font-medium text-text-main transition-colors hover:bg-surface-2"
          >
            Retry
          </button>
        </div>
      )}
      {status === "ready" && !hasAny && (
        <div
          className="flex h-24 items-center justify-center rounded-[10px] border border-border-subtle bg-surface-2/40 p-4 text-center text-sm text-text-muted"
          role="status"
        >
          No cache activity recorded in this period. Numbers appear after the first cached request.
        </div>
      )}
      {status === "ready" && hasAny && (
        <div className="flex flex-col gap-5" role="group" aria-label="Cache hit/miss stats">
          {/* Layer hit rates */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <LayerCard
              meta={LAYER_META.L0}
              hits={l0Hits ?? 0}
              total={l0Probes ?? 0}
              rateLabel="hit rate"
              title={`L0: ${fmt(l0Hits ?? 0)} provider-confirmed cache hits out of ${fmt(l0Probes ?? 0)} probes; ${fmtBytes(num(l0.readTokens) ?? 0)} cache_read tokens`}
              sub={`${fmt(l0Hits ?? 0)} hits / ${fmt(l0Probes ?? 0)} probes · ${fmtBytes(num(l0.readTokens) ?? 0)} read`}
            />
            <LayerCard
              meta={LAYER_META.L1}
              hits={l1Hits ?? 0}
              total={l1Attempts ?? 0}
              rateLabel="hit rate"
              title="L1 exact-match response cache: hits out of attempts"
              sub={`${fmt(l1Hits ?? 0)} / ${fmt(l1Attempts ?? 0)} attempts`}
            />
            <LayerCard
              meta={LAYER_META.L2}
              hits={l2Hits ?? 0}
              total={l2Attempts ?? 0}
              rateLabel="hit rate"
              title="L2 semantic response cache: hits out of attempts"
              sub={`${fmt(l2Hits ?? 0)} / ${fmt(l2Attempts ?? 0)} attempts`}
            />
            <div
              className="flex min-w-0 flex-col gap-1.5 rounded-[10px] border border-border-subtle bg-surface-2/40 p-3"
              title="L3 content-address dedup — activity and bytes saved, not a provider cache hit"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-text-main">{LAYER_META.L3.name}</span>
                <span className="shrink-0 font-mono text-lg font-semibold tabular-nums text-text-main">
                  {fmt(l3Refs ?? 0)}
                </span>
              </div>
              <span className="text-xs text-text-muted">{LAYER_META.L3.note} · references</span>
              <div className="flex h-1.5 w-full rounded-full bg-surface-2" aria-hidden="true" />
              <span className="truncate font-mono text-xs tabular-nums text-text-muted">
                {fmtBytes(l3Bytes ?? 0)} saved
              </span>
            </div>
          </div>

          {/* Context / bypass */}
          <div
            className="flex flex-col gap-1.5 rounded-[10px] border border-border-subtle bg-surface-2/40 p-3"
            role="group"
            aria-label="Cache bypass and dispatch context"
          >
            <span className="text-[13px] font-medium text-text-main">Request context</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="font-mono text-xs tabular-nums text-text-muted">
                evaluated <span className="font-medium text-text-main">{fmt(requests ?? 0)}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-text-muted">
                bypassed <span className="font-medium text-warning">{fmt(bypassed ?? 0)}</span>
              </span>
              <span className="font-mono text-xs tabular-nums text-text-muted">
                dispatched <span className="font-medium text-primary">{fmt(dispatched ?? 0)}</span>
              </span>
            </div>
            {Object.keys(reasons).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-text-muted">Bypass reasons:</span>
                {Object.entries(reasons).map(([reason, count]) => (
                  <span
                    key={reason}
                    className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 font-mono text-xs tabular-nums text-text-muted"
                  >
                    {reason} · {fmt(num(count) ?? 0)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-main">Hits, misses and provider cache reads over time</span>
            {!hasTimeline ? (
              <p className="rounded-[10px] border border-border-subtle bg-surface-2/40 p-3 text-xs text-text-muted" role="status">
                No per-bucket timeline recorded for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260} aria-label="Cache hits, misses and provider cache reads over time">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.5 }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "10px",
                      color: "var(--color-text-main)",
                      fontSize: "12px",
                      boxShadow: "var(--shadow-elevated)",
                    }}
                    formatter={(value, name) => [fmt(Number(value) || 0), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Local hits" stackId="a" fill="var(--color-primary)" />
                  <Bar dataKey="Misses" stackId="a" fill="var(--color-border)" />
                  <Bar dataKey="Provider reads" stackId="a" fill="var(--color-warning)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <p className="text-xs text-text-muted">
            L1/L2 are local response-cache hits; L0 is provider-confirmed cache_read usage — token
            savings at the provider level; L3 dedup is activity, not a cache hit. Hit rates are
            computed from recorded attempts only.
          </p>
        </div>
      )}
    </Card>
  );
}
