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

  return (
    <Card
      title={viewMode === "tokens" ? "Token throughput" : "Estimated cost"}
      subtitle={`Cumulative ${viewMode === "tokens" ? "volume" : "spend"} over time · ${period}`}
      padding="sm"
      className="flex min-w-0 flex-col gap-3 border border-border-subtle bg-surface shadow-soft"
      action={
        <div className="inline-flex items-center rounded-md border border-rule bg-bg-subtle p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("tokens")}
            className={`min-h-[44px] sm:min-h-[30px] rounded px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "tokens"
                ? "bg-surface text-ink shadow-xs font-semibold"
                : "text-muted hover:text-ink hover:bg-surface-2"
            }`}
          >
            Tokens
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cost")}
            className={`min-h-[44px] sm:min-h-[30px] rounded px-3 py-1 text-xs font-medium transition-colors ${
              viewMode === "cost"
                ? "bg-surface text-ink shadow-xs font-semibold"
                : "text-muted hover:text-ink hover:bg-surface-2"
            }`}
          >
            Cost
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="h-[160px] sm:h-[256px] flex flex-col items-center justify-center gap-2 text-muted text-xs border border-dashed border-border-subtle rounded-md bg-surface-2/40" role="status">
          <span className="material-symbols-outlined text-[20px] animate-spin text-signal">progress_activity</span>
          <span>Sampling precision telemetry…</span>
        </div>
      ) : !hasData ? (
        <div className="h-[160px] sm:h-[256px] flex flex-col items-center justify-center gap-1.5 text-muted text-xs border border-dashed border-border-subtle rounded-md bg-surface-2/30" role="status">
          <span className="material-symbols-outlined text-[22px] opacity-40">timeline</span>
          <span>No dispatch data recorded for {period}</span>
        </div>
      ) : (
        <div className="h-[160px] sm:h-[256px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%" aria-label="Usage over time chart">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="chassisSignalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-signal)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-signal)" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="2 2"
                stroke="var(--color-rule)"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--color-muted)", fontFamily: "ui-monospace, monospace" }}
                tickLine={{ stroke: "var(--color-rule)" }}
                axisLine={{ stroke: "var(--color-rule)", strokeWidth: 1 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--color-muted)", fontFamily: "ui-monospace, monospace" }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-rule)", strokeWidth: 1 }}
                tickFormatter={viewMode === "tokens" ? fmtTokens : fmtCost}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-panel, var(--color-surface))",
                  borderColor: "var(--color-rule, var(--color-border))",
                  borderRadius: "var(--radius-brand, 8px)",
                  color: "var(--color-ink, var(--color-text-main))",
                  fontSize: "11px",
                  fontFamily: "ui-monospace, monospace",
                  boxShadow: "var(--shadow-elevated)",
                  padding: "6px 10px",
                }}
                formatter={(value, name) =>
                  name === "tokens" ? [fmtTokens(value), "Tokens"] : [fmtCost(value), "Cost"]
                }
                labelStyle={{ fontWeight: 600, marginBottom: "2px", color: "var(--color-muted)" }}
              />
              <Area
                type="monotone"
                dataKey={viewMode === "tokens" ? "tokens" : "cost"}
                stroke="var(--color-signal)"
                strokeWidth={1.5}
                fill="url(#chassisSignalFill)"
                dot={false}
                activeDot={{ r: 3.5, stroke: "var(--color-panel, #fff)", strokeWidth: 1.5, fill: "var(--color-signal)" }}
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
