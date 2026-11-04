"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";
import ProviderIcon from "@/shared/components/ProviderIcon";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";

const formatTime = (value) => (value ? new Date(value).toLocaleString() : "—");
const name = (value) =>
  String(value || "Unknown")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const promptTokensOf = (item) => {
  const usage = item.tokens || {};
  return usage.prompt_tokens || usage.input_tokens || item.promptTokens || item.inputTokens || 0;
};

const completionTokensOf = (item) => {
  const usage = item.tokens || {};
  return usage.completion_tokens || usage.output_tokens || item.completionTokens || item.outputTokens || 0;
};

const tokens = (item) => promptTokensOf(item) + completionTokensOf(item);

const failed = (item) =>
  item.status === "error" ||
  item.status === "failed" ||
  Boolean(item.error) ||
  Number(item.statusCode || item.status) >= 400;

const succeeded = (item) =>
  item.status === "ok" ||
  item.status === "success" ||
  item.status === "complete" ||
  (!failed(item) && Number(item.statusCode || 200) < 400);

const QUICK_ACTIONS = [
  {
    href: "/dashboard/providers",
    title: "Provider Connections",
    description: "Connect OAuth accounts, API keys, and local LLM runners",
    icon: "dns",
  },
  {
    href: "/dashboard/endpoint",
    title: "Endpoint & API Keys",
    description: "Copy your /v1 gateway URL, manage keys, and expose tunnels",
    icon: "api",
  },
  {
    href: "/dashboard/combos",
    title: "Combos & Fallbacks",
    description: "Build resilient multi-model chains with automatic failover",
    icon: "layers",
  },
  {
    href: "/dashboard/cli-tools",
    title: "CLI Coding Tools",
    description: "One-click setup for Claude Code, Codex, Cline, and Cursor",
    icon: "terminal",
  },
];

