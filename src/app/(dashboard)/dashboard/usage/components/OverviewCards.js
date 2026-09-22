"use client";

import PropTypes from "prop-types";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

export default function OverviewCards({ stats }) {
  const promptTokens = stats?.totalPromptTokens || 0;
  const cachedTokens = stats?.totalCachedTokens || 0;
  const cachedRatio = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : "0.0";

  return (
    <section
      aria-label="Usage overview totals"
      className="panel-lift w-full overflow-hidden rounded-[var(--radius-brand)] border border-border bg-surface"
    >
      <div className="grid grid-cols-2 gap-px bg-border-subtle sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Requests" value={fmt(stats?.totalRequests)} hint="This period" />
        <Metric label="Input" value={fmt(promptTokens)} hint="Prompt tokens" />
        <Metric
          label="Cached"
          value={fmt(cachedTokens)}
          hint={`${cachedRatio}% of input`}
          accent
          ratio={promptTokens > 0 ? cachedTokens / promptTokens : 0}
        />
        <Metric label="Output" value={fmt(stats?.totalCompletionTokens)} hint="Completion tokens" />
        <Metric label="Est. cost" value={fmtCost(stats?.totalCost)} hint="Not a bill" className="col-span-2 sm:col-span-1" />
      </div>
    </section>
  );
}

function Metric({ label, value, hint, accent = false, ratio = null, className = "" }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 bg-surface px-3.5 py-3 ${className}`}>
      <span className="text-[11px] text-muted">{label}</span>
      <span className={`truncate font-mono text-xl font-semibold tabular-nums ${accent ? "text-signal" : "text-ink"}`}>
        {value}
      </span>
      {ratio !== null ? (
        <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-border-subtle" aria-hidden="true">
          <span className="block h-full bg-signal" style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }} />
        </span>
      ) : null}
      <span className="truncate text-[11px] text-muted">{hint}</span>
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.shape({
    totalRequests: PropTypes.number,
    totalPromptTokens: PropTypes.number,
    totalCachedTokens: PropTypes.number,
    totalCompletionTokens: PropTypes.number,
    totalCost: PropTypes.number,
  }),
};
