"use client";

import { useState, useEffect } from "react";
import { ModelSelectModal, Button } from "@/shared/components";

export default function ToolSubagentsSection({
  toolName,
  toolId,
  subagents = {},
  onChange,
  activeProviders: propActiveProviders = [],
  modelAliases: propModelAliases = {},
  hasActiveProviders: propHasActive = false,
  onApply = null,
  applying: propApplying = false,
  baseUrl = "",
  apiKey = "",
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [modalRole, setModalRole] = useState(null);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [savingInternal, setSavingInternal] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Self-fetching fallbacks if parent doesn't provide them
  const [internalProviders, setInternalProviders] = useState([]);
  const [internalAliases, setInternalAliases] = useState({});

  useEffect(() => {
    let mounted = true;
    if (!propActiveProviders?.length) {
      fetch("/api/providers")
        .then((r) => r.json())
        .then((data) => {
          if (mounted && data?.connections) {
            setInternalProviders(data.connections.filter((c) => c.isActive !== false));
          }
        })
        .catch(() => {});
    }
    if (!Object.keys(propModelAliases || {}).length) {
      fetch("/api/models/alias")
        .then((r) => r.json())
        .then((data) => {
          if (mounted && data?.aliases) {
            setInternalAliases(data.aliases);
          }
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, [propActiveProviders, propModelAliases]);

  const effectiveProviders = propActiveProviders?.length ? propActiveProviders : internalProviders;
  const effectiveAliases = Object.keys(propModelAliases || {}).length ? propModelAliases : internalAliases;
  const effectiveHasActive = propHasActive || effectiveProviders.length > 0;

  const rolesConfig = [
    {
      id: "explorer",
      label: "Explorer",
      icon: "search",
      desc: "Fast codebase grep, symbol discovery & structural navigation",
      defaultPlaceholder: "e.g. ag/gemini-3.8-flash-high or deepseek-v4.1-flash",
    },
    {
      id: "reviewer",
      label: "Reviewer & Auditor",
      icon: "verified",
      desc: "Senior adversarial code review, security audit & boundary checking",
      defaultPlaceholder: "e.g. cc/claude-sonnet-4-6 or deepseek-v4-pro",
    },
    {
      id: "planner",
      label: "Planner / Architect",
      icon: "account_tree",
      desc: "Architectural decomposition & implementation step planning",
      defaultPlaceholder: "e.g. ag/gemini-3.1-pro-high or cc/claude-opus-5",
    },
    {
      id: "fast",
      label: "Fast Helper",
      icon: "bolt",
      desc: "Ultra-fast low-latency single-turn edits, diffs & lint fixes",
      defaultPlaceholder: "e.g. ag/gemini-3.8-flash-low or gpt-5.4-nano",
    },
  ];

  const handleModelSelect = (selectedModel) => {
    if (modalRole && onChange) {
      onChange({
        ...subagents,
        [modalRole]: selectedModel.value,
      });
    }
    setModalRole(null);
  };

  const handleRoleChange = (roleId, value) => {
    if (onChange) {
      onChange({
        ...subagents,
        [roleId]: value,
      });
    }
  };

  const handleAutoDetect = async (e) => {
    e.stopPropagation();
    setAutoDetecting(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/cli-tools/subagents");
      if (res.ok) {
        const data = await res.json();
        if (data?.recommendedRoles && onChange) {
          onChange({
            ...subagents,
            explorer: data.recommendedRoles.explorer || subagents.explorer,
            reviewer: data.recommendedRoles.reviewer || subagents.reviewer,
            planner: data.recommendedRoles.planner || subagents.planner,
            fast: data.recommendedRoles.fast || subagents.fast,
          });
          setFeedbackMessage({
            type: "success",
            text: `Optimal subagent models auto-detected from active providers!`,
          });
        }
      }
    } catch (err) {
      console.log("Error auto-detecting subagent roles:", err);
      setFeedbackMessage({ type: "error", text: "Failed to auto-detect roles" });
    } finally {
      setAutoDetecting(false);
    }
  };

  const handleSaveSubagents = async () => {
    if (onApply) {
      return onApply();
    }

    setSavingInternal(true);
    setFeedbackMessage(null);
    try {
      const res = await fetch("/api/cli-tools/subagents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTools: toolId ? [toolId] : "all",
          customRoles: subagents,
          baseUrl: baseUrl || "http://127.0.0.1:21128/v1",
          apiKey: apiKey || "sk_miawrouter",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMessage({
          type: "success",
          text: `Subagents saved for ${toolName || "this tool"}!`,
        });
      } else {
        setFeedbackMessage({
          type: "error",
          text: data?.error || "Failed to save subagents",
        });
      }
    } catch (err) {
      setFeedbackMessage({ type: "error", text: err.message });
    } finally {
      setSavingInternal(false);
    }
  };

  const activeCount = Object.values(subagents).filter(Boolean).length;
  const isSaving = propApplying || savingInternal;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface/30">
      {/* Header / Toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-surface/50 transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary">smart_toy</span>
          <span className="text-xs font-semibold text-text-main">Subagent Configurations</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
              {activeCount} configured
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAutoDetect}
            disabled={autoDetecting}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-surface border border-border text-text-muted hover:text-text-main hover:border-primary transition-colors cursor-pointer"
            title="Auto-select optimal models from active providers"
          >
            <span className={`material-symbols-outlined text-[13px] ${autoDetecting ? "animate-spin" : ""}`}>
              {autoDetecting ? "progress_activity" : "tune"}
            </span>
            <span>Auto-Detect</span>
          </button>

          <span
            className={`material-symbols-outlined text-text-muted text-[18px] transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          >
            expand_more
          </span>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="p-3 border-t border-border flex flex-col gap-3">
          <p className="text-[11px] text-text-muted">
            Configure specialized subagent models for {toolName}. Click Select Model to pick from active providers, or Auto-Detect to assign optimal roles automatically.
          </p>

          <div className="flex flex-col gap-2.5">
            {rolesConfig.map((role) => {
              const currentVal = subagents[role.id] || "";
              return (
                <div key={role.id} className="flex flex-col gap-1 p-2 rounded border border-border/80 bg-surface/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-primary">{role.icon}</span>
                      <span className="text-xs font-medium text-text-main">{role.label}</span>
                    </div>
                    <span className="text-[10px] text-text-muted hidden sm:inline">{role.desc}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => handleRoleChange(role.id, e.target.value)}
                        placeholder={role.defaultPlaceholder}
                        className="w-full min-w-0 pl-2 pr-6 py-1 text-xs bg-surface rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      {currentVal && (
                        <button
                          type="button"
                          onClick={() => handleRoleChange(role.id, "")}
                          className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-red-500 transition-colors p-0.5"
                          title="Clear"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setModalRole(role.id)}
                      disabled={!effectiveHasActive}
                      className={`px-2 py-1 text-xs rounded border shrink-0 transition-colors ${
                        effectiveHasActive
                          ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer"
                          : "opacity-50 cursor-not-allowed border-border"
                      }`}
                    >
                      Select Model
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {feedbackMessage && (
            <div
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-xs ${
                feedbackMessage.type === "success"
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">
                {feedbackMessage.type === "success" ? "check_circle" : "error"}
              </span>
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Button variant="primary" size="sm" onClick={handleSaveSubagents} loading={isSaving}>
              <span className="material-symbols-outlined text-[14px] mr-1">save</span>
              Save Subagents
            </Button>
          </div>
        </div>
      )}

      {/* Model Selection Modal */}
      {modalRole && (
        <ModelSelectModal
          isOpen={Boolean(modalRole)}
          onClose={() => setModalRole(null)}
          onSelect={handleModelSelect}
          selectedModel={subagents[modalRole] || ""}
          activeProviders={effectiveProviders}
          modelAliases={effectiveAliases}
          title={`Select ${rolesConfig.find((r) => r.id === modalRole)?.label || "Subagent"} Model for ${toolName}`}
        />
      )}
    </div>
  );
}
