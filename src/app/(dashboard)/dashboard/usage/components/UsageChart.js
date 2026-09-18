"use client";

import { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/usage/chart?period=${period}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to fetch chart data:", e);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData = data.some((d) => d.tokens > 0 || d.cost > 0);

  return (
    <Card
      title={viewMode === "tokens" ? "Token throughput" : "Estimated cost"}
      subtitle={`Cumulative ${viewMode === "tokens" ? "volume" : "spend"} over time · ${period}`}
      padding="sm"
      className="flex min-w-0 flex-col gap-3"
      action={
        <div className="inline-flex items-center rounded-md border border-rule bg-bg-subtle p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("tokens")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "tokens"
                ? "bg-surface text-ink shadow-xs"
                : "text-muted hover:text-ink hover:bg-surface-2"
            }`}
          >
            Tokens
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cost")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "cost"
                ? "bg-surface text-ink shadow-xs"
                : "text-muted hover:text-ink hover:bg-surface-2"
            }`}
          >
            Cost
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="h-64 flex items-center justify-center text-muted text-xs" role="status">
          Loading chart…
        </div>
      ) : !hasData ? (
        <div className="h-64 flex items-center justify-center text-muted text-xs" role="status">
          No data recorded for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260} aria-label="Usage over time chart">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-signal)" stopOpacity={0.22} />
                <stop offset="95%" stopColor="var(--color-signal)" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-signal)" stopOpacity={0.22} />
                <stop offset="95%" stopColor="var(--color-signal)" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.12} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.55 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "currentColor", fillOpacity: 0.55 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={viewMode === "tokens" ? fmtTokens : fmtCost}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-panel, var(--color-surface))",
                borderColor: "var(--color-rule, var(--color-border))",
                borderRadius: "var(--radius-brand, 8px)",
                color: "var(--color-ink, var(--color-text-main))",
                fontSize: "12px",
                boxShadow: "var(--shadow-elevated)",
              }}
              formatter={(value, name) =>
                name === "tokens" ? [fmtTokens(value), "Tokens"] : [fmtCost(value), "Cost"]
              }
            />
            {viewMode === "tokens" ? (
              <Area
                type="monotone"
                dataKey="tokens"
                stroke="var(--color-signal)"
                strokeWidth={1.75}
                fill="url(#gradTokens)"
                dot={false}
                activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 1.5 }}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="cost"
                stroke="var(--color-signal)"
                strokeWidth={1.75}
                fill="url(#gradCost)"
                dot={false}
                activeDot={{ r: 4, stroke: "var(--color-surface)", strokeWidth: 1.5 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

UsageChart.propTypes = {
  period: PropTypes.string,
};
