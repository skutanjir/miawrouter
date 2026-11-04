"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardSkeleton, Drawer } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

const STATUS_URL = "/api/a2a/status";

function timeAgo(ts) {
  if (!ts) return "never";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function statusVariant(status) {
  switch (status) {
    case "completed":
      return "success";
    case "working":
      return "primary";
    case "submitted":
      return "info";
    case "failed":
      return "error";
    case "canceled":
      return "warning";
    default:
      return "default";
  }
}

function statusIcon(status) {
  switch (status) {
    case "completed":
      return "check_circle";
    case "working":
      return "progress_activity";
    case "submitted":
      return "schedule";
    case "failed":
      return "error";
    case "canceled":
      return "cancel";
    default:
      return "radio_button_unchecked";
  }
}

export default function A2aPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedSkill, setSelectedSkill] = useState(null);

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
      setError(err.message || "Failed to load A2A status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agentCard = data?.agentCard;
  const skills = agentCard?.skills || [];
  const tasks = data?.tasks || [];
  const endpoint = data?.endpoint || {};
  const auth = endpoint?.auth || {};

  const filteredTasks = tasks.filter((t) => {
    const matchesFilter = statusFilter === "all" || t.status === statusFilter;
    const matchesSearch =
      !search.trim() ||
      (t.name && t.name.toLowerCase().includes(search.toLowerCase())) ||
      (t.id && t.id.toLowerCase().includes(search.toLowerCase())) ||
      (t.skillId && t.skillId.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="smart_toy" className="text-primary text-[24px]" />
            A2A Communication
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Agent-to-Agent protocol — endpoint discovery, advertised capabilities, and task dispatch logs.
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
            <span>Agent Version</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : agentCard?.version ? `v${agentCard.version}` : "—"}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5 truncate">{agentCard?.name || "MiawRouter A2A"}</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="extension" className="text-[16px]" />
            <span>Advertised Skills</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : skills.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">ready for external agents</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="history" className="text-[16px]" />
            <span>Tasks Recorded</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : tasks.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {loading ? "" : `${tasks.filter((t) => t.status === "completed").length} completed`}
          </p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name={auth.requireLogin ? "lock" : "lock_open"} className="text-[16px]" />
            <span>Access Mode</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge variant={auth.requireLogin ? "success" : "warning"} dot size="sm">
              {loading ? "—" : auth.requireLogin ? "Protected" : "Open"}
            </Badge>
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">
            {auth.hasApiKeys ? "API keys active" : "No keys required"}
          </p>
        </div>
      </div>

      {/* ── Agent Specs & Advertised Skills ──────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Endpoint Card */}
        <div className="rounded-[10px] border border-border bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="flex items-center gap-2">
              <Icon name="api" className="text-primary text-[18px]" />
              <h2 className="text-sm font-semibold text-text-main">A2A Endpoint Details</h2>
            </div>
            <span className="text-[11px] font-mono text-text-muted">{agentCard?.name}</span>
          </div>
          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-[11px] text-text-muted block">A2A Agent Endpoint</span>
              <code className="block mt-1 px-2.5 py-1.5 rounded bg-surface-2 font-mono text-[11px] text-text-main select-all border border-border-subtle">
                {endpoint.a2aEndpoint || "—"}
              </code>
            </div>
            <div>
              <span className="text-[11px] text-text-muted block">Gateway URL</span>
              <code className="block mt-1 px-2.5 py-1.5 rounded bg-surface-2 font-mono text-[11px] text-text-muted select-all border border-border-subtle">
                {endpoint.endpoint || "—"}
              </code>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <span className="text-[11px] text-text-muted block">Input Modes</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(agentCard?.defaultInputModes || ["text"]).map((m) => (
                    <span key={m} className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-[10px] text-text-main border border-border-subtle">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[11px] text-text-muted block">Output Modes</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(agentCard?.defaultOutputModes || ["text"]).map((m) => (
                    <span key={m} className="px-1.5 py-0.5 rounded bg-surface-2 font-mono text-[10px] text-text-main border border-border-subtle">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Advertised Skills */}
        <div className="rounded-[10px] border border-border bg-surface p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <div className="flex items-center gap-2">
              <Icon name="extension" className="text-primary text-[18px]" />
              <h2 className="text-sm font-semibold text-text-main">Advertised Skills ({skills.length})</h2>
            </div>
            <Badge variant="default" size="sm">Read-only</Badge>
          </div>

          <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
            {skills.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No skills advertised.</p>
            ) : (
              skills.map((skill) => (
                <div
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className="flex items-center justify-between p-2 rounded-md border border-border-subtle hover:bg-surface-2 cursor-pointer transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-xs text-text-main truncate">{skill.name}</span>
                      <code className="text-[10px] font-mono text-text-muted">{skill.id}</code>
                    </div>
                    <p className="text-[11px] text-text-muted truncate">{skill.description}</p>
                  </div>
                  <Icon name="arrow_forward" className="text-[14px] text-text-muted shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Task History Toolbar & Dense Table ───────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-main">Task Dispatch Log</h2>
            <span className="text-xs font-mono text-text-muted">({filteredTasks.length} tasks)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-surface text-xs min-w-[200px]">
              <Icon name="search" className="text-text-muted text-[14px]" />
              <input
                type="text"
                placeholder="Filter tasks…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-main">
                  <Icon name="close" className="text-[12px]" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border text-xs">
              {["all", "completed", "working", "failed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded transition-colors cursor-pointer capitalize ${
                    statusFilter === status
                      ? "bg-surface text-text-main font-semibold shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <CardSkeleton />
        ) : filteredTasks.length === 0 ? (
          <Card padding="md">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Icon name="inbox" className="text-[32px] text-text-muted mb-2" />
              <p className="text-sm font-semibold text-text-main">
                {tasks.length === 0 ? "No A2A tasks submitted yet" : "No tasks matching filter"}
              </p>
              <p className="text-xs text-text-muted mt-1 max-w-sm">
                Incoming tasks from external multi-agent networks will appear here with execution status.
              </p>
            </div>
          </Card>
        ) : (
          <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
                    <th className="py-2.5 px-4 font-semibold text-text-main">Task</th>
                    <th className="py-2.5 px-4 font-semibold text-text-main">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-text-main hidden sm:table-cell">Skill</th>
                    <th className="py-2.5 px-4 font-semibold text-text-main hidden md:table-cell">ID</th>
                    <th className="py-2.5 px-4 font-semibold text-text-main">Submitted</th>
                    <th className="py-2.5 px-4 font-semibold text-text-main text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredTasks.map((task) => (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <Icon
                            name={statusIcon(task.status)}
                            className="text-[16px] text-text-muted shrink-0"
                          />
                          <span className="font-semibold text-text-main truncate">
                            {task.name || "Untitled task"}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant={statusVariant(task.status)} size="sm" dot>
                          {task.status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 hidden sm:table-cell whitespace-nowrap">
                        {task.skillId ? (
                          <code className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle">
                            {task.skillId}
                          </code>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-2.5 px-4 hidden md:table-cell font-mono text-[11px] text-text-muted">
                        {task.id.slice(0, 16)}…
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[11px] text-text-muted whitespace-nowrap">
                        {timeAgo(task.createdAt)}
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="visibility"
                          onClick={() => setSelectedTask(task)}
                          title="View task detail"
                          aria-label={`View task ${task.id}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Task Detail Drawer ───────────────────────────────────── */}
      <Drawer
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask ? `Task: ${selectedTask.name || selectedTask.id}` : "Task Details"}
        width="md"
      >
        {selectedTask && (
          <div className="space-y-4 text-xs text-text-main">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(selectedTask.status)} size="sm" dot>
                {selectedTask.status}
              </Badge>
              {selectedTask.skillId && (
                <code className="text-[11px] font-mono text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                  {selectedTask.skillId}
                </code>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted">Task ID</span>
                <code className="block mt-1 font-mono text-[11px] select-all truncate">{selectedTask.id}</code>
              </div>
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted">Created</span>
                <p className="mt-1 font-mono text-[11px]">{new Date(selectedTask.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {selectedTask.error && (
              <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-danger space-y-1">
                <span className="font-semibold block">Error</span>
                <p className="font-mono text-[11px]">{selectedTask.error}</p>
              </div>
            )}

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Input / Payload</span>
              <pre className="mt-1 p-3 rounded-md bg-surface-2 border border-border-subtle font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                {JSON.stringify(selectedTask.input || selectedTask.params || {}, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Result / Output</span>
              <pre className="mt-1 p-3 rounded-md bg-surface-2 border border-border-subtle font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                {JSON.stringify(selectedTask.result || selectedTask.output || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Skill Detail Drawer ──────────────────────────────────── */}
      <Drawer
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        title={selectedSkill?.name || "Skill Details"}
        width="md"
      >
        {selectedSkill && (
          <div className="space-y-4 text-xs text-text-main">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Skill ID</span>
              <code className="block mt-1 p-2 rounded bg-surface-2 font-mono text-[11px] select-all">
                {selectedSkill.id}
              </code>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</span>
              <p className="mt-1 text-sm leading-relaxed text-text-main">
                {selectedSkill.description}
              </p>
            </div>

            {selectedSkill.tags?.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Tags</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {selectedSkill.tags.map((tag) => (
                    <Badge key={tag} variant="default" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedSkill.examples?.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Prompt Examples</span>
                <ul className="mt-1.5 space-y-1.5">
                  {selectedSkill.examples.map((ex, i) => (
                    <li key={i} className="p-2 rounded bg-surface-2 border border-border-subtle font-mono text-[11px]">
                      {ex}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
