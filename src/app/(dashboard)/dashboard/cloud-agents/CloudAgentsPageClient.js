"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardSkeleton, Drawer } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

const STATUS_URL = "/api/agents";

function timeAgo(ts) {
  if (!ts) return "never";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function statusVariant(state) {
  switch (state) {
    case "configured":
      return "success";
    case "available":
      return "info";
    case "running":
      return "primary";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

export default function CloudAgentsPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(null);

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
      setError(err.message || "Failed to load agent status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agents = data?.agents || [];
  const lifecycles = data?.lifecycles || {};
  const configured = agents.filter((a) => a.status?.configured).length;
  const running = agents.filter((a) => a.status?.running).length;
  const errors = agents.filter((a) => a.status?.state === "error").length;

  const filtered = agents.filter((agent) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "cloud-cli" && agent.kind === "cloud-cli") ||
      (filter === "cli" && agent.kind === "cli") ||
      (filter === "configured" && agent.status?.configured) ||
      (filter === "running" && agent.status?.running);

    const matchesSearch =
      !search.trim() ||
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.id.toLowerCase().includes(search.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="smart_toy" className="text-primary text-[24px]" />
            Agent Registry
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Registered CLI, cloud CLI, and desktop assistant integrations with probe verification.
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
            <Icon name="smart_toy" className="text-[16px]" />
            <span>Total Agents</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : agents.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {loading ? "" : `${agents.filter((a) => a.kind === "cloud-cli").length} cloud · ${agents.filter((a) => a.kind === "cli").length} CLI`}
          </p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="check_circle" className="text-[16px]" />
            <span>Configured</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main text-success">
            {loading ? "—" : configured}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">verified local credentials</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="play_circle" className="text-[16px]" />
            <span>Active / Running</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : running}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">live probe checks</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="error" className="text-[16px]" />
            <span>Errors</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main text-danger">
            {loading ? "—" : errors}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {errors > 0 ? "requires re-authentication" : "all probes nominal"}
          </p>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Filter agents by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs font-sans"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-main cursor-pointer">
                <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border overflow-x-auto text-xs">
          {[
            { id: "all", label: `All (${agents.length})` },
            { id: "cloud-cli", label: "Cloud" },
            { id: "cli", label: "CLI" },
            { id: "configured", label: "Configured" },
            { id: "running", label: "Running" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`px-3 py-1 rounded transition-colors cursor-pointer whitespace-nowrap font-medium ${
                filter === item.id
                  ? "bg-surface text-text-main font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dense Table ─────────────────────────────────────────── */}
      {loading ? (
        <CardSkeleton />
      ) : filtered.length === 0 ? (
        <Card padding="md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name="smart_toy" className="text-[32px] text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-main">No agents found</p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              No registered agents match the selected filter or search terms.
            </p>
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
                  <th className="py-2.5 px-4 font-semibold text-text-main">Agent</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">State</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Kind</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden sm:table-cell">Capabilities</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden md:table-cell">Probes</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((agent) => {
                  const state = agent.status?.state || "unconfigured";
                  const isCloud = agent.kind === "cloud-cli";
                  const isCli = agent.kind === "cli";
                  const caps = Object.keys(agent.capabilities || {});

                  return (
                    <tr
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 max-w-[220px]">
                        <div className="flex items-center gap-2.5">
                          <Icon
                            name={isCloud ? "cloud" : isCli ? "terminal" : "smart_toy"}
                            className="text-text-muted text-[16px] shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-semibold text-text-main truncate block">
                              {agent.name}
                            </span>
                            <span className="text-[11px] font-mono text-text-muted truncate block">
                              {agent.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant={statusVariant(state)} size="sm" dot>
                          {state}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-text-muted">
                        <Badge variant={isCloud ? "info" : "default"} size="sm">
                          {agent.kind}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {caps.slice(0, 3).map((cap) => (
                            <span
                              key={cap}
                              className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-[10px] text-text-muted border border-border-subtle"
                            >
                              {cap}
                            </span>
                          ))}
                          {caps.length > 3 && (
                            <span className="text-[10px] text-text-muted">+{caps.length - 3}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 hidden md:table-cell font-mono text-[11px] text-text-muted">
                        <span className={agent.status?.running ? "text-success" : ""}>
                          {agent.status?.running ? "running" : agent.status?.available ? "ready" : "offline"}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="visibility"
                          onClick={() => setSelectedAgent(agent)}
                          title="View agent details"
                          aria-label={`View details for ${agent.name}`}
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

      {/* ── Detail Drawer ────────────────────────────────────────── */}
      <Drawer
        isOpen={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        title={selectedAgent?.name || "Agent Details"}
        width="md"
      >
        {selectedAgent && (
          <div className="space-y-5 text-xs text-text-main font-sans">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(selectedAgent.status?.state)} size="sm" dot>
                {selectedAgent.status?.state || "unknown"}
              </Badge>
              <Badge variant="default" size="sm">
                {selectedAgent.kind}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted block">Agent ID</span>
                <code className="block mt-1 font-mono text-[11px] truncate select-all">{selectedAgent.id}</code>
              </div>
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted block">Executable / Target</span>
                <code className="block mt-1 font-mono text-[11px] truncate select-all">
                  {selectedAgent.binary || selectedAgent.command || "system"}
                </code>
              </div>
            </div>

            {selectedAgent.status?.error && (
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-danger">
                <span className="font-semibold block mb-0.5">Probe Error</span>
                <p className="font-mono text-[11px]">{selectedAgent.status.error}</p>
              </div>
            )}

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Capabilities</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {Object.entries(selectedAgent.capabilities || {}).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2 rounded bg-surface-2 border border-border-subtle flex items-center justify-between"
                  >
                    <span className="font-mono text-[11px]">{key}</span>
                    <Badge variant={val ? "success" : "default"} size="sm">
                      {val ? "yes" : "no"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Probe Status</span>
              <pre className="mt-1 p-3 rounded-md bg-surface-2 border border-border-subtle font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                {JSON.stringify(selectedAgent.status || {}, null, 2)}
              </pre>
            </div>

            {lifecycles[selectedAgent.id] && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Lifecycle Log</span>
                <div className="mt-1 p-3 rounded-md bg-surface-2 border border-border-subtle font-mono text-[11px] space-y-1">
                  <p>Action: {lifecycles[selectedAgent.id].action}</p>
                  <p>Status: {lifecycles[selectedAgent.id].status}</p>
                  <p className="text-[10px] text-text-muted">
                    {timeAgo(lifecycles[selectedAgent.id].createdAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
