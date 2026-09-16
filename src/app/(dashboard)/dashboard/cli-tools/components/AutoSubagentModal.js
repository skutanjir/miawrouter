"use client";

import { useState, useEffect } from "react";
import { Modal, Button } from "@/shared/components";

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
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
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
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[12px]">check</span>
                      {tool}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-text-muted italic">No tools detected locally; configs will be initialized safely.</span>
                )}
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">desktop_windows</span>
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
                    <span className="material-symbols-outlined text-[16px] text-blue-500">search</span>
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
                    <span className="material-symbols-outlined text-[16px] text-amber-500">verified</span>
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
                    <span className="material-symbols-outlined text-[16px] text-emerald-500">account_tree</span>
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
                    <span className="material-symbols-outlined text-[16px] text-cyan-500">bolt</span>
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
                    ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-300"
                    : "bg-red-500/10 border-red-500/20 text-red-600"
                }`}
              >
                <div className="font-semibold mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">
                    {result.success ? "check_circle" : "error"}
                  </span>
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
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" size="sm" onClick={onClose} disabled={applying}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={handleApply} loading={applying}>
                <span className="material-symbols-outlined text-[16px] mr-1">auto_awesome</span>
                Apply to All Tools
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
