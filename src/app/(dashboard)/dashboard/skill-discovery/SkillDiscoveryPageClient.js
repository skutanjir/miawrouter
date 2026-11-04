"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardSkeleton, Modal, Select } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Icon } from "@/shared/components/Icon";

const API_URL = "/api/skill-discovery";
const MIAWROUTER = "miawrouter";

function SourceStatus({ source }) {
  const up = source.available === true;
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs ${
        up
          ? "bg-success/5 border-success/20 text-success"
          : "bg-danger/5 border-danger/20 text-danger"
      }`}
    >
      <Icon name={up ? "check_circle" : "error"} className="text-[12px] shrink-0" />
      <span className="font-semibold">{source.id}</span>
      {up ? (
        <span className="text-text-muted font-mono">
          {source.note || `(${source.count ?? 0})`}
        </span>
      ) : (
        <span className="truncate">{source.error || "Unavailable"}</span>
      )}
    </div>
  );
}

function CopyButton({ value, label = "Copy" }) {
  const { copied, copy } = useCopyToClipboard(2000);
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[11px] font-medium text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
      title={value}
    >
      <Icon name={copied ? "check" : "content_copy"} className="text-[11px]" />
      {copied ? "Copied" : label}
    </button>
  );
}

function InstallModal({ skill, targets, onClose, onDone }) {
  const [mode, setMode] = useState(MIAWROUTER);
  const [cliId, setCliId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const miawTarget = targets.find((t) => t.id === MIAWROUTER);
  const detectedClis = targets.filter((t) => t.id !== MIAWROUTER);
  const availableClis = detectedClis.filter((t) => t.available);

  useEffect(() => {
    if (availableClis.length > 0 && !cliId) setCliId(availableClis[0].id);
  }, [availableClis, cliId]);

  const install = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(skill.slug)}/install`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target: mode, cliId: mode === "cli" ? cliId : undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Install failed (${res.status})`);
      setResult(body);
      if (typeof onDone === "function") onDone();
    } catch (err) {
      setError(err.message || "Install failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Install ${skill.name}`}
      size="md"
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={install} loading={busy} icon="download">
              Install Skill
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-xs font-sans text-text-main">
        {!result ? (
          <>
            <div className="space-y-2">
              <span className="text-xs font-semibold text-text-main">Target destination</span>
              <label
                className={`flex items-start gap-2.5 rounded-md border p-3 cursor-pointer transition-colors ${
                  mode === MIAWROUTER ? "border-primary/40 bg-primary/5" : "border-border bg-surface-2/40"
                }`}
              >
                <input
                  type="radio"
                  name="target"
                  className="mt-0.5 accent-primary"
                  checked={mode === MIAWROUTER}
                  onChange={() => setMode(MIAWROUTER)}
                />
                <div>
                  <span className="font-semibold text-text-main block">
                    {miawTarget?.label || "MiawRouter Global Registry"}
                  </span>
                  <span className="text-[11px] text-text-muted block mt-0.5">
                    Registers the manifest for local agent routing and automated dispatch.
                  </span>
                </div>
              </label>

              {availableClis.length > 0 && (
                <label
                  className={`flex items-start gap-2.5 rounded-md border p-3 cursor-pointer transition-colors ${
                    mode === "cli" ? "border-primary/40 bg-primary/5" : "border-border bg-surface-2/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="target"
                    className="mt-0.5 accent-primary"
                    checked={mode === "cli"}
                    onChange={() => setMode("cli")}
                  />
                  <div>
                    <span className="font-semibold text-text-main block">Local CLI Target</span>
                    <span className="text-[11px] text-text-muted block mt-0.5">
                      Returns canonical install command for your detected developer CLI.
                    </span>
                  </div>
                </label>
              )}
            </div>

            {mode === "cli" && availableClis.length > 0 && (
              <Select
                label="Select Target CLI"
                options={availableClis.map((t) => ({ value: t.id, label: t.label }))}
                value={cliId}
                onChange={(e) => setCliId(e.target.value)}
              />
            )}

            {error && (
              <div className="p-2.5 rounded-md bg-danger/10 border border-danger/20 text-danger flex items-center gap-2">
                <Icon name="error" className="text-[16px] shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-success/10 border border-success/20 text-success flex items-center gap-2">
              <Icon name="check_circle" className="text-[18px] shrink-0" />
              <span className="font-semibold">Skill installation completed</span>
            </div>

            {result.cliCommand && (
              <div className="space-y-1">
                <span className="text-[11px] text-text-muted">Run this in your terminal:</span>
                <div className="flex items-center justify-between gap-2 p-2 rounded bg-surface-2 border border-border font-mono text-[11px]">
                  <code className="truncate">{result.cliCommand}</code>
                  <CopyButton value={result.cliCommand} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function SkillDiscoveryPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [installedFilter, setInstalledFilter] = useState("all");
  const [installSkill, setInstallSkill] = useState(null);

  const buildUrl = useCallback(({ query, source, installed }) => {
    const qs = new URLSearchParams();
    const q = query?.trim();
    if (q) qs.set("query", q.slice(0, 100));
    if (source && source !== "all") qs.set("source", source);
    if (installed === "installed") qs.set("installed", "true");
    if (installed === "not-installed") qs.set("installed", "false");
    const s = qs.toString();
    return s ? `${API_URL}?${s}` : API_URL;
  }, []);

  const load = useCallback(async (params = {}) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildUrl(params), { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load skill discovery");
    } finally {
      setLoading(false);
    }
  }, [buildUrl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load({ query: search, source: sourceFilter, installed: installedFilter });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, sourceFilter, installedFilter, load]);

  const items = data?.items || [];
  const sources = data?.sources || [];
  const targets = data?.targets || [];
  const counts = data?.counts || {};
  const detected = data?.detected || [];

  const installedCount = useMemo(() => items.filter((s) => s.installed).length, [items]);

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="explore" className="text-primary text-[24px]" />
            Skill Discovery
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Search the built-in skill catalog and skills.sh directory, inspect capabilities, and install with 1-click.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => load({ query: search, source: sourceFilter, installed: installedFilter })}
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
            <span>Total Catalog</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : counts.total ?? items.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">available across registries</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="hub" className="text-[16px]" />
            <span>Built-in</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : counts.local ?? 0}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">curated local skills</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="cloud" className="text-[16px]" />
            <span>Community (skills.sh)</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : counts.remote ?? 0}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">open-source directory</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="check_circle" className="text-[16px]" />
            <span>Installed</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main text-success">
            {loading ? "—" : counts.installed ?? installedCount}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">active on this host</p>
        </div>
      </div>

      {/* ── Detected Skills Banner ───────────────────────────────── */}
      {detected.length > 0 && (
        <div className="p-3 rounded-[10px] border border-border bg-surface flex items-start gap-3">
          <Icon name="manage_search" className="text-primary text-[18px] mt-0.5 shrink-0" />
          <div className="text-xs space-y-1.5 flex-1 min-w-0">
            <span className="font-semibold text-text-main block">
              {detected.length} skill{detected.length !== 1 ? "s" : ""} detected on this workstation:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {detected.map((d) => (
                <span
                  key={`${d.source}-${d.slug}`}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-mono bg-surface-2 border border-border-subtle"
                >
                  <Icon name="check_circle" className="text-[11px] text-success" />
                  <span className="text-text-main font-semibold">{d.slug}</span>
                  <span className="text-text-muted">({d.source})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Source Statuses ───────────────────────────────────────── */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <SourceStatus key={s.id} source={s} />
          ))}
        </div>
      )}

      {/* ── Toolbar: Search & Filters ────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Search skills by name, slug, tag…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={100}
              className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs font-sans"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-main cursor-pointer">
                <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border">
            {[
              { v: "all", l: "All" },
              { v: MIAWROUTER, l: "Built-in" },
              { v: "skills.sh", l: "skills.sh" },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setSourceFilter(f.v)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer font-medium ${
                  sourceFilter === f.v
                    ? "bg-surface text-text-main font-semibold shadow-xs"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border">
            {[
              { v: "all", l: "Any status" },
              { v: "installed", l: "Installed" },
              { v: "not-installed", l: "Uninstalled" },
            ].map((f) => (
              <button
                key={f.v}
                onClick={() => setInstalledFilter(f.v)}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer font-medium ${
                  installedFilter === f.v
                    ? "bg-surface text-text-main font-semibold shadow-xs"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Searchable Catalog List with Install State ───────────── */}
      {loading ? (
        <CardSkeleton />
      ) : items.length === 0 ? (
        <Card padding="md">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Icon name="search_off" className="text-[32px] text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-main">
              {search.trim().length >= 2 ? "No skills match your search" : "No skills available"}
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Try broader search terms or switch from skills.sh to Built-in.
            </p>
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden divide-y divide-border-subtle">
          {items.map((skill) => {
            const installed = skill.installed === true;
            const isRemote = skill.source !== MIAWROUTER;

            return (
              <div
                key={skill.id}
                className="flex items-start justify-between gap-4 p-3.5 hover:bg-surface-2/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs font-semibold text-text-main">
                      {skill.name}
                    </h2>
                    <Badge variant={isRemote ? "info" : "default"} size="sm">
                      {skill.source}
                    </Badge>
                    {skill.builtin && (
                      <Badge variant="default" size="sm">
                        built-in
                      </Badge>
                    )}
                    {installed && (
                      <Badge variant="success" size="sm" dot>
                        installed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {skill.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap text-[11px] font-mono text-text-muted">
                    {skill.endpoint && (
                      <code className="px-1.5 py-0.5 rounded bg-surface-2 border border-border-subtle">
                        {skill.endpoint}
                      </code>
                    )}
                    {isRemote && skill.installs > 0 && (
                      <span>{skill.installs.toLocaleString()} installs</span>
                    )}
                    {isRemote && skill.sourceRef && (
                      <span className="truncate max-w-[240px]">ref: {skill.sourceRef}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  {installed ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-success/10 text-success text-xs font-semibold border border-success/20">
                      <Icon name="check" className="text-[12px]" />
                      Installed
                    </span>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      icon="download"
                      onClick={() => setInstallSkill(skill)}
                    >
                      Install
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Install Modal ────────────────────────────────────────── */}
      {installSkill && (
        <InstallModal
          skill={installSkill}
          targets={targets}
          onClose={() => setInstallSkill(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
