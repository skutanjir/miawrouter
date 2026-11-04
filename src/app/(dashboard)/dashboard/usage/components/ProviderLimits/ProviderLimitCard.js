"use client";

import { useState } from "react";
import Card from "@/shared/components/Card";
import ProviderIcon from "@/shared/components/ProviderIcon";
import Badge from "@/shared/components/Badge";
import QuotaProgressBar from "./QuotaProgressBar";
import { calculatePercentage } from "./utils";

import { Icon } from "@/shared/components/Icon";
const planVariants = {
  free: "default",
  pro: "primary",
  ultra: "success",
  enterprise: "info",
};

export default function ProviderLimitCard({
  provider,
  name,
  plan,
  quotas = [],
  message = null,
  loading = false,
  error = null,
  onRefresh,
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;

    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const planVariant = planVariants[plan?.toLowerCase()] || "default";

  return (
    <Card padding="md" className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Provider Logo */}
          <div
            className="size-10 rounded-md flex items-center justify-center p-1.5 bg-surface-2 border border-border-subtle"
          >
            <ProviderIcon
              src={`/providers/${provider}.png`}
              alt={provider || "Provider"}
              size={40}
              className="object-contain rounded-md"
              fallbackText={provider?.slice(0, 2).toUpperCase() || "PR"}
              fallbackColor="var(--color-text-muted)"
            />
          </div>

          <div>
            <h3 className="font-semibold text-text-main">
              {name || provider}
            </h3>
            {plan && (
              <Badge
                variant={planVariants[plan?.toLowerCase()] || "default"}
                size="xs"
              >
                {plan}
              </Badge>
            )}
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="p-2 rounded-md hover:bg-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-text-muted hover:text-text-main"
          title="Refresh quota"
        >
          <Icon name={"refresh"} className={` text-[20px] ${ refreshing || loading ? "animate-spin" : "" }`} />
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-surface-2 rounded animate-pulse" />
            <div className="h-2 bg-surface-2 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-surface-2 rounded animate-pulse" />
            <div className="h-2 bg-surface-2 rounded animate-pulse" />
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-4 rounded-md bg-danger/10 border border-danger/20">
          <div className="flex items-start gap-2">
            <Icon name={"error"} className=" text-danger text-[20px]" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        </div>
      )}

      {/* Info Message (for providers without API) */}
      {!loading && !error && message && (
        <div className="p-4 rounded-md bg-primary/10 border border-primary/20">
          <div className="flex items-start gap-2">
            <Icon name={"info"} className=" text-primary text-[20px]" />
            <p className="text-sm text-text-main">
              {message}
            </p>
          </div>
        </div>
      )}

      {/* Quota Progress Bars */}
      {!loading && !error && !message && quotas?.length > 0 && (
        <div className="space-y-4">
          {quotas.map((quota, index) => {
            // For Antigravity, use remainingPercentage if available, otherwise calculate
            const percentage =
              quota.remainingPercentage !== undefined
                ? Math.round(((quota.total - quota.used) / quota.total) * 100)
                : calculatePercentage(quota.used, quota.total);
            const unlimited = quota.total === 0 || quota.total === null;

            return (
              <QuotaProgressBar
                key={`${quota.name}-${index}`}
                label={quota.name}
                used={quota.used}
                total={quota.total}
                percentage={percentage}
                unlimited={unlimited}
                resetTime={quota.resetAt}
                recurring={quota.recurring !== false}
              />
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && !message && quotas?.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          <Icon name={"data_usage"} className=" text-[48px] opacity-20" />
          <p className="text-sm mt-2">No quota data available</p>
        </div>
      )}
    </Card>
  );
}
