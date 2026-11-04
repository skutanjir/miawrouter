"use client";
import { Fragment } from "react";

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import {
  FREE_TIER_PROVIDERS,
  FREE_TIER_MODELS_BY_PROVIDER,
  FREE_TIER_CATALOG_SOURCE,
} from "open-sse/config/freeTierCatalog.js";
import { Badge } from "@/shared/components";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { useHeaderSearchStore } from "@/store/headerSearchStore";

import { Icon } from "@/shared/components/Icon";
// ToS severity sort order — "ok" first, "avoid" last
const TOS_ORDER = { ok: 0, caution: 1, ambiguous: 2, unknown: 3, avoid: 4 };

// Free type labels for display
const FREE_TYPE_LABELS = {
  "recurring-daily": "Daily",
  "recurring-monthly": "Monthly",
  "recurring-uncapped": "Uncapped",
  "recurring-credit": "Recurring Credit",
  "one-time-initial": "Signup Credit",
  "keyless": "Keyless",
};

const FREE_TYPE_COLORS = {
  "recurring-daily": "success",
  "recurring-monthly": "info",
  "recurring-uncapped": "success",
  "recurring-credit": "info",
  "one-time-initial": "warning",
  "keyless": "primary",
};

function formatTokens(n) {
  if (!n || n === 0) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function TosBadge({ tos }) {
  if (!tos || tos === "ok") return null;
  const map = {
    caution: { label: "ToS Caution", variant: "warning" },
    ambiguous: { label: "ToS Ambiguous", variant: "warning" },
    avoid: { label: "ToS Risk", variant: "error" },
    unknown: { label: "ToS Unknown", variant: "default" },
  };
  const info = map[tos] || map.unknown;
  return (
    <Badge variant={info.variant} size="sm">
      {info.label}
    </Badge>
  );
}

TosBadge.propTypes = { tos: PropTypes.string };

function FreeTypeBadge({ freeType }) {
  if (!freeType) return null;
  return (
    <Badge variant={FREE_TYPE_COLORS[freeType] || "default"} size="sm">
      {FREE_TYPE_LABELS[freeType] || freeType}
    </Badge>
  );
}

FreeTypeBadge.propTypes = { freeType: PropTypes.string };

function ModelChip({ model }) {
  const tokens = formatTokens(model.monthlyTokens) || formatTokens(model.creditTokens);
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-bg px-2 py-1 text-xs">
      <span className="truncate font-medium max-w-[180px]" title={model.displayName || model.modelId}>
        {model.displayName || model.modelId}
      </span>
      {tokens && (
        <span className="text-text-muted whitespace-nowrap">
          {tokens}{model.monthlyTokens ? "/day" : " credit"}
        </span>
      )}
      <FreeTypeBadge freeType={model.freeType} />
      <TosBadge tos={model.tos} />
    </div>
  );
}

ModelChip.propTypes = {
  model: PropTypes.shape({
    modelId: PropTypes.string.isRequired,
    displayName: PropTypes.string,
    monthlyTokens: PropTypes.number,
    creditTokens: PropTypes.number,
    freeType: PropTypes.string,
    tos: PropTypes.string,
  }).isRequired,
};


