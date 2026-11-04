"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, SegmentedControl } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

const number = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const money = (value) => `$${(Number(value) || 0).toFixed(4)}`;
const title = (value) =>
  String(value || "unknown")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function PageHeader({ heading, description, refresh, loading, period, setPeriod, badge }) {
  return (
    <div className="workspace-heading">
      <div>
        <div className="flex items-center gap-2.5">
          <h1>{heading}</h1>
          {badge}
        </div>
        <p>{description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {period && (
          <SegmentedControl
            ariaLabel={`${heading} period`}
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            size="sm"
          />
        )}
        <Button
          variant="secondary"
          size="sm"
          icon="refresh"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>
    </div>
  );
}

function ErrorMessage({ error }) {
  return error ? (
    <div
      role="alert"
      className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      <Icon name="warning" className="text-[18px] shrink-0" />
      <span>{error}</span>
    </div>
  ) : null;
}

function KpiCard({ label, value, icon, tone = "primary", subtext }) {
  const toneClasses = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">{label}</p>
          <p className="metric mt-1.5 text-2xl">{value}</p>
        </div>
        {icon && (
          <div className={`icon-box ${toneClasses[tone] || toneClasses.primary}`}>
            <Icon name={icon} weight="duotone" className="text-[20px]" />
          </div>
        )}
      </div>
      {subtext && <div className="text-xs text-text-muted">{subtext}</div>}
    </div>
  );
}

