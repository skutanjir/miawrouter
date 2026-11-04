"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardSkeleton, Drawer } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

const API_URL = "/api/discovery/skills";

function SourceStatus({ source }) {
  const isUp = source.status === "available";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs ${
        isUp
          ? "bg-success/5 border-success/20 text-success"
          : "bg-danger/5 border-danger/20 text-danger"
      }`}
    >
      <Icon name={isUp ? "check_circle" : "error"} className="text-[14px] shrink-0" />
      <span className="font-semibold">{source.id}</span>
      {isUp ? (
        <span className="text-text-muted font-mono">({source.count})</span>
      ) : (
        <span className="truncate">{source.error || "Unavailable"}</span>
      )}
    </div>
  );
}

export default function AgentSkillsPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load agent skills");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const items = data?.items || [];
  const sources = data?.sources || [];
  const availableSources = sources.filter((s) => s.status === "available");
  const bySource = {};
  for (const s of sources) if (s.status === "available") bySource[s.id] = s.count;

  const sourceIds = useMemo(
    () => [...new Set(items.map((s) => s.source))].filter(Boolean).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return items.filter((skill) => {
      if (sourceFilter !== "all" && skill.source !== sourceFilter) return false;
      if (!needle) return true;
      return [skill.id, skill.name, skill.description, skill.source].some((v) =>
        (v || "").toLowerCase().includes(needle)
      );
    });
  }, [items, search, sourceFilter]);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="extension" className="text-primary text-[24px]" />
            Agent Skills Catalog
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Aggregated skills and callable capabilities from A2A agents, MCP tool bridges, and internal registries.
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
            <Icon name="extension" className="text-[16px]" />
            <span>Total Skills</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : items.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">across connected sources</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="hub" className="text-[16px]" />
            <span>Active Sources</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : availableSources.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">of {sources.length} total providers</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="swap_horiz" className="text-[16px]" />
            <span>A2A Skills</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : (bySource.a2a ?? 0)}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">agent-to-agent protocol</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="cable" className="text-[16px]" />
            <span>MCP Tools</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : (bySource.mcp ?? 0)}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">forwarded local/remote tools</p>
        </div>
      </div>

      {/* ── Source Statuses ───────────────────────────────────────── */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <SourceStatus key={s.id} source={s} />
          ))}
        </div>
      )}

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Search skills by name, description, ID…"
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
          <button
            onClick={() => setSourceFilter("all")}
            className={`px-3 py-1 rounded transition-colors cursor-pointer font-medium whitespace-nowrap ${
              sourceFilter === "all"
                ? "bg-surface text-text-main font-semibold shadow-xs"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            All ({items.length})
          </button>
          {sourceIds.map((id) => (
            <button
              key={id}
              onClick={() => setSourceFilter(id)}
              className={`px-3 py-1 rounded transition-colors cursor-pointer font-medium uppercase whitespace-nowrap ${
                sourceFilter === id
                  ? "bg-surface text-text-main font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {id} ({items.filter((s) => s.source === id).length})
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
            <Icon name="extension" className="text-[32px] text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-main">
              {items.length === 0 ? "No skills registered" : "No matching skills found"}
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Skills are populated automatically when MCP tools and A2A endpoints are active.
            </p>
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
                  <th className="py-2.5 px-4 font-semibold text-text-main">Skill</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Source</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden sm:table-cell">Scope</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden md:table-cell">Endpoint / ID</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((skill) => {
                  const isAvailable = skill.status === "available";
                  return (
                    <tr
                      key={`${skill.source}-${skill.id}`}
                      onClick={() => setSelectedSkill(skill)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 max-w-[260px]">
                        <span className="font-semibold text-text-main block truncate">
                          {skill.name}
                        </span>
                        <span className="text-[11px] text-text-muted block truncate">
                          {skill.description}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant="default" size="sm">
                          {skill.source}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 hidden sm:table-cell whitespace-nowrap">
                        {skill.scope ? (
                          <Badge variant="info" size="sm">
                            {skill.scope}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant={isAvailable ? "success" : "warning"} size="sm" dot>
                          {skill.status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 hidden md:table-cell font-mono text-[11px] text-text-muted max-w-[180px] truncate">
                        {skill.endpoint || skill.id}
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="visibility"
                          onClick={() => setSelectedSkill(skill)}
                          title="View skill details"
                          aria-label={`View details for ${skill.name}`}
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
        isOpen={!!selectedSkill}
        onClose={() => setSelectedSkill(null)}
        title={selectedSkill?.name || "Skill Details"}
        width="md"
      >
        {selectedSkill && (
          <div className="space-y-4 text-xs text-text-main font-sans">
            <div className="flex items-center gap-2">
              <Badge variant={selectedSkill.status === "available" ? "success" : "warning"} size="sm" dot>
                {selectedSkill.status}
              </Badge>
              <Badge variant="default" size="sm">
                {selectedSkill.source}
              </Badge>
              {selectedSkill.scope && (
                <Badge variant="info" size="sm">
                  {selectedSkill.scope}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted block">ID</span>
                <code className="block mt-1 font-mono text-[11px] select-all truncate">{selectedSkill.id}</code>
              </div>
              <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                <span className="text-[11px] text-text-muted block">Source Registry</span>
                <p className="mt-1 font-mono font-semibold text-text-main">{selectedSkill.source}</p>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Description</span>
              <p className="mt-1 text-sm leading-relaxed text-text-main">
                {selectedSkill.description || "No description provided."}
              </p>
            </div>

            {selectedSkill.endpoint && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Callable Endpoint</span>
                <code className="block mt-1 p-2 rounded bg-surface-2 font-mono text-[11px] select-all break-all border border-border-subtle">
                  {selectedSkill.endpoint}
                </code>
              </div>
            )}

            {selectedSkill.inputSchema && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Input Schema (JSON)</span>
                <pre className="mt-1 p-3 rounded-md bg-surface-2 border border-border-subtle font-mono text-[11px] overflow-x-auto max-h-60 custom-scrollbar">
                  {JSON.stringify(selectedSkill.inputSchema, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
