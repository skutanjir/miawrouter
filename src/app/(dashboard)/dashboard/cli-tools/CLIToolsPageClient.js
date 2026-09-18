"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { CardSkeleton } from "@/shared/components";
import { CLI_TOOLS, MITM_TOOLS } from "@/shared/constants/cliTools";
import { MitmLinkCard } from "./components";
import ToolSummaryCard from "./components/ToolSummaryCard";

const ALL_STATUSES_URL = "/api/cli-tools/all-statuses";

function SectionControlStrip({ title, count, icon }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border-subtle">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-1 h-3.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
        {icon && (
          <span className="material-symbols-outlined text-[15px] text-primary shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-main truncate">
          {title}
        </h2>
        {count !== undefined && (
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2 shrink-0">
            {count} {count === 1 ? "TOOL" : "TOOLS"}
          </span>
        )}
      </div>
    </div>
  );
}

SectionControlStrip.propTypes = {
  title: PropTypes.string.isRequired,
  count: PropTypes.number,
  icon: PropTypes.string,
};

export default function CLIToolsPageClient({ machineId }) {
  const [loading, setLoading] = useState(true);
  const [toolStatuses, setToolStatuses] = useState({});

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

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-1 sm:px-0">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  const regularTools = Object.entries(CLI_TOOLS);
  const mitmTools = Object.entries(MITM_TOOLS);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-1 sm:px-0">
      {/* Configure CLI Tools */}
      <div className="flex flex-col gap-3">
        <SectionControlStrip
          title="Configure CLI Tools"
          count={regularTools.length}
          icon="terminal"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {regularTools.map(([toolId, tool]) => (
            <ToolSummaryCard key={toolId} toolId={toolId} tool={tool} status={toolStatuses[toolId]} />
          ))}
        </div>
      </div>

      {/* MITM Tools */}
      <div className="flex flex-col gap-3">
        <SectionControlStrip
          title="MITM Tools"
          count={mitmTools.length}
          icon="security"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {mitmTools.map(([toolId, tool]) => (
            <MitmLinkCard key={toolId} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}

CLIToolsPageClient.propTypes = {
  machineId: PropTypes.string,
};
