"use client";

import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/Icon";

// Derive simple connected/configured/not-installed status from API payload
function getStatus(status, tool) {
  if (tool?.configType === "guide" && !tool?.autoConfig) {
    return {
      label: "Guide",
      state: "guide",
      cls: "bg-surface-2 text-text-muted border-border-subtle",
      dot: "bg-text-muted",
    };
  }
  if (!status) {
    return {
      label: "Status unavailable",
      state: "unknown",
      cls: "bg-surface-2 text-text-muted border-border-subtle",
      dot: "bg-text-muted",
    };
  }
  if (!status.installed) {
    return {
      label: "Not installed",
      state: "missing",
      cls: "bg-surface-2/60 text-text-muted/80 border-border-subtle",
      dot: "bg-text-muted/60",
    };
  }
  if (status.hasMiawRouter || status.configured) {
    return {
      label: "Connected",
      state: "connected",
      cls: "bg-success/10 text-success border-success/30 font-semibold",
      dot: "status-dot-live",
    };
  }
  return {
    label: "Not configured",
    state: "unconfigured",
    cls: "bg-warning/10 text-warning border-warning/30",
    dot: "bg-warning",
  };
}

const TOOL_METADATA = {
  claude: { cmd: "claude", protocol: "Anthropic API", category: "Agent" },
  codex: { cmd: "codex", protocol: "OpenAI Responses", category: "Agent" },
  opencode: { cmd: "opencode", protocol: "OpenAI Wire", category: "Agent" },
  cowork: { cmd: "claude-desktop", protocol: "MCP Host", category: "Desktop" },
  hermes: { cmd: "hermes", protocol: "Tool Calling", category: "Agent" },
  droid: { cmd: "droid", protocol: "Autonomous Agent", category: "Agent" },
  cursor: { cmd: "cursor", protocol: "OpenAI Wire", category: "IDE" },
  cline: { cmd: "cline", protocol: "VSCode Extension", category: "IDE" },
  kilo: { cmd: "kilo", protocol: "VSCode Extension", category: "IDE" },
  roo: { cmd: "roo", protocol: "Ollama / OpenAI", category: "IDE" },
  continue: { cmd: "continue", protocol: "JSON Config", category: "IDE" },
  amp: { cmd: "amp", protocol: "CLI Assistant", category: "CLI" },
  openclaw: { cmd: "openclaw", protocol: "CLI Agent", category: "Agent" },
  "deepseek-tui": { cmd: "deepseek", protocol: "Terminal TUI", category: "TUI" },
  "oh-my-pi": { cmd: "omp", protocol: "Terminal Agent", category: "TUI" },
  jcode: { cmd: "jcode", protocol: "Rust TUI", category: "TUI" },
  "grok-build": { cmd: "grok build", protocol: "xAI Grok Wire", category: "Agent" },
  devin: { cmd: "devin", protocol: "Cognition MCP", category: "Agent" },
  copilot: { cmd: "gh copilot", protocol: "GitHub Copilot", category: "CLI" },
};

export default function ToolSummaryCard({ toolId, tool, status }) {
  const s = getStatus(status, tool);
  const isConnected = s.state === "connected";
  const meta = TOOL_METADATA[toolId] || {
    cmd: toolId,
    protocol: tool.configType === "env" ? "ENV Injection" : "OpenAI Wire",
    category: "CLI Tool",
  };

  return (
    <Link href={`/dashboard/cli-tools/${toolId}`} className="group block min-w-0">
      <div className="relative flex flex-col justify-between gap-3.5 rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-border-strong hover:bg-surface-2/60 hover:shadow-elevated min-h-[148px]">
        {/* Top row: Avatar, Info, Status Pill */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-2 p-1.5 shadow-2xs transition-transform duration-200 group-hover:scale-105 group-hover:border-primary/30">
              {tool.image ? (
                <Image
                  src={tool.image}
                  alt={tool.name}
                  width={28}
                  height={28}
                  className="size-[28px] rounded-xs object-contain"
                  sizes="28px"
                  onError={(e) => { e.target.style.display = "none"; }}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <Icon name={tool.icon || "terminal"} weight="duotone" className="text-[22px] text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="truncate text-[14px] font-bold text-text-main group-hover:text-primary transition-colors">
                  {tool.name}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono text-[10.5px] font-medium text-text-muted">
                  {meta.protocol}
                </span>
                <span className="text-[10px] text-text-subtle">·</span>
                <span className="text-[10.5px] text-text-muted">
                  {meta.category}
                </span>
              </div>
            </div>
          </div>

          {/* Status pill */}
          <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-mono", s.cls)}>
            <span className={cn("size-1.5 rounded-full", s.dot === "status-dot-live" ? "status-dot status-dot-live" : s.dot)} />
            <span>{s.label}</span>
          </span>
        </div>

        {/* Middle description */}
        <p className="line-clamp-2 text-xs leading-relaxed text-text-muted min-h-[32px]">
          {tool.description || "Integrate coding workflows directly through MiawRouter local relay."}
        </p>

        {/* Bottom footer: Command snippet + Action button */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-subtle/70">
          <code className="inline-flex items-center gap-1 font-mono text-[11px] text-text-muted/90 bg-surface-2/80 px-2 py-0.5 rounded border border-border-subtle" title={`Command: ${meta.cmd}`}>
            <span className="text-text-subtle select-none">$</span>
            <span className="truncate max-w-[130px]">{meta.cmd}</span>
          </code>

          <span className={cn(
            "inline-flex items-center gap-1 text-[11.5px] font-semibold transition-all px-2.5 py-1 rounded-lg border",
            isConnected
              ? "border-border bg-surface-2 text-text-main group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary"
              : "border-border-subtle bg-surface-2/40 text-text-muted group-hover:border-primary/40 group-hover:text-text-main"
          )}>
            <span>{isConnected ? "Manage" : "Configure"}</span>
            <Icon name="arrow_forward" className="text-[12px] transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

ToolSummaryCard.propTypes = {
  toolId: PropTypes.string.isRequired,
  tool: PropTypes.shape({
    name: PropTypes.string,
    image: PropTypes.string,
    icon: PropTypes.string,
    color: PropTypes.string,
    description: PropTypes.string,
    configType: PropTypes.string,
    autoConfig: PropTypes.bool,
  }).isRequired,
  status: PropTypes.object,
};
