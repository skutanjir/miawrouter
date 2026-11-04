"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import { CardSkeleton } from "@/shared/components";
import { CLI_TOOLS, MITM_TOOLS } from "@/shared/constants/cliTools";
import { MitmLinkCard } from "./components";
import ToolSummaryCard from "./components/ToolSummaryCard";
import { Icon } from "@/shared/components/Icon";
import { cn } from "@/shared/utils/cn";

const ALL_STATUSES_URL = "/api/cli-tools/all-statuses";

const TOOL_CATEGORIES = {
  claude: "agent",
  codex: "agent",
  opencode: "agent",
  hermes: "agent",
  droid: "agent",
  openclaw: "agent",
  "grok-build": "agent",
  devin: "agent",
  cowork: "ide",
  cursor: "ide",
  cline: "ide",
  kilo: "ide",
  roo: "ide",
  continue: "ide",
  amp: "cli",
  copilot: "cli",
  "deepseek-tui": "tui",
  "oh-my-pi": "tui",
  jcode: "tui",
};

function SectionControlStrip({ title, count, icon, description }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-subtle pb-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-primary">
            <Icon name={icon} weight="duotone" className="text-[16px]" aria-hidden="true" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold tracking-tight text-text-main">{title}</h2>
            {count !== undefined && (
              <span className="rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-text-muted">
                {count} {count === 1 ? "tool" : "tools"}
              </span>
            )}
          </div>
          {description && (
            <p className="text-[11.5px] text-text-muted mt-0.5">{description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

SectionControlStrip.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  icon: PropTypes.string,
  description: PropTypes.string,
};

export default function CLIToolsPageClient({ machineId }) {
  const [loading, setLoading] = useState(true);
  const [toolStatuses, setToolStatuses] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);

  const localEndpoint = typeof window !== "undefined"
    ? `${window.location.origin}/v1`
    : "http://localhost:21127/v1";

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(ALL_STATUSES_URL);
        if (res.ok && mounted) setToolStatuses(await res.json());
      } catch (error) {
        console.log("Error fetching tool statuses:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleCopyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(localEndpoint);
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } catch {
      // ignore
    }
  };

  const matches = (tool) =>
    `${tool.name} ${tool.description || ""}`.toLowerCase().includes(query.toLowerCase());

  // Count statistics
  const totalIntegrations = Object.keys(CLI_TOOLS).length + Object.keys(MITM_TOOLS).length;

  const { configuredCount, availableCount, agentsCount, ideCount, tuiCount, mitmCount } = useMemo(() => {
    let conf = 0;
    let avail = 0;
    let agents = 0;
    let ide = 0;
    let tui = 0;

    Object.entries(CLI_TOOLS).forEach(([toolId]) => {
      const st = toolStatuses[toolId];
      const isConf = st?.hasMiawRouter || st?.configured;
      if (isConf) conf++;
      else avail++;

      const cat = TOOL_CATEGORIES[toolId];
      if (cat === "agent") agents++;
      else if (cat === "ide") ide++;
      else if (cat === "tui") tui++;
    });

    return {
      configuredCount: conf,
      availableCount: avail,
      agentsCount: agents,
      ideCount: ide,
      tuiCount: tui,
      mitmCount: Object.keys(MITM_TOOLS).length,
    };
  }, [toolStatuses]);

  // Filter logic
  const filteredRegularTools = Object.entries(CLI_TOOLS).filter(([id, tool]) => {
    if (!matches(tool)) return false;
    if (filter === "all") return true;
    if (filter === "connected") return toolStatuses[id]?.hasMiawRouter || toolStatuses[id]?.configured;
    if (filter === "installed") return toolStatuses[id]?.installed;
    if (filter === "available") return !(toolStatuses[id]?.hasMiawRouter || toolStatuses[id]?.configured);
    if (filter === "agent") return TOOL_CATEGORIES[id] === "agent";
    if (filter === "ide") return TOOL_CATEGORIES[id] === "ide";
    if (filter === "tui") return TOOL_CATEGORIES[id] === "tui";
    if (filter === "mitm") return false;
    return true;
  });

  const filteredMitmTools = Object.entries(MITM_TOOLS).filter(([, tool]) => {
    if (!matches(tool)) return false;
    if (filter === "all" || filter === "mitm") return true;
    return false;
  });

  const configuredTools = filteredRegularTools.filter(([toolId]) => {
    const status = toolStatuses[toolId];
    return status?.hasMiawRouter || status?.configured;
  });

  const availableTools = filteredRegularTools.filter(([toolId]) => {
    const status = toolStatuses[toolId];
    return !(status?.hasMiawRouter || status?.configured);
  });

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-1 sm:px-0">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="workspace-canvas cli-workspace mx-auto flex w-full max-w-7xl flex-col gap-6 px-1 sm:px-0">
      {/* ── Header Area ────────────────────────────────────────────────────────── */}
      <div className="workspace-heading flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="icon-box icon-box-lg text-primary mt-0.5">
            <Icon name="terminal" weight="duotone" className="text-[20px]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold tracking-tight text-text-main sm:text-2xl">
                CLI Tools &amp; Coding Agents
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold uppercase tracking-wider text-text-main">
                <span className="status-dot status-dot-live" />
                Live Gateway
              </span>
              <span className="rounded-md border border-border bg-surface px-2 py-0.5 font-mono text-[10.5px] text-text-muted">
                v1.2.5 Core
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted max-w-2xl">
              Route and proxy requests from your favorite CLI coding assistants, autonomous agents, and IDE extensions through MiawRouter&apos;s unified multi-provider engine.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyEndpoint}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-text-main"
                title="Click to copy local OpenAI / Anthropic endpoint"
              >
                <Icon name={copiedEndpoint ? "check" : "content_copy"} className={cn("text-[13px]", copiedEndpoint && "text-success")} />
                <span>{copiedEndpoint ? "Copied Endpoint!" : "Copy Local /v1 Endpoint"}</span>
              </button>
              <Link
                href="/dashboard/mitm"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-text-main"
              >
                <Icon name="security" className="text-[13px] text-primary" />
                <span>MITM Proxy &amp; Certificates</span>
              </Link>
              <Link
                href="/dashboard/endpoint"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-text-muted transition-colors hover:border-primary/40 hover:bg-surface-2 hover:text-text-main"
              >
                <Icon name="vpn_key" className="text-[13px] text-primary" />
                <span>API Keys</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start lg:self-end">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs font-semibold text-text-main">
            <span className="text-text-muted">Total Ecosystem:</span>
            <span>{totalIntegrations} tools</span>
          </span>
        </div>
      </div>

      {/* ── Quick Telemetry Rack (3 Stat Cards) ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Active Bridges */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Active Bridges</span>
            <span className="flex size-7 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
              <Icon name="check_circle" className="text-[15px]" />
            </span>
          </div>
          <div className="mt-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tracking-tight text-text-main">
                {configuredCount}
              </span>
              <span className="font-mono text-xs text-text-muted">
                / {Object.keys(CLI_TOOLS).length} CLI tools
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-success transition-all duration-300"
                style={{ width: `${Math.round((configuredCount / (Object.keys(CLI_TOOLS).length || 1)) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-text-muted">
              {availableCount} tools ready to be bridged
            </p>
          </div>
        </div>

        {/* Card 2: Universal Gateway URL */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Gateway Endpoint</span>
            <span className="flex size-7 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
              <Icon name="hub" className="text-[15px]" />
            </span>
          </div>
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-surface-2 px-2.5 py-1">
              <code className="truncate font-mono text-xs font-semibold text-text-main" title={localEndpoint}>
                {localEndpoint}
              </code>
              <button
                type="button"
                onClick={handleCopyEndpoint}
                className="text-text-muted hover:text-text-main transition-colors shrink-0"
                aria-label="Copy endpoint URL"
              >
                <Icon name={copiedEndpoint ? "check" : "content_copy"} className={cn("text-[13px]", copiedEndpoint && "text-success")} />
              </button>
            </div>
            <p className="mt-2 text-[11px] text-text-muted">
              Universal OpenAI &amp; Anthropic wire-compatible route
            </p>
          </div>
        </div>

        {/* Card 3: Autonomous Subagent Support */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Subagent Relay</span>
            <span className="flex size-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-main">
              <Icon name="smart_toy" className="text-[15px]" />
            </span>
          </div>
          <div className="mt-2.5">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex size-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-bold text-text-main">
                Cross-Tool Orchestration
              </span>
            </div>
            <p className="mt-1 text-[11px] text-text-muted leading-relaxed">
              Native support for tool calling, MCP servers, and background delegated agent teams.
            </p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Directory Toolbar ───────────────────────────────── */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-text-muted"
            aria-hidden="true"
          />
          <input
            aria-label="Search CLI tools"
            placeholder="Search 26 coding tools, IDEs, protocols…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-2 py-1.5 pl-9 pr-8 text-xs text-text-main placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              aria-label="Clear search"
            >
              <Icon name="close" className="text-[14px]" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {[
            { id: "all", label: `All (${totalIntegrations})` },
            { id: "connected", label: `Connected (${configuredCount})` },
            { id: "available", label: `Available (${availableCount})` },
            { id: "agent", label: `Agents (${agentsCount})` },
            { id: "ide", label: `IDEs (${ideCount})` },
            { id: "tui", label: `TUIs (${tuiCount})` },
            { id: "mitm", label: `MITM (${mitmCount})` },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === item.id
                  ? "bg-surface-2 text-text-main border border-border font-semibold shadow-2xs"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {filteredRegularTools.length === 0 && filteredMitmTools.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border bg-surface/40">
          <div className="flex size-12 items-center justify-center rounded-xl bg-surface-2 text-text-muted mb-3">
            <Icon name="search_off" className="text-[24px]" />
          </div>
          <h3 className="text-sm font-semibold text-text-main">No integrations match</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm">
            Try adjusting your search query or selecting a different filter category.
          </p>
          <button
            type="button"
            onClick={() => { setQuery(""); setFilter("all"); }}
            className="mt-4 text-xs text-primary font-medium hover:underline"
          >
            Reset all filters
          </button>
        </div>
      )}

      {/* ── Configured Tools ─────────────────────────────────────────────────── */}
      {configuredTools.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <SectionControlStrip
            title="Configured & Active Tools"
            count={configuredTools.length}
            icon="check_circle"
            description="Coding assistants currently sending traffic through MiawRouter local proxy"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {configuredTools.map(([toolId, tool]) => (
              <ToolSummaryCard key={toolId} toolId={toolId} tool={tool} status={toolStatuses[toolId]} />
            ))}
          </div>
        </div>
      )}

      {/* ── Available Tools ──────────────────────────────────────────────────── */}
      {availableTools.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <SectionControlStrip
            title="Available Integrations"
            count={availableTools.length}
            icon="terminal"
            description="Install or configure these tools to route through your local models and keys"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {availableTools.map(([toolId, tool]) => (
              <ToolSummaryCard key={toolId} toolId={toolId} tool={tool} status={toolStatuses[toolId]} />
            ))}
          </div>
        </div>
      )}

      {/* ── Intercepted (MITM) Tools ─────────────────────────────────────────── */}
      {filteredMitmTools.length > 0 && (
        <div className="flex flex-col gap-3.5">
          <SectionControlStrip
            title="Transparent MITM Interception"
            count={filteredMitmTools.length}
            icon="security"
            description="IDE tools intercepted transparently via local TLS certificates and DNS routing"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredMitmTools.map(([toolId, tool]) => (
              <MitmLinkCard key={toolId} tool={tool} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

CLIToolsPageClient.propTypes = {
  machineId: PropTypes.string,
};
