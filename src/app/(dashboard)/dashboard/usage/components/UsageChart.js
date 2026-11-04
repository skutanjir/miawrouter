"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "@/shared/components/Card";

import { Icon } from "@/shared/components/Icon";
const fmtTokens = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
};

const fmtCost = (n) => `$${(n || 0).toFixed(4)}`;

export default function UsageChart({ period = "7d" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("tokens");

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/usage/chart?period=${period}`);
        if (res.ok && !ignore) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Failed to fetch chart data:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [period]);

  const hasData = data.some((d) => d.tokens > 0 || d.cost > 0);
  const periodTotal = data.reduce((acc, d) => acc + (viewMode === "tokens" ? (d.tokens || 0) : (d.cost || 0)), 0);
  const periodPeak = data.reduce((max, d) => Math.max(max, viewMode === "tokens" ? (d.tokens || 0) : (d.cost || 0)), 0);

  return (
    <Card
      title={viewMode === "tokens" ? "How many tokens were routed over time?" : "How did estimated cost change over time?"}
      subtitle={`Recorded totals · ${period.toUpperCase()}`}
      padding="sm"
      className="flex min-w-0 flex-col gap-3 border border-border bg-surface"
      action={
        <div className="flex flex-wrap items-center gap-2">
          {hasData && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-2/60 px-2.5 py-1 font-mono text-[11px] text-text-muted">
              <span>
                Total: <strong className="text-text-main">{viewMode === "tokens" ? fmtTokens(periodTotal) : fmtCost(periodTotal)}</strong>
              </span>
              <span>·</span>
              <span>
                Peak: <strong className="text-primary">{viewMode === "tokens" ? fmtTokens(periodPeak) : fmtCost(periodPeak)}</strong>
              </span>
            </div>
          )}
          <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-1 gap-0.5">
            <button type="button" onClick={() => setViewMode("tokens")} aria-pressed={viewMode === "tokens"} className={`min-h-[28px] rounded-md px-3 py-1 text-xs font-medium transition-colors ${viewMode === "tokens" ? "bg-surface text-text-main font-semibold border border-border-subtle shadow-2xs" : "text-text-muted hover:text-text-main hover:bg-surface/60"}`}>
              Tokens
            </button>
            <button type="button" onClick={() => setViewMode("cost")} aria-pressed={viewMode === "cost"} className={`min-h-[28px] rounded-md px-3 py-1 text-xs font-medium transition-colors ${viewMode === "cost" ? "bg-surface text-text-main font-semibold border border-border-subtle shadow-2xs" : "text-text-muted hover:text-text-main hover:bg-surface/60"}`}>
              Cost
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="h-[180px] sm:h-[260px] flex flex-col items-center justify-center gap-2 text-text-muted text-xs border border-dashed border-border-subtle rounded-xl bg-surface-2/40" role="status">
          <Icon name={"progress_activity"} className=" text-[20px] animate-spin text-primary" />
          <span>Loading recorded usage…</span>
        </div>
      ) : !hasData ? (
        <div className="h-[180px] sm:h-[260px] flex flex-col items-center justify-center gap-2 text-text-muted text-xs border border-dashed border-border-subtle rounded-xl bg-surface-2/40" role="status">
          <div className="icon-box icon-box-sm text-text-muted">
            <Icon name={"timeline"} className="text-[15px]" />
          </div>
          <span className="font-semibold text-text-main">No usage recorded for {period}</span>
          <span>Send requests through the router to populate this time-series chart.</span>
        </div>
      ) : (
        <div className="h-[180px] sm:h-[260px] w-full min-w-0 pt-1">
          <ResponsiveContainer width="100%" height="100%" aria-label="Usage over time chart">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="usageAreaCarbonGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--color-text-muted)", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
                tickLine={{ stroke: "var(--color-border)" }}
                axisLine={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-text-muted)", fontFamily: "var(--font-mono, ui-monospace, monospace)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                tickFormatter={viewMode === "tokens" ? fmtTokens : fmtCost}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  borderRadius: "10px",
                  color: "var(--color-text-main)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  boxShadow: "var(--shadow-elevated)",
                  padding: "8px 12px",
                }}
                formatter={(value, name) => name === "tokens" ? [fmtTokens(value), "Tokens"] : [fmtCost(value), "Cost"]}
                labelStyle={{ fontWeight: 600, marginBottom: "2px", color: "var(--color-text-muted)" }}
              />
              <Area
                type="monotone"
                dataKey={viewMode === "tokens" ? "tokens" : "cost"}
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#usageAreaCarbonGrad)"
                dot={false}
                activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 2, fill: "var(--color-primary)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

UsageChart.propTypes = {
  period: PropTypes.string,
};
