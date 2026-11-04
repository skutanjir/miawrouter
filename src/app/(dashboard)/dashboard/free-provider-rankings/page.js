"use client";

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import {
  FREE_TIER_PROVIDERS,
  FREE_TIER_MODELS_BY_PROVIDER,
} from "open-sse/config/freeTierCatalog.js";
import { Card, Badge } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";

import { Icon } from "@/shared/components/Icon";
function formatTokens(n) {
  if (!n || n === 0) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const TOS_LABELS = {
  ok: { label: "Clean", color: "text-success" },
  caution: { label: "Caution", color: "text-warning" },
  ambiguous: { label: "Ambiguous", color: "text-warning" },
  avoid: { label: "Avoid", color: "text-danger" },
  unknown: { label: "Unknown", color: "text-text-muted" },
};
const TOS_ORDER = { ok: 0, caution: 1, ambiguous: 2, unknown: 3, avoid: 4 };

function RankBadge({ rank }) {
  const styles =
    rank === 1
      ? "bg-primary/10 text-primary border-primary/20"
      : rank === 2
        ? "bg-surface-2 text-text-main border-border"
        : rank === 3
          ? "bg-warning/10 text-warning border-warning/20"
          : "bg-bg text-text-muted border-border-subtle";
  return (
    <span
      className={`inline-flex items-center justify-center size-7 rounded-md border text-xs font-bold ${styles}`}
    >
      {rank}
    </span>
  );
}

RankBadge.propTypes = { rank: PropTypes.number.isRequired };


export default function FreeProviderRankingsPage() {
  const [sort, setSort] = useState({ key: "modelCount", direction: "desc" });

  const rankings = useMemo(() => {
    const rows = [];

    for (const provider of FREE_TIER_PROVIDERS) {
      if (!provider.available) continue;

      const kinds = provider.serviceKinds || ["llm"];
      const models = (FREE_TIER_MODELS_BY_PROVIDER[provider.id] || []).filter(
        (m) => !m.disabled
      );
      if (models.length === 0) continue;

      if (!kinds.includes("llm") && models.length === 0) continue;

      const totalDaily = models.reduce((sum, m) => sum + (m.monthlyTokens || 0), 0);
      const totalCredit = models.reduce((sum, m) => sum + (m.creditTokens || 0), 0);

      // Determine worst ToS across models
      const tosOrder = { ok: 0, caution: 1, ambiguous: 2, unknown: 3, avoid: 4 };
      const worstTos = models.reduce((worst, m) => {
        return (tosOrder[m.tos] || 0) > (tosOrder[worst] || 0) ? m.tos : worst;
      }, null);

      rows.push({
        provider,
        modelCount: models.length,
        totalDaily,
        totalCredit,
        worstTos,
        noAuth: !!provider.noAuth,
      });
    }

    // Sort: modelCount desc, then totalDaily desc, then totalCredit desc, then name
    rows.sort((a, b) => {
      if (a.modelCount !== b.modelCount) return b.modelCount - a.modelCount;
      if (a.totalDaily !== b.totalDaily) return b.totalDaily - a.totalDaily;
      if (a.totalCredit !== b.totalCredit) return b.totalCredit - a.totalCredit;
      return a.provider.name.localeCompare(b.provider.name);
    });

    return rows;
  }, []);

  // Summary stats
  const totalProviders = rankings.length;
  const totalModels = rankings.reduce((s, r) => s + r.modelCount, 0);
  const keylessCount = rankings.filter((r) => r.noAuth).length;
  const sortedRankings = useMemo(() => {
    const compare = (a, b) => {
      const field = sort.key === "tos" ? "worstTos" : sort.key;
      const value = (row) => {
        if (sort.key === "name") return row.provider.name.toLowerCase();
        if (sort.key === "tos") return TOS_ORDER[row.worstTos] ?? 3;
        return row[field];
      };
      const av = value(a);
      const bv = value(b);
      return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.direction === "asc" ? 1 : -1);
    };
    return [...rankings].sort(compare);
  }, [rankings, sort]);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-semibold tracking-tight text-text-main">Free Provider Rankings</h1>
          <Badge variant="success" size="md">{totalProviders} providers</Badge>
          <Badge variant="info" size="md">{totalModels} models</Badge>
          {keylessCount > 0 && (
            <Badge variant="primary" size="md">{keylessCount} keyless</Badge>
          )}
        </div>
        <p className="text-sm text-text-muted">
          Ranked by model count, then by daily token budget. Only available providers shown.
        </p>
      </div>

      {/* Back link */}
      <Link
        href="/dashboard/free-tiers"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name={"arrow_back"} className=" text-[16px]" />
        Back to Free Tiers
      </Link>

      {/* Rankings table */}
      {rankings.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border py-12 text-center">
          <Icon name={"emoji_events"} className="text-[40px] text-text-muted mb-2 block" />
          <p className="text-sm text-text-muted">No available free tier providers found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full min-w-[840px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-xs text-text-muted">
              <tr>
                <th className="px-3 py-3 font-medium">Rank</th>
                {[
                  ["name", "Provider"],
                  ["modelCount", "Models"],
                  ["totalDaily", "Tokens per day"],
                  ["totalCredit", "Signup credit"],
                  ["tos", "Terms"],
                ].map(([key, label]) => (
                  <th key={key} className="px-4 py-3 font-medium">
                    <button type="button" onClick={() => setSort((current) => ({
                      key,
                      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
                    }))} className="inline-flex items-center gap-1.5 hover:text-text-main">
                      {label}
                      {sort.key === key && <Icon name={sort.direction === "asc" ? "arrow_upward" : "arrow_downward"} className="text-[13px]" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedRankings.map((row, index) => {
                const tosInfo = TOS_LABELS[row.worstTos] || TOS_LABELS.unknown;
                return (
                  <tr key={row.provider.id} className="hover:bg-surface-2/70">
                    <td className="px-3 py-3"><RankBadge rank={index + 1} /></td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ProviderIcon providerId={row.provider.id} alt={row.provider.name} size={28} className="shrink-0 object-contain" fallbackIcon={row.provider.icon} fallbackText={row.provider.textIcon || row.provider.id.slice(0, 2).toUpperCase()} fallbackColor={row.provider.color} />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-text-main">{row.provider.name}</span>
                          {row.provider.freeNote && <span className="block max-w-[360px] truncate text-xs text-text-muted">{row.provider.freeNote}</span>}
                          {row.noAuth && <Badge variant="success" size="sm">No key</Badge>}
                        </div>
                        {row.provider.website && <a href={row.provider.website} target="_blank" rel="noopener noreferrer" title={`Visit ${row.provider.name}`} className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text-main"><Icon name="open_in_new" className="text-[14px]" /></a>}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{row.modelCount}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatTokens(row.totalDaily) || "Not listed"}</td>
                    <td className="px-4 py-3 font-mono tabular-nums">{formatTokens(row.totalCredit) || "Not listed"}</td>
                    <td className="px-4 py-3"><span className={`font-medium ${tosInfo.color}`}>{tosInfo.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <Card padding="sm" className="text-xs text-text-muted">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <Badge variant="success" size="sm">No Key</Badge>
            <span>No API key needed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-success">Clean</span>
            <span>ToS allows proxy use</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-warning">Caution</span>
            <span>Review ToS before use</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-danger">Avoid</span>
            <span>ToS prohibits proxy/resale</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
