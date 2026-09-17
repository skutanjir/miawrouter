"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { Toggle } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { getRelativeTime } from "@/shared/utils";

const PREVIEW_IDS = 3;

function DiffList({ items, kind }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const buttonId = `${listId}-button`;
  const ids = items.map((m) => (typeof m === "string" ? m : m?.id)).filter(Boolean);
  if (ids.length === 0) return null;
  const shown = expanded ? ids : ids.slice(0, PREVIEW_IDS);
  const hidden = ids.length - shown.length;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="w-1 h-2.5 rounded-full bg-primary/60 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted">
          {kind} ({ids.length})
        </span>
      </div>
      <div id={listId} className="flex flex-wrap gap-1">
        {shown.map((id) => (
          <span
            key={id}
            className="font-mono text-[11px] tabular-nums rounded px-2 py-0.5 truncate max-w-[180px] bg-surface-2 border border-border-subtle text-text-muted hover:text-text-main transition-colors"
            title={id}
          >
            {id}
          </span>
        ))}
        {hidden > 0 && (
          <button
            type="button"
            id={buttonId}
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-mono font-medium rounded px-2 py-0.5 border border-dashed border-border text-text-muted hover:text-text-main hover:border-primary/40 bg-surface transition-colors cursor-pointer"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-label={expanded ? `Collapse ${kind} models` : `Show ${hidden} more ${kind} models`}
          >
            {expanded ? "collapse" : `+${hidden} more`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function OpenCodeZenPanel() {
  const [catalog, setCatalog] = useState(null);
  const [catalogLoadError, setCatalogLoadError] = useState(null);
  const [settingsLoadError, setSettingsLoadError] = useState(null);
  const [zenFreeOnly, setZenFreeOnly] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoadError(null);
    try {
      const res = await fetch("/api/catalog/opencode");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => null);
      if (!data || typeof data !== "object") throw new Error("invalid response");
      setCatalog(data);
    } catch (err) {
      setCatalogLoadError(err.message || "load failed");
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoadError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => null);
      if (!data || typeof data.zenFreeOnly !== "boolean") throw new Error("invalid response");
      setZenFreeOnly(data.zenFreeOnly);
    } catch (err) {
      setSettingsLoadError(err.message || "load failed");
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    loadSettings();
  }, [loadCatalog, loadSettings]);

  const handleToggle = async (next) => {
    const previous = zenFreeOnly;
    setZenFreeOnly(next);
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zenFreeOnly: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setZenFreeOnly(previous);
      setSaveError(`Could not save zenFreeOnly: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const models = catalog?.models || [];
  const freeCount = catalog?.freeModels?.length ?? 0;
  const total = models.length;
  const diff = catalog?.diff || { added: [], removed: [] };
  const unknownRetention = models.filter((m) => m.retention_warning === true).length;
  const fetchedAt = catalog?.fetchedAt;
  const stale = !!catalog?.stale;
  const catalogError = catalog?.error || null;

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4 flex flex-col gap-3 shadow-soft">
      {/* Control console header strip */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-3.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text-main truncate">
            OpenCode Zen Catalog
          </h2>
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2 shrink-0">
            Telemetry
          </span>
        </div>
        <span className="text-xs text-text-muted truncate">
          Free model availability from opencode.ai/zen
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {catalogLoadError && (
          <div
            role="alert"
            className="rounded-lg px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 text-red-500"
          >
            Could not load the Zen catalog: {catalogLoadError}
          </div>
        )}
        {settingsLoadError && (
          <div
            role="alert"
            className="rounded-lg px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 text-red-500"
          >
            Could not load settings — the free-only toggle is unavailable: {settingsLoadError}
          </div>
        )}

        {catalog && (
          <>
            {/* Metric strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 rounded-lg bg-surface-2 border border-border-subtle">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Free Models</span>
                <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-text-main">
                  {freeCount}
                  <span className="text-xs font-normal text-text-muted ml-1">/ {total}</span>
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Catalog Ratio</span>
                <span className="font-mono tabular-nums text-lg sm:text-xl font-bold text-primary">
                  {total > 0 ? `${Math.round((freeCount / total) * 100)}%` : "0%"}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      catalogError
                        ? "bg-red-500"
                        : stale
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-semibold text-text-main">
                    {catalogError ? "Unavailable" : stale ? "Stale" : "Live"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">Last Refresh</span>
                <span className="text-xs font-mono text-text-muted truncate mt-0.5" title={fetchedAt ? new Date(fetchedAt).toLocaleString() : "never"}>
                  {fetchedAt ? getRelativeTime(new Date(fetchedAt).toISOString()) : "never"}
                </span>
              </div>
            </div>

            {stale && !catalogError && (
              <div
                role="status"
                className="rounded-lg px-3 py-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">schedule</span>
                <span>Catalog may be outdated — next refresh pending.</span>
              </div>
            )}

            {catalogError && (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">error</span>
                <span>Catalog unavailable: {catalogError}</span>
              </div>
            )}

            {unknownRetention > 0 && (
              <div
                role="status"
                className="rounded-lg px-3 py-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 flex items-start gap-2"
              >
                <span className="material-symbols-outlined text-[16px] text-amber-500 shrink-0 mt-0.5" aria-hidden="true">warning</span>
                <span>
                  <strong>Retention warning:</strong> {unknownRetention} model{unknownRetention === 1 ? "" : "s"} have unknown data
                  retention — treat as unsafe. Zen may retain and train on submitted data for some free
                  models; retention is only considered safe when explicitly documented as none.
                </span>
              </div>
            )}

            {/* Model chips */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DiffList items={diff.added} kind="Added" />
              <DiffList items={diff.removed} kind="Removed" />
            </div>

            {/* One settings row */}
            <div className="flex flex-col gap-1 rounded-lg px-3 py-2.5 bg-surface-2 border border-border-subtle">
              <Toggle
                checked={zenFreeOnly === true}
                onChange={handleToggle}
                disabled={saving || zenFreeOnly === null}
                label="Zen free-only routing"
                description="Only route OpenCode models classified as free"
              />
              {saveError && (
                <p className="text-xs text-red-500 mt-1" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