function useJson(urls) {
  const requestKey = JSON.stringify(urls);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all(
        JSON.parse(requestKey).map((url) => fetch(url, { cache: "no-store" }))
      );
      const payloads = await Promise.all(
        responses.map(async (response) => {
          const body = await response.json().catch(() => ({}));
          return response.ok
            ? body
            : { error: body.error || `Request failed (${response.status})` };
        })
      );
      setData(payloads);
      const failures = payloads
        .filter((body) => body?.error)
        .map((body) => body.error);
      if (failures.length > 0) setError(failures[0]);
    } catch (err) {
      setError(err.message || "Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [requestKey]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, loading, error, load };
}

export function HealthPageClient() {
  const { data, loading, error, load } = useJson([
    "/api/health",
    "/api/providers",
  ]);
  const health = data?.[0];
  const connections = data?.[1]?.connections || [];
  const active = connections.filter((item) => item.isActive !== false);
  const healthyCount = active.filter((item) => item.testStatus === "success").length;
  const failedCount = active.filter(
    (item) => item.testStatus === "error" || item.testStatus === "failed"
  ).length;

  const statusText = (status) =>
    status === "success"
      ? "Healthy"
      : status === "error" || status === "failed"
        ? "Failed"
        : status
          ? title(status)
          : "Not tested";

  const statusVariant = (status) =>
    status === "success"
      ? "success"
      : status === "error" || status === "failed"
        ? "danger"
        : "neutral";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        heading="Health"
        description="Gateway reachability and stored provider connection test results."
        refresh={load}
        loading={loading}
        badge={
          <Badge
            variant={loading ? "neutral" : health?.ok ? "success" : "danger"}
            dot
            size="sm"
          >
            {loading ? "Checking…" : health?.ok ? "Healthy" : "Unavailable"}
          </Badge>
        }
      />
      <ErrorMessage error={error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Gateway Reachability"
          value={loading ? "Checking…" : health?.ok ? "Healthy" : "Unavailable"}
          icon="ecg_heart"
          tone={health?.ok ? "success" : "danger"}
          subtext="HTTP /api/health probe status"
        />
        <KpiCard
          label="Active Connections"
          value={loading ? "—" : number(active.length)}
          icon="cable"
          tone="primary"
          subtext={`${connections.length} total configured connections`}
        />
        <KpiCard
          label="Verified Healthy"
          value={loading ? "—" : `${healthyCount} / ${active.length}`}
          icon="verified_user"
          tone={failedCount > 0 ? "warning" : "success"}
          subtext={
            failedCount > 0
              ? `${failedCount} connection(s) reported test errors`
              : "Based on last stored connection test"
          }
        />
      </div>

      <Card
        aria-labelledby="health-connections"
        title="Provider connections"
        subtitle="States reflect the last stored connection test results; no new probes are run automatically."
        icon="dns"
        padding="none"
        action={
          <Link href="/dashboard/providers">
            <Button size="sm" variant="secondary" icon="settings">
              Manage Providers
            </Button>
          </Link>
        }
        className="overflow-hidden [&>div:first-child]:px-5 [&>div:first-child]:pt-5 [&>div:first-child]:mb-3"
      >
        {loading ? (
          <div className="flex items-center gap-3 border-t border-border-subtle px-5 py-8 text-sm text-text-muted">
            <Icon name="progress_activity" className="animate-spin text-primary text-[18px]" />
            <span>Loading provider connection states…</span>
          </div>
        ) : active.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-border-subtle px-5 py-10 text-center">
            <div className="icon-box text-text-muted">
              <Icon name="dns" weight="duotone" className="text-[20px]" />
            </div>
            <p className="text-sm font-medium text-text-main">
              No active provider connections to check
            </p>
            <p className="text-xs text-text-muted">
              Enable or add a connection in Providers to monitor its health state.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border-subtle">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Connection</th>
                  <th className="px-5 py-3 text-left">Provider</th>
                  <th className="px-5 py-3 text-right">Last Test Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {active.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 font-semibold text-text-main">
                      <Link
                        href={`/dashboard/providers/${item.provider}`}
                        className="hover:text-primary transition-colors"
                      >
                        {item.name || title(item.provider)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      <div className="flex items-center gap-2">
                        <ProviderIcon
                          src={getProviderIconSrc(item.provider)}
                          alt={title(item.provider)}
                          size={18}
                          className="rounded object-contain shrink-0"
                          fallbackText={title(item.provider).slice(0, 2).toUpperCase()}
                        />
                        <span>{title(item.provider)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant={statusVariant(item.testStatus)} dot size="xs">
                        {statusText(item.testStatus)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function RuntimePageClient() {
  const urls = [
    "/api/health",
    "/api/version",
    "/api/headroom/status",
    "/api/pxpipe/status",
    "/api/tunnel/status",
  ];
  const { data, loading, error, load } = useJson(urls);
  const [health, version, headroom, pxpipe, tunnel] = data || [];
  const services = [
    {
      name: "Gateway",
      icon: "router",
      status: health?.ok ? "Running" : "Unavailable",
      detail: "/api/health",
      description: "Core HTTP/SSE AI routing engine",
    },
    {
      name: "Headroom",
      icon: "savings",
      status: headroom?.running || headroom?.ok ? "Running" : "Stopped",
      detail: headroom?.url,
      description: "Token compression sidecar service",
    },
    {
      name: "Pxpipe",
      icon: "image",
      status: pxpipe?.running
        ? "Running"
        : pxpipe?.enabled
          ? "Enabled, stopped"
          : "Disabled",
      detail: pxpipe?.pid ? `PID ${pxpipe.pid}` : null,
      description: "Multimodal media proxy pipeline",
    },
    {
      name: "Tunnel",
      icon: "hub",
      status:
        tunnel?.tunnel?.running || tunnel?.tunnel?.active
          ? "Running"
          : "Stopped",
      detail: tunnel?.tunnel?.url,
      description: "Public HTTPS tunnel bridge",
    },
  ];
  const runningCount = services.filter((s) => s.status === "Running").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        heading="Runtime"
        description="Service states and sidecar processes reported by the application's runtime APIs."
        refresh={load}
        loading={loading}
      />
      <ErrorMessage error={error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Application Version"
          value={version?.currentVersion ? `v${version.currentVersion}` : loading ? "Checking…" : "Unavailable"}
          icon="rocket_launch"
          tone="primary"
          subtext={
            version?.hasUpdate
              ? `Update v${version.latestVersion} is available`
              : "Up to date release build"
          }
        />
        <KpiCard
          label="Active Services"
          value={loading ? "—" : `${runningCount} / ${services.length}`}
          icon="memory"
          tone="success"
          subtext="Gateway and optional sidecar daemons"
        />
        <KpiCard
          label="Public Tunnel"
          value={
            loading
              ? "—"
              : tunnel?.tunnel?.running || tunnel?.tunnel?.active
                ? "Active"
                : "Offline"
          }
          icon="hub"
          tone={
            tunnel?.tunnel?.running || tunnel?.tunnel?.active
              ? "success"
              : "primary"
          }
          subtext={tunnel?.tunnel?.url || "Local-only mode"}
        />
      </div>

      <Card
        aria-label="Runtime service status"
        title="Runtime services"
        subtitle="Live daemon status and process endpoints."
        icon="memory"
        padding="none"
        className="overflow-hidden [&>div:first-child]:px-5 [&>div:first-child]:pt-5 [&>div:first-child]:mb-3"
      >
        <div className="overflow-x-auto border-t border-border-subtle">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr>
                <th className="px-5 py-3 text-left">Service</th>
                <th className="px-5 py-3 text-left">Role</th>
                <th className="px-5 py-3 text-left">State</th>
                <th className="px-5 py-3 text-left">Reported Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {services.map((svc) => {
                const isRunning = svc.status === "Running";
                const isUnavailable = svc.status === "Unavailable";
                return (
                  <tr key={svc.name}>
                    <td className="px-5 py-3.5 font-semibold text-text-main">
                      <div className="flex items-center gap-2.5">
                        <div className="icon-box icon-box-sm text-primary">
                          <Icon name={svc.icon} weight="duotone" className="text-[15px]" />
                        </div>
                        <span>{svc.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-muted">
                      {svc.description}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={
                          loading
                            ? "neutral"
                            : isRunning
                              ? "success"
                              : isUnavailable
                                ? "danger"
                                : "neutral"
                        }
                        dot
                        size="xs"
                      >
                        {loading ? "Checking…" : svc.status}
                      </Badge>
                    </td>
                    <td className="max-w-[380px] break-all px-5 py-3.5 font-mono text-xs text-text-muted">
                      {svc.detail || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatsPage({ kind }) {
  const [period, setPeriod] = useState("7d");
  const [sort, setSort] = useState(kind === "costs" ? "cost" : "requests");
  const [descending, setDescending] = useState(true);
  const { data, loading, error, load } = useJson([
    `/api/usage/stats?period=${period}`,
    "/api/providers",
    `/api/cache/stats?period=${period}`,
  ]);
  const stats = data?.[0] || {};
  const connections = data?.[1]?.connections || [];
  const cache = data?.[2] || {};
  const localCacheHits =
    (cache.layers?.L1?.hits || 0) + (cache.layers?.L2?.hits || 0);
  const providerNames = Object.fromEntries(
    connections.map((item) => [item.provider, item.name || title(item.provider)])
  );
  const rows = Object.entries(stats.byProvider || {})
    .map(([provider, values]) => ({ provider, ...values }))
    .sort((a, b) => {
      const aValue =
        sort === "provider"
          ? providerNames[a.provider] || a.provider
          : a[sort] || 0;
      const bValue =
        sort === "provider"
          ? providerNames[b.provider] || b.provider
          : b[sort] || 0;
      const comparison =
        typeof aValue === "string"
          ? aValue.localeCompare(bValue)
          : aValue - bValue;
      return comparison * (descending ? -1 : 1);
    });
  const isCosts = kind === "costs";
  const selectSort = (field) => {
    if (field === sort) setDescending((value) => !value);
    else {
      setSort(field);
      setDescending(true);
    }
  };
  const heading = isCosts ? "Costs" : "Provider stats";
  const maxMetric = Math.max(
    1,
    ...rows.map((r) => Number(isCosts ? r.cost : r.requests) || 0)
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        heading={heading}
        description={
          isCosts
            ? "Estimated costs from recorded model usage across connected providers."
            : "Requests, token volume, and share of traffic by provider."
        }
        refresh={load}
        loading={loading}
        period={period}
        setPeriod={setPeriod}
      />
      <ErrorMessage error={error} />

      <section
        aria-label={`${heading} summary`}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          label={isCosts ? "Estimated Cost" : "Total Requests"}
          value={
            isCosts ? money(stats.totalCost) : number(stats.totalRequests)
          }
          icon={isCosts ? "payments" : "analytics"}
          tone="primary"
          subtext={`Selected window: ${period.toUpperCase()}`}
        />
        <KpiCard
          label="Input Tokens"
          value={number(stats.totalPromptTokens)}
          icon="input"
          tone="primary"
          subtext="Prompt & context tokens"
        />
        <KpiCard
          label="Output Tokens"
          value={number(stats.totalCompletionTokens)}
          icon="generating_tokens"
          tone="success"
          subtext="Generated completion tokens"
        />
        <KpiCard
          label={isCosts ? "Cached Input Tokens" : "Local Cache Hits"}
          value={number(
            isCosts ? stats.totalCachedTokens : localCacheHits
          )}
          icon="cached"
          tone="warning"
          subtext="Served from cache layers"
        />
      </section>

      <Card
        aria-labelledby="provider-breakdown"
        title={
          isCosts
            ? "Which providers account for estimated cost?"
            : "How is usage distributed across providers?"
        }
        subtitle={
          isCosts
            ? "Estimates use configured model pricing tables and are not provider invoices."
            : "Click any column header to sort provider performance."
        }
        icon={isCosts ? "payments" : "bar_chart"}
        padding="none"
        className="overflow-hidden [&>div:first-child]:px-5 [&>div:first-child]:pt-5 [&>div:first-child]:mb-3"
      >
        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-3 border-t border-border-subtle px-5 py-8 text-sm text-text-muted">
            <Icon name="progress_activity" className="animate-spin text-primary text-[18px]" />
            <span>Loading provider usage…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-border-subtle px-5 py-10 text-center">
            <div className="icon-box text-text-muted">
              <Icon name="bar_chart" weight="duotone" className="text-[20px]" />
            </div>
            <p className="text-sm font-medium text-text-main">
              No usage recorded for this period
            </p>
            <p className="text-xs text-text-muted">
              Send requests through the router to populate provider telemetry.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border-subtle">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr>
                  {[
                    ["provider", "Provider"],
                    ["requests", "Requests"],
                    ["promptTokens", "Input tokens"],
                    ["completionTokens", "Output tokens"],
                    ["cost", "Estimated cost"],
                  ].map(([field, label]) => (
                    <th
                      key={field}
                      aria-sort={
                        sort === field
                          ? descending
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                      className={`px-5 py-3 ${
                        field === "provider" ? "text-left" : "text-right"
                      }`}
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-sm hover:text-text-main focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => selectSort(field)}
                      >
                        <span>{label}</span>
                        {sort === field && (
                          <span className="text-primary">
                            {descending ? " ↓" : " ↑"}
                          </span>
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((row) => {
                  const share = Math.round(
                    ((Number(isCosts ? row.cost : row.requests) || 0) /
                      maxMetric) *
                      100
                  );
                  return (
                    <tr key={row.provider}>
                      <td className="px-5 py-3 font-medium text-text-main">
                        <div className="flex items-center gap-2.5">
                          <ProviderIcon
                            src={getProviderIconSrc(row.provider)}
                            alt={title(row.provider)}
                            size={20}
                            className="rounded object-contain shrink-0"
                            fallbackText={title(row.provider)
                              .slice(0, 2)
                              .toUpperCase()}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">
                              {providerNames[row.provider] ||
                                title(row.provider)}
                            </p>
                            <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-surface-2">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.max(4, share)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {number(row.requests)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-text-muted">
                        {number(row.promptTokens)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums text-text-muted">
                        {number(row.completionTokens)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-semibold tabular-nums text-text-main">
                        {money(row.cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ProviderStatsPageClient() {
  return <StatsPage kind="providers" />;
}
export function CostsPageClient() {
  return <StatsPage kind="costs" />;
}

export function ActivityPageClient() {
  const { data, loading, error, load } = useJson([
    "/api/usage/request-details?page=1&pageSize=50",
  ]);
  const details = data?.[0]?.details || [];
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const isFailure = (item) =>
    item.status === "error" ||
    item.status === "failed" ||
    Boolean(item.error) ||
    Number(item.statusCode || item.status) >= 400;

  const rows = details.filter((item) => {
    const matchesStatus =
      filter === "all" ||
      (filter === "errors" ? isFailure(item) : !isFailure(item));
    if (!matchesStatus) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      String(item.provider || "")
        .toLowerCase()
        .includes(q) ||
      String(item.model || "")
        .toLowerCase()
        .includes(q)
    );
  });

  const tokenCount = (item) => {
    const usage = item.tokens || {};
    return (
      (usage.prompt_tokens ||
        usage.input_tokens ||
        item.promptTokens ||
        item.inputTokens ||
        0) +
      (usage.completion_tokens ||
        usage.output_tokens ||
        item.completionTokens ||
        item.outputTokens ||
        0)
    );
  };

  const errorCount = details.filter(isFailure).length;
  const successCount = details.length - errorCount;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        heading="Activity"
        description="Chronological stream of recent requests recorded by the router."
        refresh={load}
        loading={loading}
      />
      <ErrorMessage error={error} />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Recorded Requests"
          value={loading ? "—" : number(details.length)}
          icon="history"
          tone="primary"
          subtext="Latest 50 dispatches in buffer"
        />
        <KpiCard
          label="Successful"
          value={loading ? "—" : number(successCount)}
          icon="check_circle"
          tone="success"
          subtext="Completed without upstream error"
        />
        <KpiCard
          label="Failed / Errors"
          value={loading ? "—" : number(errorCount)}
          icon="warning"
          tone={errorCount > 0 ? "danger" : "primary"}
          subtext="HTTP 4xx/5xx or provider exceptions"
        />
      </div>

      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3 shadow-soft"
        aria-label="Activity filters"
      >
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter activity">
          {[
            ["all", "All requests", details.length],
            ["errors", "Errors", errorCount],
            ["success", "Successful", successCount],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-2 focus-visible:outline-primary ${
                filter === value
                  ? "bg-primary text-bg shadow-2xs"
                  : "bg-surface-2 text-text-muted hover:text-text-main"
              }`}
            >
              <span>{label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  filter === value
                    ? "bg-bg/20 text-bg"
                    : "bg-surface text-text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-text-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter model or provider…"
              aria-label="Filter activity by model or provider"
              className="h-8 w-48 sm:w-60 rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-xs text-text-main focus:border-primary focus:bg-surface focus:outline-none"
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-text-muted">
            {loading ? "Loading…" : `${rows.length} shown`}
          </span>
        </div>
      </div>

      <Card
        aria-label="Recent request activity"
        padding="none"
        className="overflow-hidden"
      >
        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-text-muted">
            <Icon name="progress_activity" className="animate-spin text-primary text-[18px]" />
            <span>Loading recent request activity…</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
            <div className="icon-box text-text-muted">
              <Icon name="history" weight="duotone" className="text-[20px]" />
            </div>
            <p className="text-sm font-medium text-text-main">
              {details.length
                ? "No requests match this filter."
                : "No requests recorded yet. Send a request through the router to see activity here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Provider</th>
                  <th className="px-5 py-3">Model</th>
                  <th className="px-5 py-3 text-right">Tokens</th>
                  <th className="px-5 py-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {rows.map((item) => {
                  const isErr = isFailure(item);
                  const status =
                    item.status || (isErr ? "Error" : "Recorded");
                  const isOk =
                    !isErr &&
                    (item.status === "ok" ||
                      item.status === "success" ||
                      status === "Recorded");
                  return (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-text-muted">
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-5 py-3 font-medium text-text-main">
                        <div className="flex items-center gap-2">
                          <ProviderIcon
                            src={getProviderIconSrc(item.provider)}
                            alt={title(item.provider)}
                            size={18}
                            className="rounded object-contain shrink-0"
                            fallbackText={title(item.provider)
                              .slice(0, 2)
                              .toUpperCase()}
                          />
                          <span>{title(item.provider)}</span>
                        </div>
                      </td>
                      <td className="max-w-[360px] truncate px-5 py-3 font-mono text-xs text-text-main">
                        {item.model || "—"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums">
                        {number(tokenCount(item))}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge
                          variant={
                            isErr ? "danger" : isOk ? "success" : "neutral"
                          }
                          dot
                          size="xs"
                        >
                          {status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
