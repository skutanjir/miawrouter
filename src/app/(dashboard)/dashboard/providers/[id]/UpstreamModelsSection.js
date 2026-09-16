"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@/shared/components";

/**
 * UpstreamModelsSection — shows publicly available models from a provider's
 * upstream API with Refresh and Import All actions.
 *
 * Props:
 *  - providerId: string — registry id (e.g. "openrouter")
 *  - providerStorageAlias: string — alias used for custom model persistence
 *  - customModels: array — current custom models from parent
 *  - modelAliases: object — current aliases from parent
 *  - hardcodedModelIds: Set<string> — built-in model ids to exclude from "new" count
 *  - onAddModel: (modelId: string) => Promise<void> — adds a single custom model
 *  - onRefreshCustomModels: () => Promise<void> — re-fetches custom models in parent
 */
export default function UpstreamModelsSection({
  providerId,
  providerStorageAlias,
  customModels,
  modelAliases,
  hardcodedModelIds,
  onAddModel,
  onRefreshCustomModels,
}) {
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error | empty
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

  const addedSet = new Set([
    ...Object.values(modelAliases),
    ...customModels
      .filter((e) => (e.kind || e.type || "llm") === "llm")
      .map((e) => `${e.providerAlias || providerStorageAlias}/${e.id}`),
  ]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ provider: providerId });
        const res = await fetch(`/api/providers/suggested-models?${params}`, {
          signal: controller.signal,
        });
        if (!mounted) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const json = await res.json();
        if (!mounted) return;
        const data = json.data ?? [];
        setModels(data);
        if (data.length > 0) {
          setStatus("ready");
        } else if (json.authRequired) {
          setStatus("auth_required");
        } else {
          setStatus("empty");
        }
      } catch (err) {
        if (err.name === "AbortError" || !mounted) return;
        setStatus("error");
      }
    }

    load();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [providerId]);

  const handleRefresh = async () => {
    setStatus("loading");
    try {
      const params = new URLSearchParams({ provider: providerId, t: String(Date.now()) });
      const res = await fetch(`/api/providers/suggested-models?${params}`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const json = await res.json();
      const data = json.data ?? [];
      setModels(data);
      if (data.length > 0) {
        setStatus("ready");
      } else if (json.authRequired) {
        setStatus("auth_required");
      } else {
        setStatus("empty");
      }
    } catch {
      setStatus("error");
    }
  };

  const handleImportAll = async () => {
    const toImport = models.filter(
      (m) =>
        !addedSet.has(`${providerStorageAlias}/${m.id}`) &&
        !hardcodedModelIds.has(m.id)
    );
    if (toImport.length === 0) return;

    setImporting(true);
    setImportProgress({ done: 0, total: toImport.length });
    let done = 0;
    for (const m of toImport) {
      try {
        await onAddModel(m.id);
      } catch {
        // individual failures are non-fatal; continue
      }
      done += 1;
      setImportProgress({ done, total: toImport.length });
    }
    await onRefreshCustomModels();
    setImporting(false);
  };

  // Count models eligible for import
  const newCount = models.filter(
    (m) =>
      !addedSet.has(`${providerStorageAlias}/${m.id}`) &&
      !hardcodedModelIds.has(m.id)
  ).length;

  // --- Render states ---

  if (status === "loading" && models.length === 0) {
    return (
      <div className="w-full mt-2">
        <div className="flex items-center gap-2 mb-2">
          <Spinner size="sm" />
          <span className="text-xs text-text-muted">Loading upstream models…</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-8 w-28 animate-pulse rounded-lg bg-surface-2"
            />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
        <span className="material-symbols-outlined text-[16px] text-red-500 shrink-0">error</span>
        <span className="text-xs text-red-600 dark:text-red-400">Failed to load upstream models</span>
        <button
          onClick={handleRefresh}
          className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          Retry
        </button>
      </div>
    );
  }

  if (status === "auth_required") {
    return (
      <div className="w-full mt-2 flex items-center gap-2 rounded-lg border border-black/[0.06] dark:border-white/[0.06] px-3 py-2">
        <span className="material-symbols-outlined text-[16px] text-text-muted shrink-0">vpn_key</span>
        <span className="text-xs text-text-muted">Connect an active API key above to load live models from this provider</span>
        <button
          onClick={handleRefresh}
          className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          Check
        </button>
      </div>
    );
  }

  if (status === "empty") {
    return null;
  }

  if (status !== "ready" || models.length === 0) return null;

  return (
    <div className="w-full mt-2" aria-busy={importing || undefined}>
      {/* Header row */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs text-text-muted font-medium">
          Upstream models ({models.length})
        </span>
        <button
          onClick={handleRefresh}
          disabled={status === "loading"}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-muted transition-colors hover:bg-surface-2 hover:text-primary disabled:opacity-50"
          title="Re-fetch from provider API"
        >
          <span
            className="material-symbols-outlined text-[14px]"
            style={status === "loading" ? { animation: "spin 1s linear infinite" } : undefined}
          >
            {status === "loading" ? "progress_activity" : "refresh"}
          </span>
          Refresh
        </button>
        {newCount > 0 && (
          <button
            onClick={handleImportAll}
            disabled={importing}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={importing ? { animation: "spin 1s linear infinite" } : undefined}
            >
              {importing ? "progress_activity" : "download"}
            </span>
            {importing
              ? `Adding ${importProgress.done}/${importProgress.total}…`
              : `Import all (${newCount})`}
          </button>
        )}
      </div>

      {/* Model chips */}
      <div className="flex flex-wrap gap-2">
        {models.map((m) => {
          const fullModel = `${providerStorageAlias}/${m.id}`;
          const isAdded =
            addedSet.has(fullModel) || hardcodedModelIds.has(m.id);
          return (
            <button
              key={m.id}
              onClick={isAdded ? undefined : async () => { await onAddModel(m.id); await onRefreshCustomModels(); }}
              disabled={isAdded || importing}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                isAdded
                  ? "border-green-500/20 bg-green-500/5 text-green-600 dark:text-green-400 cursor-default"
                  : "border-black/10 dark:border-white/10 text-text-muted hover:text-primary hover:border-primary/40 hover:bg-primary/5"
              } ${importing && !isAdded ? "opacity-60" : ""}`}
              title={
                isAdded
                  ? `${m.name || m.id} — already added`
                  : `${m.name || m.id}${m.contextLength ? ` · ${(m.contextLength / 1000).toFixed(0)}k ctx` : ""}`
              }
            >
              <span className="material-symbols-outlined text-[13px]">
                {isAdded ? "check" : "add"}
              </span>
              {m.id.split("/").pop()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