export default function OverviewClient() {
  const [health, setHealth] = useState(null);
  const [connections, setConnections] = useState([]);
  const [requests, setRequests] = useState([]);
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const endpoints = [
      "/api/health",
      "/api/providers",
      "/api/usage/request-details?page=1&pageSize=8",
    ];
    try {
      const responses = await Promise.all(
        endpoints.map((url) => fetch(url, { cache: "no-store" }))
      );
      const payloads = await Promise.all(
        responses.map((response) => response.json().catch(() => ({})))
      );
      if (!responses[0].ok || !responses[1].ok || !responses[2].ok) {
        throw new Error(
          "Could not load router status or recent requests. Refresh to try again."
        );
      }
      setHealth(payloads[0]);
      setConnections(payloads[1].connections || []);
      setRequests(payloads[2].details || []);
    } catch (err) {
      setError(
        err.message || "Could not load dashboard data. Refresh to try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setOrigin(window.location.origin)
    );
    load();
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const activeConnections = connections.filter((item) => item.isActive !== false);
  const activeProviders = [
    ...new Set(activeConnections.map((item) => item.provider).filter(Boolean)),
  ];
  const endpoint = origin ? `${origin}/v1` : "";
  const recentTotalTokens = requests.reduce((sum, item) => sum + tokens(item), 0);
  const recentSuccessCount = requests.filter((item) => !failed(item)).length;

  const copyEndpoint = async () => {
    if (!endpoint) return;
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy the endpoint. Select and copy the URL instead.");
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Workspace Header */}
      <header className="workspace-heading">
        <div>
          <div className="flex items-center gap-2.5">
            <h1>Router overview</h1>
            <Badge
              variant={loading ? "neutral" : health?.ok ? "success" : "danger"}
              dot
              size="sm"
            >
              {loading ? "Checking…" : health?.ok ? "Gateway Online" : "Offline"}
            </Badge>
          </div>
          <p>
            Confirm the gateway is reachable, inspect active provider topology, and monitor live request dispatches.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dashboard/providers">
            <Button size="sm" variant="primary" icon="add">
              Add Provider
            </Button>
          </Link>
          <Button
            size="sm"
            variant="secondary"
            onClick={load}
            disabled={loading}
            icon="refresh"
          >
            {loading ? "Checking…" : "Refresh"}
          </Button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          <Icon name="warning" className="text-[18px] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Telemetry Strip */}
      <section
        aria-label="Router endpoint status"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {/* KPI 1: Gateway Status & Endpoint */}
        <div className="kpi-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Gateway Status</p>
              <p
                className={`mt-1.5 text-xl font-bold tracking-tight ${
                  loading
                    ? "text-text-muted"
                    : health?.ok
                      ? "text-success"
                      : "text-danger"
                }`}
              >
                {loading ? "Checking…" : health?.ok ? "Online & Ready" : "Unavailable"}
              </p>
            </div>
            <div
              className={`icon-box ${
                health?.ok ? "text-success" : "text-primary"
              }`}
            >
              <Icon name="router" weight="duotone" className="text-[20px]" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface-2 px-2.5 py-1.5">
            <code className="truncate font-mono text-xs text-text-main">
              {endpoint || "/v1"}
            </code>
            <button
              type="button"
              onClick={copyEndpoint}
              disabled={!endpoint}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <Icon
                name={copied ? "check" : "content_copy"}
                className="text-[13px]"
              />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* KPI 2: Active Connections */}
        <div className="kpi-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Active Connections</p>
              <p className="metric mt-1.5 text-2xl">
                {loading ? "—" : activeConnections.length}
              </p>
            </div>
            <div className="icon-box text-primary">
              <Icon name="cable" weight="duotone" className="text-[20px]" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>{connections.length} total configured</span>
            <Link
              href="/dashboard/providers"
              className="font-semibold text-primary hover:underline"
            >
              Configure →
            </Link>
          </div>
        </div>

        {/* KPI 3: Routable Providers */}
        <div className="kpi-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Routable Providers</p>
              <p className="metric mt-1.5 text-2xl">
                {loading ? "—" : activeProviders.length}
              </p>
            </div>
            <div className="icon-box text-primary">
              <Icon name="dns" weight="duotone" className="text-[20px]" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {activeProviders.length > 0 ? (
              <div className="flex items-center -space-x-1.5 overflow-hidden">
                {activeProviders.slice(0, 6).map((prov) => (
                  <div
                    key={prov}
                    className="inline-flex size-6 items-center justify-center rounded-full border border-border bg-surface p-0.5"
                    title={name(prov)}
                  >
                    <ProviderIcon
                      src={getProviderIconSrc(prov)}
                      alt={name(prov)}
                      size={18}
                      className="rounded-full object-contain"
                      fallbackText={name(prov).slice(0, 2).toUpperCase()}
                    />
                  </div>
                ))}
                {activeProviders.length > 6 && (
                  <span className="pl-2 text-[11px] font-mono text-text-muted">
                    +{activeProviders.length - 6}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-text-muted">No active providers</span>
            )}
            <Link
              href="/dashboard/health"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Health →
            </Link>
          </div>
        </div>

        {/* KPI 4: Recent Traffic */}
        <div className="kpi-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="label">Recent Sample Volume</p>
              <p className="metric mt-1.5 text-2xl">
                {loading ? "—" : recentTotalTokens.toLocaleString()}
              </p>
            </div>
            <div className="icon-box text-warning">
              <Icon name="bolt" weight="duotone" className="text-[20px]" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              {requests.length > 0
                ? `${recentSuccessCount}/${requests.length} recent succeeded`
                : "Tokens in latest sample"}
            </span>
            <Link
              href="/dashboard/usage"
              className="font-semibold text-primary hover:underline"
            >
              Analytics →
            </Link>
          </div>
        </div>
      </section>

      {/* Request Routing Topology */}
      <Card
        aria-labelledby="routing-title"
        title="Request routing topology"
        subtitle="Live routing path from client SDKs & CLI tools through MiawRouter to upstream providers."
        icon="hub"
        action={
          <Link href="/dashboard/providers">
            <Button size="sm" variant="secondary" icon="settings">
              Manage providers
            </Button>
          </Link>
        }
      >
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-sm text-text-muted">
            <Icon name="progress_activity" className="animate-spin text-primary text-[18px]" />
            <span>Loading provider connections…</span>
          </div>
        ) : activeConnections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-2/50 py-10 px-4 text-center">
            <div className="icon-box icon-box-lg text-text-muted">
              <Icon name="dns" weight="duotone" className="text-[24px]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-main">
                No active provider connections
              </p>
              <p className="mt-1 text-xs text-text-muted max-w-md">
                Add or enable an OAuth or API Key provider connection to start routing OpenAI, Anthropic, and MCP traffic.
              </p>
            </div>
            <Link href="/dashboard/providers">
              <Button size="sm" variant="primary" icon="add">
                Connect First Provider
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Source Node */}
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/60 p-4 lg:w-[230px] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="icon-box icon-box-sm text-primary">
                  <Icon name="terminal" weight="duotone" className="text-[16px]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-text-main">Clients & CLI Agents</p>
                  <p className="text-[11px] text-text-muted">OpenAI / Claude / MCP SDKs</p>
                </div>
              </div>
              <div className="mt-1 flex items-center justify-between rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 font-mono text-[11px] text-text-muted">
                <span className="truncate">{endpoint || "/v1"}</span>
                <span className="status-dot status-dot-live" />
              </div>
            </div>

            {/* Connector Arrow */}
            <div className="hidden lg:flex items-center justify-center text-primary/60 shrink-0">
              <div className="h-0.5 w-6 bg-primary/30" />
              <Icon name="arrow_forward" className="text-[16px] text-primary" />
            </div>

            {/* Destination Provider Grid */}
            <div className="grid min-w-0 flex-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {activeConnections.map((connection) => {
                const isHealthy = connection.testStatus === "success";
                const isFailed =
                  connection.testStatus === "error" ||
                  connection.testStatus === "failed";
                return (
                  <Link
                    key={connection.id}
                    href={`/dashboard/providers/${connection.provider}`}
                    className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5 hover:border-primary/40 hover:bg-surface transition-all"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface p-1">
                        <ProviderIcon
                          src={getProviderIconSrc(connection.provider)}
                          alt={name(connection.provider)}
                          size={20}
                          className="object-contain"
                          fallbackText={name(connection.provider)
                            .slice(0, 2)
                            .toUpperCase()}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-main group-hover:text-primary transition-colors">
                          {connection.name || name(connection.provider)}
                        </p>
                        <p className="truncate font-mono text-[11px] text-text-muted">
                          {name(connection.provider)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`status-dot ${
                        isFailed
                          ? "status-dot-err"
                          : isHealthy
                            ? "status-dot-live"
                            : "bg-text-subtle/50"
                      }`}
                      title={
                        isFailed
                          ? "Connection test failed"
                          : isHealthy
                            ? "Healthy"
                            : "Active"
                      }
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Quick Control Deck */}
      <section aria-label="Common tasks" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-soft hover:border-primary/45 hover:shadow-warm transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="icon-box text-primary group-hover:scale-105 transition-transform">
                <Icon name={item.icon} weight="duotone" className="text-[19px]" />
              </div>
              <Icon
                name="arrow_outward"
                className="text-[15px] text-text-subtle group-hover:text-primary transition-colors"
              />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-main group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="mt-1 text-xs text-text-muted leading-relaxed">
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </section>

      {/* Recent Requests Table */}
      <Card
        aria-labelledby="recent-requests-title"
        title="Recent requests"
        subtitle="Latest recorded traffic, token consumption, and upstream status across your router."
        icon="receipt_long"
        padding="none"
        action={
          <Link href="/dashboard/logs">
            <Button size="sm" variant="ghost" iconRight="arrow_forward">
              View all logs
            </Button>
          </Link>
        }
        className="overflow-hidden [&>div:first-child]:px-5 [&>div:first-child]:pt-5 [&>div:first-child]:mb-3"
      >
        {loading ? (
          <div className="flex items-center gap-3 px-5 py-8 text-sm text-text-muted border-t border-border-subtle">
            <Icon name="progress_activity" className="animate-spin text-primary text-[18px]" />
            <span>Loading recent requests…</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 border-t border-border-subtle px-5 py-10 text-center">
            <div className="icon-box text-text-muted">
              <Icon name="history" weight="duotone" className="text-[20px]" />
            </div>
            <p className="text-sm font-medium text-text-main">
              No requests recorded yet
            </p>
            <p className="text-xs text-text-muted max-w-md">
              Send a chat completion or responses request to <code className="font-mono text-primary">{endpoint || "/v1"}</code> to see live routing telemetry here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-border-subtle">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Provider / Model</th>
                  <th className="px-5 py-3 text-right">Prompt</th>
                  <th className="px-5 py-3 text-right">Output</th>
                  <th className="px-5 py-3 text-right">Total Tokens</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {requests.map((item) => {
                  const isErr = failed(item);
                  const isOk = succeeded(item);
                  return (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-text-muted">
                        {formatTime(item.timestamp)}
                      </td>
                      <td className="max-w-[320px] px-5 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProviderIcon
                            src={getProviderIconSrc(item.provider)}
                            alt={name(item.provider)}
                            size={18}
                            className="shrink-0 rounded object-contain"
                            fallbackText={name(item.provider).slice(0, 2).toUpperCase()}
                          />
                          <span className="truncate font-medium text-text-main">
                            {name(item.provider)}
                          </span>
                          <span className="truncate font-mono text-xs text-text-muted">
                            / {item.model || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-text-muted">
                        {promptTokensOf(item).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs tabular-nums text-text-muted">
                        {completionTokensOf(item).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-xs font-semibold tabular-nums text-text-main">
                        {tokens(item).toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge
                          variant={isErr ? "danger" : isOk ? "success" : "neutral"}
                          dot
                          size="xs"
                        >
                          {item.status || (isErr ? "Error" : "OK")}
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