export default function FreeTiersPage() {
  const [sort, setSort] = useState({ key: "models", direction: "desc" });
  const [expandedId, setExpandedId] = useState(null);
  const searchQuery = useHeaderSearchStore((s) => s.query);
  const registerSearch = useHeaderSearchStore((s) => s.register);
  const unregisterSearch = useHeaderSearchStore((s) => s.unregister);

  useEffect(() => {
    registerSearch("Search free providers...");
    return () => unregisterSearch();
  }, [registerSearch, unregisterSearch]);

  // Build sorted provider list with models
  const { availableProviders, unavailableCount } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const available = [];
    let unavailCount = 0;

    for (const provider of FREE_TIER_PROVIDERS) {
      // Skip non-LLM service kinds (search, fetch, etc.) unless they have models
      const kinds = provider.serviceKinds || ["llm"];
      const hasLlmModels = (FREE_TIER_MODELS_BY_PROVIDER[provider.id] || []).length > 0;
      if (!kinds.includes("llm") && !hasLlmModels) continue;

      if (!provider.available) {
        unavailCount++;
        continue;
      }

      // Search filter
      if (q && !provider.name.toLowerCase().includes(q)) {
        const models = FREE_TIER_MODELS_BY_PROVIDER[provider.id] || [];
        const modelMatch = models.some(
          (m) => (m.displayName || m.modelId).toLowerCase().includes(q)
        );
        if (!modelMatch) continue;
      }

      const models = (FREE_TIER_MODELS_BY_PROVIDER[provider.id] || [])
        .filter((m) => !m.disabled)
        .sort((a, b) => {
          // Sort by TosOrder ascending, then alphabetically
          const ta = TOS_ORDER[a.tos] ?? 3;
          const tb = TOS_ORDER[b.tos] ?? 3;
          if (ta !== tb) return ta - tb;
          return (a.displayName || a.modelId).localeCompare(b.displayName || b.modelId);
        });

      if (models.length === 0) continue;

      available.push({ provider, models });
    }

    // Sort: noAuth first, then by model count desc, then alphabetical
    available.sort((a, b) => {
      const na = a.provider.noAuth ? 1 : 0;
      const nb = b.provider.noAuth ? 1 : 0;
      if (na !== nb) return nb - na;
      if (a.models.length !== b.models.length) return b.models.length - a.models.length;
      return a.provider.name.localeCompare(b.provider.name);
    });

    return { availableProviders: available, unavailableCount: unavailCount };
  }, [searchQuery]);

  const totalModels = availableProviders.reduce((sum, p) => sum + p.models.length, 0);
  const sortedProviders = useMemo(() => {
    const valueFor = ({ provider, models }, key) => {
      if (key === "name") return provider.name.toLowerCase();
      if (key === "models") return models.length;
      if (key === "daily") return models.reduce((sum, model) => sum + (model.monthlyTokens || 0), 0);
      if (key === "credit") return models.reduce((sum, model) => sum + (model.creditTokens || 0), 0);
      return Math.max(...models.map((model) => TOS_ORDER[model.tos] ?? 3));
    };
    return [...availableProviders].sort((a, b) => {
      const av = valueFor(a, sort.key);
      const bv = valueFor(b, sort.key);
      return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.direction === "asc" ? 1 : -1);
    });
  }, [availableProviders, sort]);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-semibold tracking-tight text-text-main">Free Tier Providers</h1>
          <Badge variant="success" size="md">
            {availableProviders.length} provider{availableProviders.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="info" size="md">
            {totalModels} model{totalModels !== 1 ? "s" : ""}
          </Badge>
          {unavailableCount > 0 && (
            <Badge variant="default" size="md">
              {unavailableCount} catalog-only
            </Badge>
          )}
        </div>
        <p className="text-sm text-text-muted">
          Available free-tier providers and models.
          Catalog sourced from{" "}
          <span className="font-medium text-text-main">{FREE_TIER_CATALOG_SOURCE.repository}</span>
          {" · "}curated {FREE_TIER_CATALOG_SOURCE.modelCatalogCuratedAt}
        </p>
      </div>

      {/* Rankings link */}
      <Link
        href="/dashboard/free-provider-rankings"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <Icon name={"emoji_events"} className=" text-[16px]" />
        View Provider Rankings
      </Link>

      {/* Provider catalog */}
      {availableProviders.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border py-12 text-center">
          <Icon name={"inventory_2"} className="text-[40px] text-text-muted mb-2 block" />
          <p className="text-sm text-text-muted">
            {searchQuery.trim() ? "No free providers match your search" : "No available free tier providers found"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="border-b border-border bg-surface-2 text-xs text-text-muted">
              <tr>
                {[
                  ["name", "Provider"],
                  ["models", "Models"],
                  ["daily", "Daily allowance"],
                  ["credit", "Signup credit"],
                  ["tos", "Terms"],
                ].map(([key, title]) => (
                  <th key={key} className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => setSort((current) => ({
                        key,
                        direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
                      }))}
                      className="inline-flex items-center gap-1.5 hover:text-text-main"
                    >
                      {title}
                      {sort.key === key && <Icon name={sort.direction === "asc" ? "arrow_upward" : "arrow_downward"} className="text-[13px]" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedProviders.map(({ provider, models }) => {
                const daily = models.reduce((sum, model) => sum + (model.monthlyTokens || 0), 0);
                const credit = models.reduce((sum, model) => sum + (model.creditTokens || 0), 0);
                const worstTos = models.reduce((worst, model) => (
                  TOS_ORDER[model.tos] > TOS_ORDER[worst] ? model.tos : worst
                ), "ok");
                const expanded = expandedId === provider.id;
                return (
                  <Fragment key={provider.id}>
                    <tr className="hover:bg-surface-2/70">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <button type="button" onClick={() => setExpandedId(expanded ? null : provider.id)} aria-expanded={expanded} className="flex min-w-0 items-center gap-3 text-left">
                            <ProviderIcon providerId={provider.id} alt={provider.name} size={28} className="shrink-0 object-contain" fallbackIcon={provider.icon} fallbackText={provider.textIcon || provider.id.slice(0, 2).toUpperCase()} fallbackColor={provider.color} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="block truncate font-medium text-text-main">{provider.name}</span>
                                {provider.noAuth && <Badge variant="success" size="sm">No key</Badge>}
                              </span>
                              {provider.freeNote && <span className="block max-w-[360px] truncate text-xs text-text-muted">{provider.freeNote}</span>}
                            </span>
                          </button>
                          {provider.website && (
                            <a href={provider.website} target="_blank" rel="noopener noreferrer" title={`Visit ${provider.name}`} className="shrink-0 rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-text-main">
                              <Icon name="open_in_new" className="text-[14px]" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{models.length}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{formatTokens(daily) || "Not listed"}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{formatTokens(credit) || "Not listed"}</td>
                      <td className="px-4 py-3"><TosBadge tos={worstTos} /></td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={5} className="bg-surface-2/50 px-4 py-3">
                          {provider.authHint && <p className="mb-2 text-xs text-text-muted">{provider.authHint}</p>}
                          {provider.notice?.text && <p className="mb-2 text-xs text-warning">{provider.notice.text}</p>}
                          <div className="flex flex-wrap gap-1.5">{models.map((model) => <ModelChip key={model.modelId} model={model} />)}</div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
