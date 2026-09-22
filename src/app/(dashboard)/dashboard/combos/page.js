"use client";

import { useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, ConfirmModal, CapacityBadges, Select, Toggle } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { isOpenAICompatibleProvider, isAnthropicCompatibleProvider } from "@/shared/constants/providers";

// Validate combo name: only a-z, A-Z, 0-9, -, _
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Capacity adapter: global fallback pools of models per input-modality capability.
// A request needing a capability the target model/combo lacks switches straight
// to the first enabled model here instead of erroring or dropping the data.
const CAPACITY_ADAPTER_CAPS = [
  { key: "vision", label: "Vision", icon: "visibility", desc: "Images" },
  // pdf, videoInput temporarily hidden — no translator support yet for those blocks.
  { key: "audioInput", label: "Audio", icon: "graphic_eq", desc: "Audio input" },
];
const DEFAULT_FALLBACK_MODEL = "oc/mimo-v2.6-flash-free";
const EMPTY_CAP_ENTRY = { enabled: true, roundRobin: false, models: [] };
const EMPTY_CAPACITY_ADAPTER = {
  vision: { ...EMPTY_CAP_ENTRY },
  pdf: { ...EMPTY_CAP_ENTRY },
  audioInput: { ...EMPTY_CAP_ENTRY },
  videoInput: { ...EMPTY_CAP_ENTRY },
};
// Backward-compat: legacy stored form was an array of {model, enabled}.
function normalizeCapEntry(entry) {
  if (Array.isArray(entry)) {
    return { enabled: true, roundRobin: false, models: entry.map((e) => e?.model || e).filter(Boolean) };
  }
  if (entry && typeof entry === "object") {
    return {
      enabled: entry.enabled !== false,
      roundRobin: !!entry.roundRobin,
      models: Array.isArray(entry.models) ? entry.models.filter(Boolean) : [],
    };
  }
  return { ...EMPTY_CAP_ENTRY };
}

