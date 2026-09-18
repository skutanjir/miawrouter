"use client";

import Link from "next/link";
import Image from "next/image";
import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

// Derive simple connected/configured/not-installed status from API payload
// Derive simple connected/configured/not-installed status from API payload
function getStatus(status, tool) {
  if (tool?.configType === "guide" && !tool?.autoConfig) {
    return { label: "Guide", state: "guide", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
  if (!status) return { label: "Unknown", state: "unknown", cls: "bg-surface-2 text-text-muted border-border-subtle" };
  if (!status.installed) return { label: "Not installed", state: "missing", cls: "bg-surface-2 text-text-muted border-border-subtle" };
  if (status.hasMiawRouter || status.configured) {
    return { label: "Connected", state: "connected", cls: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" };
  }
  return { label: "Not configured", state: "unconfigured", cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" };
}

export default function ToolSummaryCard({ toolId, tool, status }) {
  const s = getStatus(status, tool);
  const isConnected = s.state === "connected";
  const isPending = s.state === "unconfigured";
  const isGuide = s.state === "guide";

  const statusRailClass = isConnected
    ? "bg-primary"
    : isPending
      ? "bg-yellow-500"
      : isGuide
        ? "bg-blue-500"
        : "bg-border-subtle dark:bg-border/60";
  return (
    <Link href={`/dashboard/cli-tools/${toolId}`} className="group block min-w-0">
      <div
        className={cn(
          "relative flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 transition-all duration-150 cursor-pointer overflow-hidden",
          "hover:border-border hover:bg-surface-2/60"
        )}
      >
        <span
          className={cn("absolute inset-y-0 left-0 w-[3px] transition-colors", statusRailClass)}
          aria-hidden="true"
        />
        <div className="flex min-w-0 items-center gap-2.5 pl-1.5 flex-1">
          <div className="size-8 shrink-0 rounded-md flex items-center justify-center border border-border-subtle/50 bg-bg">
            {tool.image ? (
              <Image
                src={tool.image}
                alt={tool.name}
                width={22}
                height={22}
                className="size-[22px] object-contain rounded-xs"
                sizes="22px"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <span
                className="material-symbols-outlined text-[18px] text-primary"
              >
                {tool.icon || "terminal"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="truncate text-xs sm:text-sm font-semibold text-text-main group-hover:text-primary transition-colors leading-tight">
                {tool.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={cn("inline-block px-1.5 py-0.5 text-[10px] font-medium font-mono uppercase tracking-wider rounded border", s.cls)}>
                {s.label}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center pl-1 text-text-muted group-hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
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
  }).isRequired,
  status: PropTypes.object,
};
