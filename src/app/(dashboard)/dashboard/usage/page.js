"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { UsageStats, RequestLogger, CardSkeleton, SegmentedControl } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";
import RequestDetailsTab from "./components/RequestDetailsTab";
import CacheWire from "../components/CacheWire";
import TokenSaverWire from "../components/TokenSaverWire";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

export default function UsagePage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <UsageContent />
    </Suspense>
  );
}

function UsageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [period, setPeriod] = useState("today");

  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl && ["overview", "logs", "details"].includes(tabFromUrl)
    ? tabFromUrl
    : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard/usage?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="workspace-canvas usage-workspace flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      <div className="workspace-heading flex-col lg:flex-row lg:items-end">
        <div className="flex items-start gap-3.5">
          <div className="icon-box icon-box-lg text-primary mt-0.5">
            <Icon name="bar_chart" className="text-[20px]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1>Usage &amp; routing</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold uppercase tracking-wider text-text-main">
                <span className="status-dot status-dot-live" />
                Live Telemetry
              </span>
            </div>
            <p>Token counts, cache hits, and the route each request took.</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/cache"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-text-main"
              >
                <Icon name="cached" className="text-[13px] text-primary" />
                <span>Cache Settings</span>
              </Link>
              <Link
                href="/dashboard/token-saver"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-text-main"
              >
                <Icon name="savings" className="text-[13px] text-primary" />
                <span>Token Saver</span>
              </Link>
              <Link
                href="/dashboard/costs"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-text-main"
              >
                <Icon name="payments" className="text-[13px] text-primary" />
                <span>Cost Controls</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-end">
          <SegmentedControl
            ariaLabel="Usage view"
            options={[
              { value: "overview", label: "Overview" },
              { value: "details", label: "Inspector" },
              { value: "logs", label: "Live Stream" },
            ]}
            value={activeTab}
            onChange={handleTabChange}
            size="sm"
            className="w-full sm:w-auto"
          />
          {activeTab === "overview" && (
            <SegmentedControl
              ariaLabel="Usage period"
              options={PERIODS}
              value={period}
              onChange={setPeriod}
              size="sm"
              className="w-full sm:w-auto"
            />
          )}
        </div>
      </div>

      {activeTab === "overview" && (
        <Suspense fallback={<CardSkeleton />}>
          <UsageStats
            period={period}
            setPeriod={setPeriod}
            hidePeriodSelector
            pipelineSlot={
              <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-2">
                <CacheWire />
                <TokenSaverWire />
              </div>
            }
          />
        </Suspense>
      )}
      {activeTab === "logs" && <RequestLogger />}
      {activeTab === "details" && <RequestDetailsTab />}
    </div>
  );
}
