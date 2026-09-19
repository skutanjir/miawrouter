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
      className="telemetry-chassis-bar w-full rounded-[var(--radius-brand)] border border-border-subtle bg-surface shadow-soft"
    >
      <div className="grid grid-cols-1 divide-y divide-border-subtle min-[400px]:grid-cols-2 min-[400px]:divide-y-0 lg:grid-cols-5 lg:divide-x lg:divide-border-subtle">
        {/* Cell 1: Total Requests */}
        <div className="flex min-w-0 flex-col justify-between gap-1 p-3.5 sm:p-4 min-[400px]:border-b min-[400px]:border-r min-[400px]:border-border-subtle lg:border-b-0 lg:border-r-0">
          <span className="label text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
            Total Requests
          </span>
          <span className="metric truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">
            {fmt(stats?.totalRequests)}
          </span>
          <span className="text-[10px] text-muted truncate">
            All dispatch channels
          </span>
        </div>

        {/* Cell 2: Input Tokens */}
        <div className="flex min-w-0 flex-col justify-between gap-1 p-3.5 sm:p-4 min-[400px]:border-b min-[400px]:border-border-subtle lg:border-b-0">
          <span className="label text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
            Input Tokens
          </span>
          <span className="metric truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">
            {fmt(promptTokens)}
          </span>
          <span className="text-[10px] text-muted truncate">
            Inbound prompt volume
          </span>
        </div>

        {/* Cell 3: Cached Tokens */}
        <div className="flex min-w-0 flex-col justify-between gap-1 p-3.5 sm:p-4 min-[400px]:border-b min-[400px]:border-r min-[400px]:border-border-subtle lg:border-b-0 lg:border-r-0">
          <span className="label text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
            Cached Tokens
          </span>
          <span className="metric truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums text-signal">
            {fmt(cachedTokens)}
          </span>
          <span className="text-[10px] font-mono font-medium text-signal truncate">
            {cachedRatio}% cache ratio
          </span>
        </div>

        {/* Cell 4: Output Tokens */}
        <div className="flex min-w-0 flex-col justify-between gap-1 p-3.5 sm:p-4 min-[400px]:border-b min-[400px]:border-border-subtle min-[400px]:border-b-0 lg:border-b-0">
          <span className="label text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
            Output Tokens
          </span>
          <span className="metric truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">
            {fmt(stats?.totalCompletionTokens)}
          </span>
          <span className="text-[10px] text-muted truncate">
            Outbound completions
          </span>
        </div>

        {/* Cell 5: Est. Cost */}
        <div className="flex min-w-0 flex-col justify-between gap-1 p-3.5 sm:p-4 min-[400px]:col-span-2 lg:col-span-1 min-[400px]:border-t min-[400px]:border-border-subtle lg:border-t-0">
          <span className="label text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-muted">
            Est. Cost
          </span>
          <span className="metric truncate font-mono text-xl sm:text-2xl font-semibold tabular-nums text-ink">
            ~{fmtCost(stats?.totalCost)}
          </span>
          <span className="text-[10px] text-muted truncate">
            Estimated, non-billed
          </span>
        </div>
      </div>
    </section>
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
