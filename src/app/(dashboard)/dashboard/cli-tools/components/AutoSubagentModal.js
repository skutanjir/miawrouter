"use client";

import { useState, useEffect } from "react";
import { Modal, Button } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
import { ActionsBar } from "./ToolCardSections";
export default function AutoSubagentModal({ isOpen, onClose, onConfigured }) {
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [data, setData] = useState(null);
  const [roles, setRoles] = useState({
    explorer: "",
    reviewer: "",
    planner: "",
    fast: "",
    general: "",
  });
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/cli-tools/subagents");
        if (res.ok && mounted) {
          const json = await res.json();
          setData(json);
          if (json.recommendedRoles) {
            setRoles(json.recommendedRoles);
          }
        }
      } catch (err) {
        console.log("Error loading subagents data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  const handleApply = async () => {
    setApplying(true);
    setResult(null);
    try {
      const res = await fetch("/api/cli-tools/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customRoles: roles,
          targetTools: "all",
        }),
      });
      const resData = await res.json();
      setResult(resData);
      if (res.ok && onConfigured) {
        onConfigured();
      }
    } catch (err) {
      setResult({ success: false, errors: [{ error: err.message }] });
    } finally {
      setApplying(false);
    }
  };

  const installedToolsList = data?.installedTools
    ? Object.entries(data.installedTools).filter(([, installed]) => installed).map(([k]) => k)
    : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Auto-Configure Subagents (All Tools)">
      <div className="flex flex-col gap-4 max-h-[80vh] overflow-y-auto pr-1">
        <p className="text-xs text-text-muted">
          Automatically configures specialized subagent roles across all your installed CLI tools & native desktop apps (Claude Code, OpenCode, Codex, Hermes Agent & Desktop, Grok Build, Factory Droid, Open Claw).
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-6 justify-center text-text-muted text-xs">
            <Icon name={"progress_activity"} className=" animate-spin text-[18px]" />
            <span>Scanning installed tools & active providers...</span>
          </div>
        ) : (
          <>
            {/* Installed tools badges */}
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-surface/60 border border-border">
              <span className="text-xs font-semibold text-text-main">Detected Tools:</span>
              <div className="flex flex-wrap gap-1.5">
                {installedToolsList.length > 0 ? (
                  installedToolsList.map((tool) => (
                    <span
                      key={tool}
                      className="flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success"
                    >
                      <Icon name={"check"} className=" text-[12px]" />
                      {tool}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-muted italic">No tools detected locally; configs will be initialized safely.</span>
                )}
                <span className="flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Icon name={"desktop_windows"} className=" text-[12px]" />
                  Hermes Desktop (Native)
                </span>
              </div>
            </div>

            {/* Subagent Roles Assignment */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold text-text-main">Role & Model Mapping:</span>

              {/* Explorer Role */}
              <div className="flex flex-col gap-1 p-2.5 rounded-lg border border-border bg-surface/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-main flex items-center gap-1.5">
                    <Icon name={"search"} className="text-[16px] text-primary" />
                    Explorer / Search
                  </span>
                  <span className="text-[10px] text-text-muted">Fast codebase grep, symbols, file outlines</span>
                </div>
                <input
                  type="text"
                  value={roles.explorer}
                  onChange={(e) => setRoles({ ...roles, explorer: e.target.value })}
                  placeholder="e.g. ag/gemini-3.8-flash-high or deepseek-v4.1-flash"
                  className="w-full px-2 py-1.5 text-xs bg-surface rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Reviewer Role */}
              <div className="flex flex-col gap-1 p-2.5 rounded-lg border border-border bg-surface/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-main flex items-center gap-1.5">
                    <Icon name={"verified"} className="text-[16px] text-warning" />
                    Reviewer & Auditor
                  </span>
                  <span className="text-[10px] text-text-muted">Adversarial audit, logic bugs, verification</span>
                </div>
                <input
                  type="text"
                  value={roles.reviewer}
                  onChange={(e) => setRoles({ ...roles, reviewer: e.target.value })}
                  placeholder="e.g. ag/claude-sonnet-4-6 or deepseek-v4-pro"
                  className="w-full px-2 py-1.5 text-xs bg-surface rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Planner Role */}
              <div className="flex flex-col gap-1 p-2.5 rounded-lg border border-border bg-surface/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-main flex items-center gap-1.5">
                    <Icon name={"account_tree"} className="text-[16px] text-primary" />
                    Planner / Architect
                  </span>
                  <span className="text-[10px] text-text-muted">Task decomposition, architectural boundary specs</span>
                </div>
                <input
                  type="text"
                  value={roles.planner}
                  onChange={(e) => setRoles({ ...roles, planner: e.target.value })}
                  placeholder="e.g. ag/gemini-3.1-pro-high or claude-opus-5"
                  className="w-full px-2 py-1.5 text-xs bg-surface rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Fast Helper Role */}
              <div className="flex flex-col gap-1 p-2.5 rounded-lg border border-border bg-surface/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-main flex items-center gap-1.5">
                    <Icon name={"bolt"} className="text-[16px] text-primary" />
                    Fast Helper
                  </span>
                  <span className="text-[10px] text-text-muted">Minimal-latency rapid edits and diffs</span>
                </div>
                <input
                  type="text"
                  value={roles.fast}
                  onChange={(e) => setRoles({ ...roles, fast: e.target.value })}
                  placeholder="e.g. ag/gemini-3.8-flash-low"
                  className="w-full px-2 py-1.5 text-xs bg-surface rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            {/* Results output */}
            {result && (
              <div
                className={`p-3 rounded-lg text-xs border ${
                  result.success
                    ? "bg-success/10 border-success/20 text-success"
                    : "bg-danger/10 border-danger/20 text-danger"
                }`}
              >
                <div className="font-semibold mb-1 flex items-center gap-1">
                  <Icon name={result.success ? "check_circle" : "error"} className=" text-[16px]" />
                  {result.message || (result.success ? "Configuration successful!" : "Failed to apply settings")}
                </div>
                {result.configured?.length > 0 && (
                  <div>Configured tools: <span className="font-mono font-medium">{result.configured.join(", ")}</span></div>
                )}
                {result.skipped?.length > 0 && (
                  <div className="text-[11px] opacity-75">Skipped (not installed): {result.skipped.join(", ")}</div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <ActionsBar className="items-center justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={applying}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleApply} loading={applying}>
                <Icon name={"auto_awesome"} className=" text-[16px] mr-1" />
                Apply to All Tools
              </Button>
</ActionsBar>
          </>
        )}
      </div>
    </Modal>
  );
}
