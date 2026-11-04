"use client";

import { useState, useEffect } from "react";
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

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

const fmt = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};
const fmtBytes = (n) => {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// estimate: savings require bytes/context → token conversion. reported: deltas measured end to end.
const STAGES = [
  { id: "caveman", label: "Caveman", note: "system inject", estimate: false, badge: "reported" },
  { id: "ponytail", label: "Ponytail", note: "system inject", estimate: false, badge: "reported" },
  { id: "rtk", label: "RTK", note: "tool_result", estimate: true, badge: "est." },
  { id: "headroom", label: "Headroom", note: "proxy", estimate: false, badge: "proxy" },
  { id: "pxpipe", label: "PXPIPE", note: "image ctx", estimate: true, badge: "est." },
  { id: "l0", label: "L0 Prompt Cache", note: "auto-prefix", estimate: false, badge: "prompt" },
  { id: "l1", label: "L1 Exact Cache", note: "memory lru", estimate: false, badge: "reported" },
  { id: "l2", label: "L2 Semantic Cache", note: "vector reuse", estimate: false, badge: "semantic" },
  { id: "l3", label: "L3 Content Dedup", note: "ref replacement", estimate: true, badge: "est." },
];

function pctOf(saved, total) {
  if (!(total > 0)) return null;
  return Math.round((saved / total) * 100);
}

const BADGE_TITLE = (meta) =>
  meta.estimate
    ? "Estimated: bytes/context converted to tokens"
    : meta.badge === "proxy"
      ? "Proxy-reported token counts"
      : "Measured end-to-end deltas";

function StageRow({ meta, st, maxSaved }) {
  const tokensBefore = num(st?.tokensBefore);
  const tokensAfter = num(st?.tokensAfter);
  const bytesBefore = num(st?.bytesBefore);
  const bytesAfter = num(st?.bytesAfter);
  const hits = num(st?.hits);
  const requests = num(st?.requests);
  const recordedSavings = num(st?.savings);

  // Prefer token deltas; fall back to bytes (RTK) — unit is shown explicitly.
  const hasTokens = tokensBefore !== null && tokensAfter !== null;
  const hasBytes = bytesBefore !== null && bytesAfter !== null;
  const before = hasTokens ? tokensBefore : bytesBefore;
  const after = hasTokens ? tokensAfter : bytesAfter;
  const unit = hasTokens ? "tok" : "B";
  const saved = recordedSavings !== null
    ? recordedSavings
    : before !== null && after !== null ? Math.max(0, before - after) : null;
  const pct = saved !== null && before !== null && before > 0 ? Math.round((saved / before) * 100) : null;
  const ofTotal = pctOf(saved, maxSaved);
  const showSaved = (n) => (unit === "B" ? fmtBytes(n) : fmt(n));

  const parts = [];
  if (requests !== null) parts.push(`${fmt(requests)} req`);
  if (hits !== null) parts.push(`${fmt(hits)} hits`);
  const metaLine = parts.join(" · ") || meta.note;

  return (
    <tr className="border-b border-border-subtle last:border-b-0">
      <td className="px-3 py-2.5 align-top">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-text-main">{meta.label}</span>
            <span
              className={`rounded-md border px-1.5 py-px font-mono text-[10px] ${
                meta.estimate ? "border-warning/40 bg-warning/10 text-warning" : "border-border-subtle bg-surface-2 text-text-muted"
              }`}
              title={BADGE_TITLE(meta)}
            >
              {meta.badge}
            </span>
          </span>
          <span className="text-xs text-text-muted">{metaLine}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        {before === null || after === null ? (
          <span className="text-[13px] text-text-muted">No savings recorded</span>
        ) : (
          <span className="font-mono text-[13px] font-medium tabular-nums text-text-main">
            {saved !== null ? `−${showSaved(saved)} ${unit}` : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 align-top font-mono text-[13px] tabular-nums text-text-muted">
        {pct !== null ? `−${pct}%` : "—"}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex min-w-[8rem] items-center gap-2">
          <div
            className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"
            role="img"
            aria-label={
              saved !== null ? `${meta.label}: ${showSaved(saved)} ${unit} saved` : `${meta.label}: no savings`
            }
          >
            {saved !== null && ofTotal !== null && (
              <span
                className={meta.estimate ? "bg-warning" : "bg-primary"}
                style={{ width: `${ofTotal}%` }}
                aria-hidden="true"
              />
            )}
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
            {ofTotal !== null ? `${ofTotal}%` : "—"}
          </span>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top font-mono text-xs tabular-nums text-text-muted">
        {before === null || after === null ? "—" : `${showSaved(before)} → ${showSaved(after)}`}
      </td>
    </tr>
  );
}

export default function TokenSaverStatsPanel({ period: periodProp, setPeriod: setPeriodProp }) {
  const [periodLocal, setPeriodLocal] = useState(periodProp || "7d");
  const setPeriod = setPeriodProp ?? setPeriodLocal;
  const activePeriod = periodProp ?? periodLocal;
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | error | ready
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/saver/stats?period=${activePeriod}`, { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (data) {
          setStats(data);
          setStatus("ready");
        } else {
          setStatus("error");
          setError("Token-saver metrics are not available yet.");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setError("Failed to load token-saver metrics.");
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activePeriod, retryKey]);

  const stages = stats?.stages || {};
  const provider = stats?.provider || {};
  const totals = stats?.totals || {};
  const timeline = Array.isArray(stats?.timeline) ? stats.timeline : [];
  const dispatched = num(provider.dispatched);

  // Per-stage saved values in a common unit (tokens; bytes for RTK without token deltas).
  const savedOf = (meta) => {
    const st = stages[meta.id];
    if (!st) return null;
    if (num(st.savings) !== null) return num(st.savings);
    const tb = num(st.tokensBefore);
    const ta = num(st.tokensAfter);
    if (tb !== null && ta !== null) return Math.max(0, tb - ta);
    const bb = num(st.bytesBefore);
    const ba = num(st.bytesAfter);
    return bb !== null && ba !== null ? Math.max(0, bb - ba) : null;
  };
  const savedAll = STAGES.map((m) => savedOf(m)).filter((v) => v !== null);
  const maxSaved = savedAll.length ? Math.max(...savedAll) : null;

  const savedTokens = num(totals.savedTokens);
  const estimatedTokens = num(totals.estimatedTokens);
  const hasAny = savedAll.length > 0 || dispatched !== null || timeline.length > 0;
  const hasTimeline = timeline.some((t) => Number(t.savedTokens) > 0 || Number(t.estimated) > 0);

  const chartData = timeline.map((t) => ({
    label: t.label ?? "",
    Reported: num(t.savedTokens) ?? 0,
    Estimated: num(t.estimated) ?? 0,
  }));

  return (
    <Card
      title="Token saver savings"
      subtitle={`Savings by stage · ${activePeriod}`}
      icon="token"
      padding="sm"
      action={
        <SegmentedControl
          ariaLabel="Token saver period"
          options={PERIODS}
          value={activePeriod}
          onChange={setPeriod}
          size="sm"
        />
      }
    >
      {status === "loading" && (
        <div className="flex h-40 items-center justify-center text-sm text-text-muted" role="status" aria-live="polite">
          Loading token-saver stats…
        </div>
      )}
      {status === "error" && (
        <div
          role="alert"
          className="flex flex-col items-center gap-2 rounded-[10px] border border-danger/35 bg-danger/5 p-6 text-sm text-danger"
        >
          <span>{error}</span>
          <span className="text-center text-xs text-text-muted">
            /api/saver/stats did not answer. Retry, or check that the router is running.
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
          No token-saver activity recorded in this period. Send a request through a saver stage to see
          numbers here.
        </div>
      )}
      {status === "ready" && hasAny && (
        <div className="flex flex-col gap-5" role="group" aria-label="Token-saver savings by stage">
          {/* Weighted totals */}
          <dl className="grid gap-3 rounded-[10px] border border-border-subtle bg-surface-2/40 p-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-text-muted">Saved tokens</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-primary">
                {savedTokens !== null ? `−${fmt(savedTokens)}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Of which estimated</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-warning">
                {estimatedTokens !== null ? fmt(estimatedTokens) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Provider-dispatched requests</dt>
              <dd className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-text-main">
                {dispatched !== null ? fmt(dispatched) : "—"}
              </dd>
            </div>
          </dl>

          {/* Per-stage savings */}
          <div className="overflow-x-auto rounded-[10px] border border-border-subtle">
            <table className="w-full min-w-[44rem] border-collapse text-left" aria-label="Token savings by stage">
              <thead>
                <tr className="border-b border-border text-[13px] text-text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Stage</th>
                  <th scope="col" className="px-3 py-2 font-medium">Saved</th>
                  <th scope="col" className="px-3 py-2 font-medium">Reduction</th>
                  <th scope="col" className="px-3 py-2 font-medium">Share of largest stage</th>
                  <th scope="col" className="px-3 py-2 font-medium">Before → after</th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((meta) => (
                  <StageRow key={meta.id} meta={meta} st={stages[meta.id]} maxSaved={maxSaved} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Timeline */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] font-medium text-text-main">Reported and estimated savings over time</span>
            {!hasTimeline ? (
              <p className="rounded-[10px] border border-border-subtle bg-surface-2/40 p-3 text-xs text-text-muted" role="status">
                No per-bucket timeline recorded for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200} aria-label="Token savings over time, reported and estimated">
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
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "10px",
                      color: "var(--color-text-main)",
                      fontSize: "12px",
                    }}
                    formatter={(value, name) => [fmt(Number(value) || 0), name]}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="Reported" stackId="s" fill="var(--color-primary)" />
                  <Bar dataKey="Estimated" stackId="s" fill="var(--color-warning)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <p className="text-xs text-text-muted">
            RTK, PXPIPE and L3 savings are estimates (bytes or context converted to tokens); Headroom
            and L2 counts are proxy-reported. Savings are counted only for provider-dispatched
            requests — requests answered by the cache are excluded.
          </p>
        </div>
      )}
    </Card>
  );
}
