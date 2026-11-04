"use client";

import PropTypes from "prop-types";
import { Icon } from "@/shared/components/Icon";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

export default function OverviewCards({ stats }) {
  const totalRequests = stats?.totalRequests || 0;
  const promptTokens = stats?.totalPromptTokens || 0;
  const cachedTokens = stats?.totalCachedTokens || 0;
  const outputTokens = stats?.totalCompletionTokens || 0;
  const uncachedInput = Math.max(0, promptTokens - cachedTokens);
  const totalTokens = promptTokens + outputTokens;

  const cachedRatio = promptTokens > 0 ? ((cachedTokens / promptTokens) * 100).toFixed(1) : "0.0";
  const avgTokensPerReq = totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;

  const cachedShare = totalTokens > 0 ? Math.round((cachedTokens / totalTokens) * 100) : 0;
  const uncachedShare = totalTokens > 0 ? Math.round((uncachedInput / totalTokens) * 100) : 0;
  const outputShare = totalTokens > 0 ? Math.max(0, 100 - cachedShare - uncachedShare) : 0;

  return (
    <section aria-label="Usage overview totals" className="w-full flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <Metric
          label="Requests"
          icon="analytics"
          value={fmt(totalRequests)}
          badge={totalRequests > 0 ? `${fmt(avgTokensPerReq)} tok/req` : "Idle"}
          hint="Total dispatched"
        />
        <Metric
          label="Input"
          icon="input"
          value={fmt(promptTokens)}
          badge={totalTokens > 0 ? `${Math.round((promptTokens / totalTokens) * 100)}% vol` : null}
          hint="Prompt tokens"
        />
        <Metric
          label="Cached"
          icon="cached"
          value={fmt(cachedTokens)}
          badge={`${cachedRatio}% hit`}
          hint={`${cachedRatio}% of input`}
          accent
          ratio={promptTokens > 0 ? cachedTokens / promptTokens : 0}
        />
        <Metric
          label="Output"
          icon="output"
          value={fmt(outputTokens)}
          badge={totalTokens > 0 ? `${outputShare}% vol` : null}
          hint="Completion tokens"
        />
        <Metric
          label="Est. cost"
          icon="payments"
          value={fmtCost(stats?.totalCost)}
          badge="USD"
          hint="Estimated spend"
          className="col-span-2 sm:col-span-1"
        />
      </div>

      {/* Token Volume Composition Strip */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Icon name="layers" className="text-[14px] text-primary" />
            <span className="font-semibold text-text-main">Token Volume Distribution</span>
            <span className="font-mono text-[11px] text-text-muted">
              · {fmt(totalTokens)} total tokens routed
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5 text-text-main">
              <span className="size-2 rounded-full bg-primary" />
              Cached: <strong className="font-semibold">{cachedShare}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <span className="size-2 rounded-full bg-text-muted/60" />
              Uncached In: <strong className="font-semibold text-text-main">{uncachedShare}%</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 text-text-muted">
              <span className="size-2 rounded-full bg-success" />
              Output: <strong className="font-semibold text-text-main">{outputShare}%</strong>
            </span>
          </div>
        </div>
        <div
          className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-surface-2 border border-border-subtle"
          aria-hidden="true"
        >
          {totalTokens > 0 ? (
            <>
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${cachedShare}%` }}
                title={`Cached Input: ${cachedShare}%`}
              />
              <div
                className="h-full bg-text-muted/50 transition-all duration-300"
                style={{ width: `${uncachedShare}%` }}
                title={`Uncached Input: ${uncachedShare}%`}
              />
              <div
                className="h-full bg-success transition-all duration-300"
                style={{ width: `${outputShare}%` }}
                title={`Output: ${outputShare}%`}
              />
            </>
          ) : (
            <div className="h-full w-full bg-surface-2" />
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, icon, value, badge = null, hint, accent = false, ratio = null, className = "" }) {
  return (
    <div className={`kpi-card min-w-0 !p-4 !gap-2.5 ${accent ? "border-primary/30" : ""} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-tight text-text-muted">{label}</span>
        <span className={`icon-box icon-box-sm ${accent ? "text-primary" : "text-text-muted"}`}>
          <Icon name={icon} className="text-[14px]" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate font-mono text-xl font-bold tracking-tight tabular-nums ${accent ? "text-primary" : "text-text-main"}`}>
            {value}
          </span>
          {badge && (
            <span className="shrink-0 rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-muted">
              {badge}
            </span>
          )}
        </div>
        {ratio !== null && (
          <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-surface-2 border border-border-subtle" aria-hidden="true">
            <span
              className="block h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
            />
          </span>
        )}
        <span className="truncate text-[11.5px] text-text-muted">{hint}</span>
      </div>
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