export default function CombosPage() {
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCombo, setEditingCombo] = useState(null);
  const [activeProviders, setActiveProviders] = useState([]);
  const [comboStrategies, setComboStrategies] = useState({});
  const [capacityAdapter, setCapacityAdapter] = useState(EMPTY_CAPACITY_ADAPTER);
  const { getCaps } = useModelCaps();
  const [confirmState, setConfirmState] = useState(null);
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [combosRes, providersRes, settingsRes] = await Promise.all([
        fetch("/api/combos"),
        fetch("/api/providers"),
        fetch("/api/settings"),
      ]);
      const combosData = await combosRes.json();
      const providersData = await providersRes.json();
      const settingsData = settingsRes.ok ? await settingsRes.json() : {};
      
      // Only LLM combos here - webSearch/webFetch combos belong to media-providers/web
      if (combosRes.ok) setCombos((combosData.combos || []).filter(c => !c.kind || c.kind === "llm"));
      if (providersRes.ok) {
        setActiveProviders(providersData.connections || []);
      }
      setComboStrategies(settingsData.comboStrategies || {});
      const rawAdapter = settingsData.capacityAdapter || {};
      const normalized = {};
      for (const cap of CAPACITY_ADAPTER_CAPS) {
        normalized[cap.key] = normalizeCapEntry(rawAdapter[cap.key]);
      }
      setCapacityAdapter(normalized);
    } catch (error) {
      console.log("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetCapacityAdapter = async (next) => {
    setCapacityAdapter(next);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacityAdapter: next }),
      });
    } catch (error) {
      console.log("Error updating capacity adapter:", error);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setShowCreateModal(false);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create combo");
      }
    } catch (error) {
      console.log("Error creating combo:", error);
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      const res = await fetch(`/api/combos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await fetchData();
        setEditingCombo(null);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update combo");
      }
    } catch (error) {
      console.log("Error updating combo:", error);
    }
  };

  const handleDelete = async (id) => {
    setConfirmState({
      title: "Delete Combo",
      message: "Delete this combo?",
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/combos/${id}`, { method: "DELETE" });
          if (res.ok) {
            setCombos(combos.filter(c => c.id !== id));
          }
        } catch (error) {
          console.log("Error deleting combo:", error);
        }
      }
    });
  };

  // Merge a per-combo strategy patch into settings.comboStrategies. Passing an empty
  // patch (strategy back to default "fallback") drops the entry entirely.
  const handleSetComboStrategy = async (comboName, patch) => {
    try {
      const updated = { ...comboStrategies };
      const next = { ...(updated[comboName] || {}), ...patch };
      // Prune to keep settings clean: default fallback with no extras = no entry.
      if (!next.fallbackStrategy || next.fallbackStrategy === "fallback") {
        delete updated[comboName];
      } else {
        updated[comboName] = next;
      }

      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comboStrategies: updated }),
      });

      setComboStrategies(updated);
    } catch (error) {
      console.log("Error updating combo strategy:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-3.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
            <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text-main truncate">
              Model Combos
            </h2>
            <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2 shrink-0">
              {combos.length} {combos.length === 1 ? "COMBO" : "COMBOS"}
            </span>
          </div>
          <Button icon="add" onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto shrink-0">
            Create Combo
          </Button>
        </div>

        {/* Strategy reference panel */}
        <div className="rounded-md border border-border-subtle bg-surface-2/40 p-2.5">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-primary">alt_route</span>
            <span>Routing Strategies</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
            <div className="flex flex-col gap-0.5 p-2 rounded bg-surface border border-border-subtle">
              <span className="font-mono text-[11px] font-semibold text-primary">fallback:</span>
              <span className="text-[11px] text-text-muted leading-snug">Tries models in order until one succeeds</span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded bg-surface border border-border-subtle">
              <span className="font-mono text-[11px] font-semibold text-primary">round-robin:</span>
              <span className="text-[11px] text-text-muted leading-snug">Distributes requests across models</span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded bg-surface border border-border-subtle">
              <span className="font-mono text-[11px] font-semibold text-primary">fusion:</span>
              <span className="text-[11px] text-text-muted leading-snug">Queries in parallel; judge synthesizes one answer</span>
            </div>
            <div className="flex flex-col gap-0.5 p-2 rounded bg-surface border border-border-subtle">
              <span className="font-mono text-[11px] font-semibold text-primary">race:</span>
              <span className="text-[11px] text-text-muted leading-snug">Parallel dispatch; first successful response wins</span>
            </div>
          </div>
        </div>
      </div>

      {/* Combos List */}
      {combos.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <span className="material-symbols-outlined text-[32px]">layers</span>
            </div>
            <p className="text-text-main font-medium mb-1">No combos yet</p>
            <p className="text-sm text-text-muted mb-4">Create model combos with fallback support</p>
            <Button icon="add" onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
              Create Combo
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {combos.map((combo) => (
            <ComboCard
              key={combo.id}
              combo={combo}
              getCaps={getCaps}
              activeProviders={activeProviders}
              copied={copied}
              onCopy={copy}
              onEdit={() => setEditingCombo(combo)}
              onDelete={() => handleDelete(combo.id)}
              strategy={comboStrategies[combo.name] || {}}
              onSetStrategy={(patch) => handleSetComboStrategy(combo.name, patch)}
            />
          ))}
        </div>
      )}

      {/* Capacity Adapter */}
      <CapacityAdapterSection
        capacityAdapter={capacityAdapter}
        onChange={handleSetCapacityAdapter}
        activeProviders={activeProviders}
        getCaps={getCaps}
      />

      {/* Create Modal - Use key to force remount and reset state */}
      {showCreateModal && (
        <ComboFormModal
          key="create"
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleCreate}
          activeProviders={activeProviders}
        />
      )}

      {editingCombo && (
        <ComboFormModal
          key={editingCombo.id}
          isOpen={!!editingCombo}
          combo={editingCombo}
          onClose={() => setEditingCombo(null)}
          onSave={(data) => handleUpdate(editingCombo.id, data)}
          activeProviders={activeProviders}
        />
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </div>
  );
}

