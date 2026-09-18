"use client";

import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

export default function OverviewCards({ stats }) {
  return (
    <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
      <Card variant="metric" padding="sm" className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
        <span className="label">Total Requests</span>
        <span className="metric truncate text-xl sm:text-2xl font-semibold text-ink">
          {fmt(stats.totalRequests)}
        </span>
      </Card>
      <Card variant="metric" padding="sm" className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
        <span className="label">Input Tokens</span>
        <span className="metric truncate text-xl sm:text-2xl font-semibold text-ink">
          {fmt(stats.totalPromptTokens)}
        </span>
      </Card>
      <Card variant="metric" padding="sm" className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
        <span className="label">Cached Tokens</span>
        <span className="metric truncate text-xl sm:text-2xl font-semibold text-signal">
          {fmt(stats.totalCachedTokens)}
        </span>
      </Card>
      <Card variant="metric" padding="sm" className="flex min-w-0 flex-col gap-1 px-3.5 py-3">
        <span className="label">Output Tokens</span>
        <span className="metric truncate text-xl sm:text-2xl font-semibold text-ink">
          {fmt(stats.totalCompletionTokens)}
        </span>
      </Card>
      <Card variant="metric" padding="sm" className="col-span-2 sm:col-span-1 flex min-w-0 flex-col gap-1 px-3.5 py-3">
        <span className="label">Est. Cost</span>
        <span className="metric truncate text-xl sm:text-2xl font-semibold text-ink">
          ~{fmtCost(stats.totalCost)}
        </span>
        <span className="text-[10px] text-muted truncate">Estimated, non-billed</span>
      </Card>
    </div>
  );
}

OverviewCards.propTypes = {
  stats: PropTypes.object.isRequired,
};
