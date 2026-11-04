"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardSkeleton, Drawer } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

const STATUS_URL = "/api/mcp/status";

function timeAgo(ts) {
  if (!ts) return "never";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function ForwardingMetrics({ health }) {
  if (!health || health.total === 0) {
    return <span className="text-[11px] text-text-muted">No forwarded calls</span>;
  }
  const pct = Math.round((health.ok / health.total) * 100);
  const color = pct >= 95 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-danger";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-16 h-1.5 rounded-full bg-surface-2 overflow-hidden shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono tabular-nums text-text-muted shrink-0">
        {pct}% ({health.ok}/{health.total})
      </span>
    </div>
  );
}


export default function McpPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedPlugin, setSelectedPlugin] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(STATUS_URL, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load MCP status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const bridge = data?.bridge;
  const plugins = data?.plugins || [];

  const filtered = plugins.filter((p) => {
    const matchesFilter = filter === "all" || p.type === filter;
    const matchesSearch =
      !search.trim() ||
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.title && p.title.toLowerCase().includes(search.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const filterOptions = [
    { value: "all", label: `All (${plugins.length})` },
    { value: "local", label: `Local (${plugins.filter((p) => p.type === "local").length})` },
    { value: "remote", label: `Remote (${plugins.filter((p) => p.type === "remote").length})` },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="extension" className="text-primary text-[24px]" />
            MCP
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Model Context Protocol — bridge status, stdio/sse transports, tool forward telemetry.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={load}
          disabled={loading}
          icon="refresh"
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card className="border-danger/30 text-xs text-danger" padding="sm">
          {error}
        </Card>
      )}

      {/* ── Summary Stats ────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="cable" className="text-[16px]" />
            <span>Total Plugins</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : (bridge?.localCount ?? 0) + (bridge?.remoteCount ?? 0)}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {loading ? "" : `${bridge?.localCount ?? 0} local · ${bridge?.remoteCount ?? 0} remote`}
          </p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="play_circle" className="text-[16px]" />
            <span>Active Bridges</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : bridge?.runningCount ?? 0}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {loading ? "" : `of ${bridge?.localCount ?? 0} stdio`}
          </p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="build" className="text-[16px]" />
            <span>Registered Tools</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : bridge?.totalTools ?? 0}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">across all connected plugins</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="health_and_safety" className="text-[16px]" />
            <span>Gateway API</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant={data?.api?.responding ? "success" : "danger"} dot size="sm">
              {loading ? "Checking" : data?.api?.responding ? "Responding" : "Error"}
            </Badge>
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">local endpoint</p>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Search plugins by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-main cursor-pointer">
                <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                filter === opt.value
                  ? "bg-surface text-text-main shadow-xs font-semibold"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dense Table ─────────────────────────────────────────── */}
      {loading ? (
        <CardSkeleton />
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Icon name="cable" className="text-[32px] text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-main">
              {plugins.length === 0 ? "No MCP plugins configured" : "No plugins match your filter"}
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Add local stdio tools or remote SSE plugin URLs in your server configuration.
            </p>
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
                  <th className="py-2.5 px-4 font-semibold text-text-main">Plugin</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Transport</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden sm:table-cell">Tools</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden md:table-cell">Forwarded Tool Calls</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((plugin) => {
                  const isLocal = plugin.type === "local";
                  const statusLabel = isLocal ? (plugin.running ? "Running" : "Stopped") : "Remote";
                  const statusVariant = isLocal ? (plugin.running ? "success" : "default") : "info";

                  return (
                    <tr
                      key={plugin.name}
                      onClick={() => setSelectedPlugin(plugin)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 max-w-[240px]">
                        <div className="flex items-center gap-2">
                          <Icon
                            name={isLocal ? "dns" : "cloud"}
                            className="text-text-muted text-[16px] shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-text-main truncate block">
                              {plugin.title || plugin.name}
                            </span>
                            <span className="text-[11px] text-text-muted truncate block">
                              {plugin.description || plugin.name}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant={statusVariant} size="sm" dot>
                          {statusLabel}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border-subtle">
                          <Icon
                            name={plugin.transport === "stdio" ? "terminal" : "swap_vert"}
                            className="text-[11px]"
                          />
                          {plugin.transport.toUpperCase()}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 hidden sm:table-cell font-mono tabular-nums text-text-muted">
                        <Badge variant="default" size="sm">
                          {plugin.tools?.length || 0} tools
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 hidden md:table-cell">
                        <ForwardingMetrics health={plugin.health} />
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="visibility"
                          onClick={() => setSelectedPlugin(plugin)}
                          title="View plugin detail"
                          aria-label={`View details for ${plugin.name}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Plugin Detail Drawer ─────────────────────────────────── */}
      <Drawer
        isOpen={!!selectedPlugin}
        onClose={() => setSelectedPlugin(null)}
        title={selectedPlugin?.title || selectedPlugin?.name || "Plugin Details"}
        width="md"
      >
        {selectedPlugin && (
          <div className="space-y-5 text-xs text-text-main">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</span>
              <p className="mt-1 text-sm text-text-main leading-relaxed">
                {selectedPlugin.description || "No description provided."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted">Type</span>
                <p className="mt-1 font-mono font-semibold text-text-main">{selectedPlugin.type}</p>
              </div>
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted">Transport</span>
                <p className="mt-1 font-mono font-semibold text-text-main">{selectedPlugin.transport}</p>
              </div>
            </div>

            {selectedPlugin.url && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Endpoint URL</span>
                <code className="block mt-1 p-2.5 rounded bg-surface-2 font-mono text-[11px] text-text-main break-all select-all">
                  {selectedPlugin.url}
                </code>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Registered Tools ({selectedPlugin.tools?.length || 0})
                </span>
              </div>
              {selectedPlugin.tools?.length === 0 ? (
                <p className="text-text-muted">No tools registered.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedPlugin.tools?.map((tool) => (
                    <div
                      key={tool.name}
                      className="p-2.5 rounded-md border border-border-subtle bg-surface-2/40"
                    >
                      <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-text-main">
                        <Icon name="build" className="text-primary text-[12px]" />
                        {tool.name}
                      </div>
                      {tool.description && (
                        <p className="text-[11px] text-text-muted mt-1 leading-normal">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Forwarded Tool Calls</span>
              <div className="mt-2 p-3 rounded-md bg-surface-2 border border-border-subtle space-y-2">
                <ForwardingMetrics health={selectedPlugin.health} />
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-border-subtle">
                  <div>
                    <span className="text-text-muted block">Total Calls</span>
                    <strong className="font-mono">{selectedPlugin.health?.total ?? 0}</strong>
                  </div>
                  <div>
                    <span className="text-text-muted block">Forwarded</span>
                    <strong className="font-mono text-success">{selectedPlugin.health?.ok ?? 0}</strong>
                  </div>
                  <div>
                    <span className="text-text-muted block">Not forwarded</span>
                    <strong className="font-mono text-danger">{selectedPlugin.health?.fail ?? 0}</strong>
                  </div>
                </div>
                {selectedPlugin.health?.lastTs && (
                  <p className="text-[10px] font-mono text-text-muted pt-1">
                    Last forwarding: {timeAgo(selectedPlugin.health.lastTs)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