const STRATEGY_OPTIONS = [
  { value: "fallback", label: "Fallback — try in order" },
  { value: "round-robin", label: "Round Robin — rotate" },
  { value: "fusion", label: "Fusion — panel + judge" },
  { value: "race", label: "Race — first successful (parallel)" },
];

function ComboCard({ combo, getCaps, activeProviders = [], copied, onCopy, onEdit, onDelete, strategy = {}, onSetStrategy }) {
  const [showJudgeSelect, setShowJudgeSelect] = useState(false);
  const current = strategy.fallbackStrategy || "fallback";
  const judge = strategy.judgeModel || "";
  const isFusion = current === "fusion";

  return (
    <div className="relative rounded-lg border border-border-subtle bg-surface px-3.5 py-3 transition-all duration-150 overflow-hidden hover:border-border hover:bg-surface-2/40">
      <span
        className="absolute inset-y-0 left-0 w-[3px] bg-primary"
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pl-1.5">
        {/* Left column: Combo identifier + models list + judge if fusion */}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[18px]">layers</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="block truncate font-mono text-xs sm:text-sm font-semibold text-text-main">{combo.name}</code>
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2 shrink-0">
                {combo.models.length} {combo.models.length === 1 ? "MODEL" : "MODELS"}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              {combo.models.length === 0 ? (
                <span className="text-xs text-text-muted italic">No models configured</span>
              ) : (
                combo.models.slice(0, 3).map((model, index) => (
                  <code key={index} className="inline-flex items-center gap-1 rounded bg-bg border border-border-subtle px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                    <span className="truncate max-w-[200px]">{model}</span>
                    <CapacityBadges caps={getCaps?.(model)} />
                  </code>
                ))
              )}
              {combo.models.length > 3 && (
                <span className="text-[10px] font-mono text-text-muted px-1 py-0.5 rounded bg-surface-2">+{combo.models.length - 3} more</span>
              )}
            </div>
            {/* Fusion: judge picker (Auto = first model) */}
            {isFusion && (
              <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 pt-1.5 border-t border-border-subtle">
                <span className="text-[11px] font-medium text-text-muted">Judge Model:</span>
                <button
                  onClick={() => setShowJudgeSelect(true)}
                  className="inline-flex max-w-full items-center gap-1 rounded border border-border-subtle bg-bg px-2 py-0.5 font-mono text-[11px] text-primary hover:border-primary transition-colors cursor-pointer"
                  title="Pick the model that fuses panel answers"
                >
                  <span className="material-symbols-outlined text-[13px]">gavel</span>
                  <span className="truncate">{judge || `Auto — ${combo.models[0] || "first model"}`}</span>
                </button>
                {judge && (
                  <button
                    onClick={() => onSetStrategy({ judgeModel: "" })}
                    className="p-0.5 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                    title="Reset judge to Auto"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Strategy selector + action buttons */}
        <div className="flex w-full flex-col gap-2 pt-2 border-t border-border-subtle sm:flex-row sm:items-center sm:gap-2 sm:shrink-0 lg:w-auto lg:pt-0 lg:border-t-0">
          <div className="w-full sm:w-[210px]">
            <Select
              options={STRATEGY_OPTIONS}
              value={current}
              onChange={(e) => onSetStrategy({ fallbackStrategy: e.target.value })}
              selectClassName="py-1 text-xs font-medium"
            />
          </div>

          <div className="flex items-center gap-1 self-end sm:self-center">
            <button
              onClick={(e) => { e.stopPropagation(); onCopy(combo.name, `combo-${combo.id}`); }}
              className="inline-flex items-center gap-1 rounded border border-border-subtle bg-surface px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-primary cursor-pointer"
              title="Copy combo name"
            >
              <span className="material-symbols-outlined text-[15px]">
                {copied === `combo-${combo.id}` ? "check" : "content_copy"}
              </span>
              <span className="text-[11px] font-medium">Copy</span>
            </button>
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded border border-border-subtle bg-surface px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-primary cursor-pointer"
              title="Edit"
            >
              <span className="material-symbols-outlined text-[15px]">edit</span>
              <span className="text-[11px] font-medium">Edit</span>
            </button>
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1 rounded border border-border-subtle bg-surface px-2 py-1 text-xs text-red-500 transition-colors hover:bg-red-500/10 hover:border-red-500/30 cursor-pointer"
              title="Delete"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              <span className="text-[11px] font-medium">Delete</span>
            </button>
          </div>
        </div>
      </div>

      {/* Judge model picker (single-select; combo members make natural judges too) */}
      {showJudgeSelect && (
        <ModelSelectModal
          isOpen={showJudgeSelect}
          onClose={() => setShowJudgeSelect(false)}
          onSelect={(m) => { onSetStrategy({ judgeModel: m?.value || "" }); setShowJudgeSelect(false); }}
          activeProviders={activeProviders}
          title="Select Judge Model"
          addedModelValues={judge ? [judge] : []}
          closeOnSelect={true}
        />
      )}
    </div>
  );
}

function CapacityAdapterSection({ capacityAdapter, onChange, activeProviders, getCaps }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 py-1 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1 h-3.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-text-main truncate">
            Vision Adapter
          </h2>
          <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2 shrink-0">
            AUTO-FALLBACK
          </span>
        </div>
        <p className="text-xs text-text-muted pl-3">
          Fallback router for multimodal requests (PNG, JPG, WebP, Audio). Automatically directs payloads to capable adapter pools when target models lack modality support.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {CAPACITY_ADAPTER_CAPS.map((cap) => (
          <CapacityAdapterCap
            key={cap.key}
            cap={cap}
            entry={capacityAdapter[cap.key] || EMPTY_CAP_ENTRY}
            onChange={(entry) => onChange({ ...capacityAdapter, [cap.key]: entry })}
            activeProviders={activeProviders}
            getCaps={getCaps}
          />
        ))}
      </div>
    </div>
  );
}

function CapacityAdapterCap({ cap, entry, onChange, activeProviders, getCaps }) {
  const [showModelSelect, setShowModelSelect] = useState(false);
  const { enabled, roundRobin, models } = entry;

  const patch = (p) => onChange({ ...entry, ...p });

  const handleAdd = (model) => {
    if (models.includes(model.value)) return;
    patch({ models: [...models, model.value] });
  };

  const handleRemove = (index) => {
    const next = models.filter((_, i) => i !== index);
    patch({ models: next.length === 0 ? [DEFAULT_FALLBACK_MODEL] : next });
  };

  const handleMove = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= models.length) return;
    const next = [...models];
    [next[index], next[target]] = [next[target], next[index]];
    patch({ models: next });
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border border-border-subtle bg-surface px-3.5 py-3 transition-all duration-150 overflow-hidden hover:border-border hover:bg-surface-2/40",
        !enabled && "opacity-55"
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-[3px] transition-colors",
          enabled ? "bg-primary" : "bg-border-subtle"
        )}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pl-1.5">
        {/* Master toggle + icon + label + chips */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Toggle
            checked={enabled}
            onChange={(v) => patch({ enabled: v })}
            aria-label={`Enable ${cap.label} adapter`}
          />
          <div className="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
            <span className="material-symbols-outlined text-primary text-[18px]">{cap.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs sm:text-sm font-semibold text-text-main">{cap.label} Adapter</span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2">
                {cap.desc}
              </span>
              <span className="text-[10px] font-mono font-medium uppercase tracking-wider text-text-muted px-1.5 py-0.5 rounded border border-border-subtle bg-surface-2 shrink-0">
                {models.length} {models.length === 1 ? "MODEL" : "MODELS"}
              </span>
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
              {models.length === 0 ? (
                <span className="text-xs text-text-muted italic">No fallback models configured</span>
              ) : (
                models.slice(0, 3).map((model, index) => (
                  <code
                    key={`${model}-${index}`}
                    className="group/chip inline-flex items-center gap-1 rounded bg-bg border border-border-subtle px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
                  >
                    <span className="truncate max-w-[180px]">{model}</span>
                    <CapacityBadges caps={getCaps?.(model)} />
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={index === 0}
                      className={cn(
                        "leading-none p-0.5 transition-colors cursor-pointer",
                        index === 0 ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary"
                      )}
                      title="Move up"
                    >
                      <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={index === models.length - 1}
                      className={cn(
                        "leading-none p-0.5 transition-colors cursor-pointer",
                        index === models.length - 1 ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary"
                      )}
                      title="Move down"
                    >
                      <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="leading-none p-0.5 text-text-muted hover:text-red-500 transition-colors cursor-pointer"
                      title="Remove model"
                    >
                      <span className="material-symbols-outlined text-[12px]">close</span>
                    </button>
                  </code>
                ))
              )}
              {models.length > 3 && (
                <span className="text-[10px] font-mono text-text-muted px-1 py-0.5 rounded bg-surface-2">+{models.length - 3} more</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions: Round-robin toggle + Add Model */}
        <div className="flex w-full flex-col gap-2 pt-2 border-t border-border-subtle sm:flex-row sm:items-center sm:gap-3 sm:shrink-0 lg:w-auto lg:pt-0 lg:border-t-0">
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none rounded border border-border-subtle bg-surface px-2.5 py-1">
            <Toggle
              checked={roundRobin}
              onChange={(v) => patch({ roundRobin: v })}
              disabled={!enabled}
              size="sm"
              aria-label={`Round-robin ${cap.label} adapter`}
            />
            <span className="font-mono text-[11px] uppercase tracking-wider">Round robin</span>
          </label>
          <Button
            icon="add"
            variant="ghost"
            size="sm"
            onClick={() => setShowModelSelect(true)}
            disabled={!enabled}
            title={`Add ${cap.label} model`}
          >
            Add Model
          </Button>
        </div>
      </div>

      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAdd}
          activeProviders={activeProviders}
          title={`Add ${cap.label} Model`}
          addedModelValues={models}
          capFilter={cap.key}
          closeOnSelect={false}
        />
      )}
    </div>
  );
}

