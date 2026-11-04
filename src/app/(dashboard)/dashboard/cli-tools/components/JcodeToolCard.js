"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button, ModelSelectModal, ManualConfigModal } from "@/shared/components";
import Image from "next/image";
import BaseUrlSelect from "./BaseUrlSelect";
import ApiKeySelect from "./ApiKeySelect";
import ToolSubagentsSection from "./ToolSubagentsSection";
import { matchKnownEndpoint } from "./cliEndpointMatch";

import { Icon } from "@/shared/components/Icon";
import { StatusRow, ActionsBar } from "./ToolCardSections";
export default function JcodeToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  activeProviders,
  cloudEnabled,
  initialStatus,
  tunnelEnabled,
  tunnelPublicUrl,
  tailscaleEnabled,
  tailscaleUrl,
}) {
  const [jcodeStatus, setJcodeStatus] = useState(initialStatus || null);
  const [checkingJcode, setCheckingJcode] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [subagents, setSubagents] = useState({ explorer: "", reviewer: "", planner: "", fast: "" });
  const [modalOpen, setModalOpen] = useState(false);
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const hasInitializedModel = useRef(false);

  const getConfigStatus = () => {
    if (!jcodeStatus?.installed) return null;
    if (!jcodeStatus?.hasMiawRouter) return "not_configured";
    const currentProvider = jcodeStatus.config?.providers?.["miawrouter"];
    if (!currentProvider) return "not_configured";
    return matchKnownEndpoint(currentProvider.base_url, { tunnelPublicUrl, tailscaleUrl }) ? "configured" : "other";
  };

  const configStatus = getConfigStatus();

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (initialStatus) setJcodeStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (isExpanded) {
      if (!jcodeStatus) checkJcodeStatus();
      fetchModelAliases();
    }
  }, [isExpanded]);

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  useEffect(() => {
    if (jcodeStatus?.installed && !hasInitializedModel.current) {
      hasInitializedModel.current = true;
      const provider = jcodeStatus.config?.providers?.["miawrouter"];
      if (provider) {
        if (provider.default_model) {
          setSelectedModel(provider.default_model);
        }
        if (provider.subagents) {
          setSubagents(provider.subagents);
        }
        // Try to match API key from env file
        const envApiKey = jcodeStatus.envApiKey;
        if (envApiKey && apiKeys?.some(k => k.key === envApiKey)) {
          setSelectedApiKey(envApiKey);
        }
      }
    }
  }, [jcodeStatus, apiKeys]);

  const checkJcodeStatus = async () => {
    setCheckingJcode(true);
    try {
      const res = await fetch("/api/cli-tools/jcode-settings");
      const data = await res.json();
      setJcodeStatus(data);
    } catch (error) {
      setJcodeStatus({ installed: false, error: error.message });
    } finally {
      setCheckingJcode(false);
    }
  };

  const normalizeLocalhost = (url) => url.replace("://localhost", "://127.0.0.1");

  const getLocalBaseUrl = () => {
    if (typeof window !== "undefined") {
      return normalizeLocalhost(window.location.origin);
    }
    return "http://127.0.0.1:21128";
  };

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || getLocalBaseUrl();
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const getDisplayUrl = () => {
    const url = customBaseUrl || getLocalBaseUrl();
    return url.endsWith("/v1") ? url : `${url}/v1`;
  };

  const handleApplySettings = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_miawrouter" : null);

      const allModels = Array.from(new Set([selectedModel, ...Object.values(subagents)].filter(Boolean)));
      const res = await fetch("/api/cli-tools/jcode-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          models: allModels.length > 0 ? allModels : (selectedModel ? [selectedModel] : []),
          subagents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings applied successfully!" });
        checkJcodeStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to apply settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleResetSettings = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/jcode-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings reset successfully!" });
        setSelectedModel("");
        setSelectedApiKey("");
        checkJcodeStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to reset settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoring(false);
    }
  };

  const handleModelSelect = (model) => {
    setSelectedModel(model.value);
    setModalOpen(false);
  };

  const getManualConfigs = () => {
    const keyToUse = (selectedApiKey && selectedApiKey.trim())
      ? selectedApiKey
      : (!cloudEnabled ? "sk_miawrouter" : "<API_KEY_FROM_DASHBOARD>");

    const configToml = `[providers.miawrouter]
type = "openai-compatible"
base_url = "${getEffectiveBaseUrl()}"
auth = "bearer"
api_key_env = "JCODE_MIAWROUTER_API_KEY"
env_file = "provider-miawrouter.env"
default_model = "${selectedModel || "cc/claude-opus-4-7"}"
requires_api_key = true

[[providers.miawrouter.models]]
id = "${selectedModel || "cc/claude-opus-4-7"}"`;

    const envContent = `JCODE_MIAWROUTER_API_KEY="${keyToUse}"`;

    return [
      {
        filename: "~/.jcode/config.toml",
        content: configToml,
      },
      {
        filename: "~/.config/jcode/provider-miawrouter.env",
        content: envContent,
      },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <StatusRow className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <Image
              src={tool.image || "/providers/jcode.png"}
              alt={tool.name}
              width={32}
              height={32}
              className="size-8 object-contain rounded-lg"
              sizes="32px"
              onError={(e) => {
                e.target.style.display = "none";
              }}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="font-medium text-sm">{tool.name}</h3>
              {configStatus === "configured" && <span className="rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 text-[11px] font-medium text-success">Connected</span>}
              {configStatus === "not_configured" && <span className="rounded-md border border-warning/20 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">Not configured</span>}
              {configStatus === "other" && <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Other</span>}
            </div>
            <p className="text-xs text-text-muted truncate">{tool.description}</p>
          </div>
        </div>
        <Icon name={"expand_more"} className={` text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
</StatusRow>
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checkingJcode && (
            <div className="flex items-center gap-2 text-text-muted">
              <Icon name={"progress_activity"} className=" animate-spin" />
              <span>Checking jcode CLI...</span>
            </div>
          )}

          {!checkingJcode && jcodeStatus && !jcodeStatus.installed && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-md border border-warning/20 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <Icon name={"warning"} className="text-warning" />
                  <div className="flex-1">
                    <p className="font-medium text-warning">jcode CLI not detected locally</p>
                    <p className="text-sm text-text-muted mt-1">Install jcode to enable automatic configuration:</p>
                    <code className="block mt-2 p-2 bg-surface-2 rounded text-xs font-mono">
                      curl -fsSL https://raw.githubusercontent.com/1jehuang/jcode/master/scripts/install.sh | bash
                    </code>
                    <p className="text-sm text-text-muted mt-2">Manual configuration is still available if miawrouter is deployed on a remote server.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-9">
                  <Button variant="secondary" size="sm" onClick={() => setShowManualConfigModal(true)} className="!bg-warning/10 !border-warning/30 !text-warning hover:!bg-warning/20">
                    <Icon name={"content_copy"} className=" text-[18px] mr-1" />
                    Manual Config
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!checkingJcode && jcodeStatus?.installed && (
            <>
              <div className="flex flex-col gap-2">
                {/* Info notes */}
                {tool.notes && tool.notes.length > 0 && (
                  <div className="flex flex-col gap-2 mb-2">
                    {tool.notes.map((note, idx) => (
                      <div key={idx} className={`flex items-start gap-2 p-2 rounded text-xs ${
                        note.type === "info" ? "bg-primary/10 text-primary" :
                        note.type === "warning" ? "bg-warning/10 text-warning" :
                        "bg-surface-2 text-text-muted"
                      }`}>
                        <Icon name={note.type === "info" ? "info" : note.type === "warning" ? "warning" : "help"} className=" text-[14px] mt-0.5" />
                        <span>{note.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Endpoint (selector) */}
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <BaseUrlSelect
                    value={customBaseUrl || getDisplayUrl()}
                    onChange={setCustomBaseUrl}
                    requiresExternalUrl={tool.requiresExternalUrl}
                    tunnelEnabled={tunnelEnabled}
                    tunnelPublicUrl={tunnelPublicUrl}
                    tailscaleEnabled={tailscaleEnabled}
                    tailscaleUrl={tailscaleUrl}
                  />
                </div>

                {/* Current configured */}
                {jcodeStatus?.config?.providers?.["miawrouter"]?.base_url && (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                    <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
                    <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                    <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
                      {jcodeStatus.config.providers["miawrouter"]?.base_url}
                    </span>
                  </div>
                )}

                {/* API Key */}
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <ApiKeySelect value={selectedApiKey} onChange={setSelectedApiKey} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
                </div>

                {/* Default Model */}
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Default Model</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <div className="relative w-full min-w-0">
                    <input type="text" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} placeholder="cc/claude-opus-4-7" className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5" />
                    {selectedModel && <button onClick={() => setSelectedModel("")} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-danger rounded transition-colors" title="Clear"><Icon name={"close"} className=" text-[14px]" /></button>}
                  </div>
                  <button onClick={() => setModalOpen(true)} disabled={!hasActiveProviders} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select</button>
                </div>

                {/* Subagents Section */}
                <ToolSubagentsSection
                  toolName={tool.name}
                  toolId="jcode"
                  subagents={subagents}
                  onChange={setSubagents}
                  activeProviders={activeProviders}
                  modelAliases={modelAliases}
                  hasActiveProviders={hasActiveProviders}
                  baseUrl={getEffectiveBaseUrl()}
                  apiKey={selectedApiKey}
                />

                {/* Usage hint */}
                <div className="flex flex-col gap-1 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-xs font-medium text-primary">Usage:</p>
                  <code className="text-xs font-mono text-text-muted">jcode --provider-profile miawrouter</code>
                  <code className="text-xs font-mono text-text-muted">jcode --provider-profile miawrouter --model {selectedModel || "cc/claude-opus-4-7"}</code>
                </div>
              </div>

              {message && (
                <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${message.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                  <Icon name={message.type === "success" ? "check_circle" : "error"} className=" text-[14px]" />
                  <span>{message.text}</span>
                </div>
              )}

              <ActionsBar className="grid grid-cols-1 gap-2 sm:flex sm:items-center"><Button variant="primary" size="sm" onClick={handleApplySettings} disabled={!selectedModel} loading={applying}>
                <Icon name={"save"} className=" text-[14px] mr-1" />Apply
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetSettings} disabled={!jcodeStatus?.hasMiawRouter} loading={restoring}>
                <Icon name={"restore"} className=" text-[14px] mr-1" />Reset
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)}>
                <Icon name={"content_copy"} className=" text-[14px] mr-1" />Manual Config
              </Button></ActionsBar>
            </>
          )}
        </div>
      )}

      {modalOpen && (
        <ModelSelectModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSelect={handleModelSelect}
          selectedModel={selectedModel}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Select Model for jcode"
        />
      )}

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title="jcode - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
