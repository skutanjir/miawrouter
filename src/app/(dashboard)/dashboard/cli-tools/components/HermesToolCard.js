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
const ENDPOINT = "/api/cli-tools/hermes-settings";

export default function HermesToolCard({
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
  const [hermesStatus, setHermesStatus] = useState(initialStatus || null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [subagents, setSubagents] = useState({ explorer: "", reviewer: "", planner: "", fast: "" });
  const [syncDesktop, setSyncDesktop] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const hasInitializedModel = useRef(false);

  const getConfigStatus = () => {
    if (!hermesStatus?.installed) return null;
    const cfg = hermesStatus.settings?.model;
    if (!cfg?.base_url) return "not_configured";
    if (matchKnownEndpoint(cfg.base_url, { tunnelPublicUrl, tailscaleUrl })) return "configured";
    return "other";
  };

  const configStatus = getConfigStatus();

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (initialStatus) setHermesStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (isExpanded) {
      if (!hermesStatus) checkStatus();
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
    if (hermesStatus?.installed && !hasInitializedModel.current) {
      hasInitializedModel.current = true;
      const cfg = hermesStatus.settings?.model;
      if (cfg?.default) setSelectedModel(cfg.default);
      const sub = hermesStatus.settings?.subagents;
      if (sub) {
        setSubagents({
          explorer: sub.explorer || "",
          reviewer: sub.reviewer || "",
          planner: sub.planner || "",
          fast: sub.fast || "",
        });
      }
    }
  }, [hermesStatus]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(ENDPOINT);
      const data = await res.json();
      setHermesStatus(data);
    } catch (error) {
      setHermesStatus({ installed: false, error: error.message });
    } finally {
      setChecking(false);
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

  const handleApply = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_miawrouter" : null);

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: selectedModel,
          subagentModels: subagents,
          syncDesktop,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings applied to Hermes Agent & Desktop!" });
        checkStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to apply settings" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleAutoAddDesktop = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const keyToUse = selectedApiKey?.trim()
        || (apiKeys?.length > 0 ? apiKeys[0].key : null)
        || (!cloudEnabled ? "sk_miawrouter" : null);

      const chosenModel = selectedModel || "ag/gemini-3.8-flash-high";

      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: chosenModel,
          syncDesktop: true,
          subagentModels: subagents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Hermes Desktop (Native) configured & added successfully!" });
        checkStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to configure Hermes Desktop" });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleReset = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch(ENDPOINT, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Settings reset successfully!" });
        setSelectedModel("");
        setSubagents({ explorer: "", reviewer: "", planner: "", fast: "" });
        checkStatus();
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

    const yamlContent = `model:\n  default: "${selectedModel || "provider/model-id"}"\n  provider: "custom"\n  base_url: "${getEffectiveBaseUrl()}"\n\nsubagents:\n  enabled: true\n  default_model: "${selectedModel || "provider/model-id"}"\n  models:\n    explorer: "${subagents.explorer || selectedModel || "provider/model-id"}"\n    reviewer: "${subagents.reviewer || selectedModel || "provider/model-id"}"\n    planner: "${subagents.planner || selectedModel || "provider/model-id"}"\n    fast: "${subagents.fast || selectedModel || "provider/model-id"}"\n`;
    const envContent = `OPENAI_API_KEY=${keyToUse}\n`;
    const desktopContent = JSON.stringify({
      endpoint: getEffectiveBaseUrl(),
      apiKey: keyToUse,
      model: selectedModel || "provider/model-id",
      nativeDesktop: true,
      subagents: {
        enabled: true,
        default_model: selectedModel || "provider/model-id",
        models: {
          explorer: subagents.explorer || selectedModel || "provider/model-id",
          reviewer: subagents.reviewer || selectedModel || "provider/model-id",
          planner: subagents.planner || selectedModel || "provider/model-id",
          fast: subagents.fast || selectedModel || "provider/model-id",
        },
      },
    }, null, 2);

    return [
      { filename: "~/.hermes/config.yaml", content: yamlContent },
      { filename: "~/.hermes/.env", content: envContent },
      { filename: "~/.hermes/desktop.json", content: desktopContent },
    ];
  };

  return (
    <Card padding="xs" className="overflow-hidden">
      <StatusRow className="flex items-start justify-between gap-3 hover:cursor-pointer sm:items-center" onClick={onToggle}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="size-8 flex items-center justify-center shrink-0">
            <Image
              src="/providers/hermes.png"
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
              {hermesStatus?.desktopInstalled && <span className="rounded-md border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">Desktop Native</span>}
            </div>
            <p className="text-xs text-text-muted truncate">{tool.description}</p>
          </div>
        </div>
        <Icon name={"expand_more"} className={` text-text-muted text-[20px] transition-transform ${isExpanded ? "rotate-180" : ""}`} />
</StatusRow>
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-4">
          {checking && (
            <div className="flex items-center gap-2 text-text-muted">
              <Icon name={"progress_activity"} className=" animate-spin" />
              <span>Checking Hermes Agent & Desktop...</span>
            </div>
          )}

          {!checking && hermesStatus && !hermesStatus.installed && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-md border border-warning/20 bg-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <Icon name={"warning"} className="text-warning" />
                  <div className="flex-1">
                    <p className="font-medium text-warning">Hermes Agent / Desktop not detected locally</p>
                    <p className="text-sm text-text-muted">You can 1-click auto-add the native Hermes Desktop config or install CLI: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-0 sm:pl-9">
                  <Button variant="primary" size="sm" onClick={handleAutoAddDesktop} loading={applying} className="w-full sm:w-auto">
                    <Icon name={"add_circle"} className=" text-[18px] mr-1" />
                    Auto-Add Hermes Desktop (Native)
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowManualConfigModal(true)} className="w-full sm:w-auto !bg-warning/10 !border-warning/30 !text-warning hover:!bg-warning/20">
                    <Icon name={"content_copy"} className=" text-[18px] mr-1" />
                    Manual Config
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!checking && hermesStatus?.installed && (
            <>
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Select Endpoint</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <BaseUrlSelect
                    value={customBaseUrl || getEffectiveBaseUrl()}
                    onChange={setCustomBaseUrl}
                    requiresExternalUrl={tool.requiresExternalUrl}
                    tunnelEnabled={tunnelEnabled}
                    tunnelPublicUrl={tunnelPublicUrl}
                    tailscaleEnabled={tailscaleEnabled}
                    tailscaleUrl={tailscaleUrl}
                  />
                </div>

                {hermesStatus?.settings?.model?.base_url && (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                    <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Current</span>
                    <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                    <span className="min-w-0 truncate rounded bg-surface/40 px-2 py-2 text-xs text-text-muted sm:py-1.5">
                      {hermesStatus.settings.model.base_url}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">API Key</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <ApiKeySelect value={selectedApiKey} onChange={setSelectedApiKey} apiKeys={apiKeys} cloudEnabled={cloudEnabled} />
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr_auto] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Default Model</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <div className="relative w-full min-w-0">
                    <input type="text" value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} placeholder="provider/model-id" className="w-full min-w-0 pl-2 pr-7 py-2 bg-surface rounded border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 sm:py-1.5" />
                    {selectedModel && <button onClick={() => setSelectedModel("")} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-danger rounded transition-colors" title="Clear"><Icon name={"close"} className=" text-[14px]" /></button>}
                  </div>
                  <button onClick={() => setModalOpen(true)} disabled={!hasActiveProviders} className={`w-full sm:w-auto rounded border px-2 py-2 text-xs transition-colors sm:py-1.5 whitespace-nowrap sm:shrink-0 ${hasActiveProviders ? "bg-surface border-border text-text-main hover:border-primary cursor-pointer" : "opacity-50 cursor-not-allowed border-border"}`}>Select</button>
                </div>

                {/* Subagents Section */}
                <ToolSubagentsSection
                  toolName={tool.name}
                  toolId="hermes"
                  subagents={subagents}
                  onChange={setSubagents}
                  activeProviders={activeProviders}
                  modelAliases={modelAliases}
                  hasActiveProviders={hasActiveProviders}
                  baseUrl={getEffectiveBaseUrl()}
                  apiKey={selectedApiKey}
                />

                {/* Desktop Native Sync Checkbox */}
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[8rem_auto_1fr] sm:items-center sm:gap-2">
                  <span className="text-xs font-semibold text-text-main sm:text-right sm:text-sm">Hermes Desktop</span>
                  <Icon name={"arrow_forward"} className=" hidden text-text-muted text-[14px] sm:inline" />
                  <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncDesktop}
                      onChange={(e) => setSyncDesktop(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/50"
                    />
                    <span>Sync native desktop app configuration (~/.hermes/desktop.json)</span>
                  </label>
                </div>
              </div>

              {message && (
                <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${message.type === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                  <Icon name={message.type === "success" ? "check_circle" : "error"} className=" text-[14px]" />
                  <span>{message.text}</span>
                </div>
              )}

              <ActionsBar className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleApply} disabled={!selectedModel} loading={applying} className="w-full sm:w-auto">
                  <Icon name={"save"} className=" text-[14px] mr-1" />Apply
                </Button>
                <Button variant="outline" size="sm" onClick={handleAutoAddDesktop} loading={applying} className="w-full sm:w-auto">
                  <Icon name={"desktop_windows"} className=" text-[14px] mr-1" />Sync Native Desktop
                </Button>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={!hermesStatus?.hasMiawRouter} loading={restoring} className="w-full sm:w-auto">
                  <Icon name={"restore"} className=" text-[14px] mr-1" />Reset
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowManualConfigModal(true)} className="w-full sm:w-auto">
                  <Icon name={"content_copy"} className=" text-[14px] mr-1" />Manual Config
                </Button>
</ActionsBar>
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
          title="Select Model for Hermes Agent & Desktop"
        />
      )}

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title="Hermes Agent & Desktop - Manual Configuration"
        configs={getManualConfigs()}
      />
    </Card>
  );
}