function ModelItem({ id, index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    // no transition — prevents the CSS settle animation fighting React's re-render on drop
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(model);
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== model) onEdit(trimmed);
    else setDraft(model);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(model); setEditing(false); }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 bg-black/[0.02] hover:bg-black/[0.04] dark:bg-white/[0.02] dark:hover:bg-white/[0.04] transition-colors ${isDragging ? "shadow-md ring-1 ring-primary/30" : ""}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="cursor-grab touch-none p-0.5 rounded text-text-muted hover:text-primary active:cursor-grabbing shrink-0"
        title="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="4" r="2"/><circle cx="15" cy="4" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="20" r="2"/><circle cx="15" cy="20" r="2"/>
        </svg>
      </button>

      {/* Index badge */}
      <span className="text-[10px] font-medium text-text-muted w-3 text-center shrink-0">{index + 1}</span>

      {/* Inline editable model value */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded border border-primary/40 bg-white px-1.5 py-0.5 font-mono text-xs text-text-main outline-none dark:bg-black/20"
        />
      ) : (
        <div
          className="min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs text-text-main hover:bg-black/5 dark:hover:bg-white/5"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      {/* Priority arrows */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className={`p-0.5 rounded ${isFirst ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move up"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_upward</span>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className={`p-0.5 rounded ${isLast ? "text-text-muted/20 cursor-not-allowed" : "text-text-muted hover:text-primary hover:bg-black/5 dark:hover:bg-white/5"}`}
          title="Move down"
        >
          <span className="material-symbols-outlined text-[12px]">arrow_downward</span>
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-all"
        title="Remove"
      >
        <span className="material-symbols-outlined text-[12px]">close</span>
      </button>
    </div>
  );
}

function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders, kindFilter = null }) {
  // Initialize state with combo values - key prop on parent handles reset on remount
  const [name, setName] = useState(combo?.name || "");
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Use stable index-based IDs so duplicates and similar names are handled correctly
  const modelItems = models.map((model, i) => ({ uid: `item-${i}`, model }));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = modelItems.findIndex((m) => m.uid === active.id);
      const newIndex = modelItems.findIndex((m) => m.uid === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        setModels((prev) => arrayMove(prev, oldIndex, newIndex));
      }
    }
  };

  const fetchModalData = async () => {
    try {
      const aliasesRes = await fetch("/api/models/alias");
      if (!aliasesRes.ok) return;
      const aliasesData = await aliasesRes.json();
      setModelAliases(aliasesData.aliases || {});
    } catch (error) {
      console.error("Error fetching modal data:", error);
    }
  };

  useEffect(() => {
    if (isOpen) fetchModalData();
  }, [isOpen]);

  const validateName = (value) => {
    if (!value.trim()) {
      setNameError("Name is required");
      return false;
    }
    if (!VALID_NAME_REGEX.test(value)) {
      setNameError("Only letters, numbers, -, _ and . allowed");
      return false;
    }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    if (value) validateName(value);
    else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) {
      setModels([...models, model.value]);
    }
  };

  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };

  const handleRemoveModel = (index) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newModels = [...models];
    [newModels[index - 1], newModels[index]] = [newModels[index], newModels[index - 1]];
    setModels(newModels);
  };

  const handleMoveDown = (index) => {
    if (index === models.length - 1) return;
    const newModels = [...models];
    [newModels[index], newModels[index + 1]] = [newModels[index + 1], newModels[index]];
    setModels(newModels);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    await onSave({ name: name.trim(), models });
    setSaving(false);
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEdit ? "Edit Combo" : "Create Combo"}
      >
        <div className="flex flex-col gap-3">
          {/* Name */}
          <div>
            <Input
              label="Combo Name"
              value={name}
              onChange={handleNameChange}
              placeholder="my-combo"
              error={nameError}
            />
            <p className="text-[10px] text-text-muted mt-0.5">
              Only letters, numbers, -, _ and . allowed
            </p>
          </div>

          {/* Models */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Models</label>

            {models.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-black/10 dark:border-white/10 rounded-lg bg-black/[0.01] dark:bg-white/[0.01]">
                <span className="material-symbols-outlined text-text-muted text-xl mb-1">layers</span>
                <p className="text-xs text-text-muted">No models added yet</p>
              </div>
            ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
              <SortableContext items={modelItems.map((m) => m.uid)} strategy={verticalListSortingStrategy}>
                <div className="flex max-h-[55vh] min-w-0 flex-col gap-1 overflow-y-auto sm:max-h-[350px]">
                  {modelItems.map(({ uid, model }, index) => (
                    <ModelItem
                      key={uid}
                      id={uid}
                      index={index}
                      model={model}
                      isFirst={index === 0}
                      isLast={index === modelItems.length - 1}
                      onEdit={(newVal) => {
                        const updated = [...models];
                        updated[index] = newVal;
                        setModels(updated);
                      }}
                      onMoveUp={() => handleMoveUp(index)}
                      onMoveDown={() => handleMoveDown(index)}
                      onRemove={() => handleRemoveModel(index)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            )}

            {/* Add Model button */}
            <button
              onClick={() => setShowModelSelect(true)}
              className="w-full mt-2 py-2 border border-dashed border-black/10 dark:border-white/10 rounded-lg text-xs text-primary font-medium hover:text-primary hover:border-primary/50 transition-colors flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Model
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              fullWidth
              size="sm"
              disabled={!name.trim() || !!nameError || saving}
            >
              {saving ? "Saving..." : isEdit ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Model Select Modal */}
      {showModelSelect && (
        <ModelSelectModal
          isOpen={showModelSelect}
          onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel}
          onDeselect={handleDeselectModel}
          activeProviders={activeProviders}
          modelAliases={modelAliases}
          title="Add Model to Combo"
          kindFilter={kindFilter}
          addedModelValues={models}
          closeOnSelect={false}
        />
      )}
    </>
  );
}
