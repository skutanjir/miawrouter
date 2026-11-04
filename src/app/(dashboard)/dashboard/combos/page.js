"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { Card, Button, Modal, Input, CardSkeleton, ModelSelectModal, ConfirmModal, CapacityBadges, Select, Toggle, ProviderIcon } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useModelCaps } from "@/shared/hooks/useModelCaps";
import { ConfigSection, ConfigRow } from "../components/ConfigSection";

import { Icon } from "@/shared/components/Icon";
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

// Provider segment of a model id ("anthropic/claude-…" → "anthropic"); null when
// the id carries no provider prefix.
function providerOf(model) {
  const idx = String(model || "").indexOf("/");
  return idx > 0 ? String(model).slice(0, idx) : null;
}

function ModelChip({ model, getCaps, tone = "surface" }) {
  const provider = providerOf(model);
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5",
        tone === "surface" ? "border-border-subtle bg-surface-2" : "border-border-subtle bg-surface"
      )}
    >
      {provider && (
        <ProviderIcon
          providerId={provider}
          size={16}
          fallbackText={provider.slice(0, 2).toUpperCase()}
          className="shrink-0"
        />
      )}
      <code className="max-w-[18rem] truncate font-mono text-xs text-text-main">{model}</code>
      <CapacityBadges caps={getCaps?.(model)} />
    </span>
  );
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
  }, []);

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

  // Duplicate reuses the create endpoint: same model chain, a free "<name>-copy" name.
  const handleDuplicate = async (combo) => {
    const taken = new Set(combos.map((c) => c.name));
    let name = `${combo.name}-copy`;
    for (let n = 2; taken.has(name); n += 1) name = `${combo.name}-copy-${n}`;

    try {
      const res = await fetch("/api/combos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, models: combo.models, ...(combo.kind ? { kind: combo.kind } : {}) }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to duplicate combo");
      }
    } catch (error) {
      console.log("Error duplicating combo:", error);
    }
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
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Model combos</h1>
          <p>
            Named model chains that an API request can target. The router walks the chain in the
            strategy you pick, so a request never fails while another model in the chain can answer it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-text-muted tabular-nums">
            {combos.length} combo{combos.length === 1 ? "" : "s"}
          </span>
          <Button icon="add" size="sm" onClick={() => setShowCreateModal(true)}>
            Create combo
          </Button>
        </div>
      </div>

      {/* Combos list */}
      {combos.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Icon name="layers" weight="duotone" className="text-[28px] text-text-muted" />
            <p className="text-sm font-medium text-text-main">No combos yet</p>
            <p className="max-w-md text-[13px] text-text-muted">
              A combo lets one endpoint fail over across several models, in the order you set.
            </p>
            <Button icon="add" size="sm" className="mt-2" onClick={() => setShowCreateModal(true)}>
              Create combo
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="divide-y divide-border-subtle">
            {combos.map((combo) => (
              <ComboRow
                key={combo.id}
                combo={combo}
                getCaps={getCaps}
                activeProviders={activeProviders}
                copied={copied}
                onCopy={copy}
                onEdit={() => setEditingCombo(combo)}
                onDuplicate={() => handleDuplicate(combo)}
                onDelete={() => handleDelete(combo.id)}
                strategy={comboStrategies[combo.name] || {}}
                onSetStrategy={(patch) => handleSetComboStrategy(combo.name, patch)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Routing strategy reference: what each per-combo strategy does. */}
      <Card title="Routing strategies" icon="alt_route" subtitle="Pick one per combo below.">
        <dl className="grid gap-3 sm:grid-cols-2">
          {STRATEGY_OPTIONS.map((option) => (
            <div key={option.value} className="min-w-0 rounded-md border border-border-subtle bg-surface-2/40 p-3">
              <dt className="font-mono text-xs font-medium text-primary">{option.value}</dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-text-muted">{option.desc}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Capacity adapter */}
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
  { value: "fallback", label: "Fallback", desc: "Tries the chain in order until one model succeeds." },
  { value: "round-robin", label: "Round robin", desc: "Rotates across the chain; position is only a tie-break." },
  { value: "fusion", label: "Fusion", desc: "Queries the chain in parallel and a judge model synthesizes one answer." },
  { value: "race", label: "Race", desc: "Dispatches in parallel; the first successful response wins." },
];

const STRATEGY_SELECT_OPTIONS = STRATEGY_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

function ComboRow({
  combo,
  getCaps,
  activeProviders = [],
  copied,
  onCopy,
  onEdit,
  onDuplicate,
  onDelete,
  strategy = {},
  onSetStrategy,
}) {
  const [showJudgeSelect, setShowJudgeSelect] = useState(false);
  const current = strategy.fallbackStrategy || "fallback";
  const judge = strategy.judgeModel || "";
  const isFusion = current === "fusion";
  // Order decides the outcome for fallback/race/fusion; round robin rotates instead.
  const orderMatters = current !== "round-robin";
  const [showAll, setShowAll] = useState(false);
  const visibleModels = showAll ? combo.models : combo.models.slice(0, 4);

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2/40 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
      {/* Chain */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="truncate font-mono text-sm font-semibold text-text-main">{combo.name}</code>
          <span className="text-xs text-text-muted tabular-nums">
            {combo.models.length} model{combo.models.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCopy(combo.name, `combo-${combo.id}`); }}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:bg-surface-2 hover:text-primary"
            title="Copy combo name"
          >
            <Icon name={copied === `combo-${combo.id}` ? "check" : "content_copy"} className="text-[14px]" />
            {copied === `combo-${combo.id}` ? "Copied" : "Copy name"}
          </button>
        </div>

        {combo.models.length === 0 ? (
          <p className="mt-2 text-[13px] text-text-muted">
            No models in this combo yet — edit it to add at least one.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
            {visibleModels.map((model, index) => (
              <Fragment key={`${model}-${index}`}>
                {index > 0 && (
                  orderMatters ? (
                    <Icon name="arrow_forward" className="text-[12px] text-text-subtle" aria-hidden="true" />
                  ) : (
                    <span className="text-text-subtle" aria-hidden="true">·</span>
                  )
                )}
                <ModelChip model={model} getCaps={getCaps} />
              </Fragment>
            ))}
            {combo.models.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-xs text-text-muted transition-colors hover:text-primary"
              >
                {showAll ? "Show less" : `+${combo.models.length - 4} more`}
              </button>
            )}
          </div>
        )}

        {/* Fusion: judge picker (Auto = first model) */}
        {isFusion && (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2">
            <span className="text-[13px] text-text-muted">Judge model</span>
            <button
              type="button"
              onClick={() => setShowJudgeSelect(true)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 font-mono text-xs text-primary transition-colors hover:border-primary"
              title="Pick the model that fuses panel answers"
            >
              <Icon name="gavel" className="text-[13px]" />
              <span className="truncate">{judge || `Auto — ${combo.models[0] || "first model"}`}</span>
            </button>
            {judge && (
              <button
                type="button"
                onClick={() => onSetStrategy({ judgeModel: "" })}
                className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                title="Reset judge to Auto"
              >
                <Icon name="close" className="text-[13px]" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Strategy + actions */}
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="w-full sm:w-[180px]">
          <Select
            options={STRATEGY_SELECT_OPTIONS}
            value={current}
            onChange={(e) => onSetStrategy({ fallbackStrategy: e.target.value })}
            aria-label={`Routing strategy for ${combo.name}`}
            selectClassName="py-1 text-xs font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <Button variant="secondary" size="sm" icon="edit" onClick={onEdit}>
            Edit
          </Button>
          <Button variant="secondary" size="sm" icon="content_copy" onClick={onDuplicate}>
            Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-text-muted hover:text-danger"
            onClick={onDelete}
            title={`Delete ${combo.name}`}
          >
            <Icon name="delete" className="text-[16px]" />
          </Button>
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
    <ConfigSection
      title="Capacity adapter"
      icon="swap_horiz"
      subtitle="A request that needs an input modality its target model cannot read is sent to the first enabled fallback pool below instead of failing."
    >
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
    </ConfigSection>
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
    <ConfigRow
      disabled={!enabled}
      label={`${cap.label} fallback`}
      help={`${cap.desc}. ${models.length} fallback model${models.length === 1 ? "" : "s"} in order.`}
      badge={
        <span className="text-xs text-text-muted">
          {enabled ? "Enabled" : "Disabled"}
        </span>
      }
      control={
        <>
          <label className="flex cursor-pointer select-none items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-text-muted">
            <Toggle
              checked={roundRobin}
              onChange={(v) => patch({ roundRobin: v })}
              disabled={!enabled}
              size="sm"
              ariaLabel={`Round-robin ${cap.label} adapter`}
            />
            Round robin
          </label>
          <Button icon="add" variant="secondary" size="sm" onClick={() => setShowModelSelect(true)} disabled={!enabled}>
            Add model
          </Button>
          <Toggle
            checked={enabled}
            onChange={(v) => patch({ enabled: v })}
            ariaLabel={`Enable ${cap.label} adapter`}
          />
        </>
      }
    >
      {models.length === 0 ? (
        <p className="mt-2 text-[13px] text-text-muted">No fallback models configured.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {models.map((model, index) => (
            <span
              key={`${model}-${index}`}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-2 py-0.5 pl-1.5 pr-1"
            >
              <span className="text-xs text-text-subtle tabular-nums">{index + 1}</span>
              {providerOf(model) && (
                <ProviderIcon
                  providerId={providerOf(model)}
                  size={16}
                  fallbackText={providerOf(model).slice(0, 2).toUpperCase()}
                  className="shrink-0"
                />
              )}
              <code className="max-w-[16rem] truncate font-mono text-xs text-text-main">{model}</code>
              <CapacityBadges caps={getCaps?.(model)} />
              <button
                type="button"
                onClick={() => handleMove(index, -1)}
                disabled={index === 0}
                className={cn(
                  "rounded p-0.5 transition-colors",
                  index === 0 ? "cursor-not-allowed text-text-subtle/40" : "text-text-muted hover:text-primary"
                )}
                title="Move up"
              >
                <Icon name="arrow_upward" className="text-[12px]" />
              </button>
              <button
                type="button"
                onClick={() => handleMove(index, 1)}
                disabled={index === models.length - 1}
                className={cn(
                  "rounded p-0.5 transition-colors",
                  index === models.length - 1 ? "cursor-not-allowed text-text-subtle/40" : "text-text-muted hover:text-primary"
                )}
                title="Move down"
              >
                <Icon name="arrow_downward" className="text-[12px]" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="rounded p-0.5 text-text-muted transition-colors hover:text-danger"
                title="Remove model"
              >
                <Icon name="close" className="text-[12px]" />
              </button>
            </span>
          ))}
        </div>
      )}

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
    </ConfigRow>
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
      className={cn(
        "group flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 transition-colors",
        isDragging ? "border-primary bg-surface-2" : "border-border-subtle bg-surface-2/40 hover:bg-surface-2"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="shrink-0 cursor-grab touch-none rounded p-0.5 text-text-subtle hover:text-primary active:cursor-grabbing"
        title="Drag to reorder"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="9" cy="4" r="2"/><circle cx="15" cy="4" r="2"/>
          <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
          <circle cx="9" cy="20" r="2"/><circle cx="15" cy="20" r="2"/>
        </svg>
      </button>

      {/* Index badge */}
      <span className="w-3 shrink-0 text-center text-xs text-text-subtle tabular-nums">{index + 1}</span>

      {/* Inline editable model value */}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-md border border-primary bg-surface px-1.5 py-0.5 font-mono text-xs text-text-main outline-none"
        />
      ) : (
        <div
          className="min-w-0 flex-1 cursor-text truncate rounded px-1.5 py-0.5 font-mono text-xs text-text-main hover:bg-surface-2"
          onClick={() => setEditing(true)}
          title="Click to edit"
        >
          {model}
        </div>
      )}

      {/* Priority arrows */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          className={cn(
            "rounded p-0.5",
            isFirst ? "cursor-not-allowed text-text-subtle/40" : "text-text-muted hover:bg-surface-2 hover:text-primary"
          )}
          title="Move up"
        >
          <Icon name="arrow_upward" className="text-[12px]" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          className={cn(
            "rounded p-0.5",
            isLast ? "cursor-not-allowed text-text-subtle/40" : "text-text-muted hover:bg-surface-2 hover:text-primary"
          )}
          title="Move down"
        >
          <Icon name="arrow_downward" className="text-[12px]" />
        </button>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        className="rounded p-0.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-danger"
        title="Remove"
      >
        <Icon name="close" className="text-[12px]" />
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
        size="md"
      >
        <div className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <Input
              label="Combo name"
              value={name}
              onChange={handleNameChange}
              placeholder="my-combo"
              error={nameError}
              hint="Letters, numbers, -, _ and . only. This is the model id your clients call."
            />
          </div>

          {/* Models */}
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label className="text-[13px] font-medium text-text-main">Models in order</label>
              <span className="text-xs text-text-muted tabular-nums">{models.length} in chain</span>
            </div>

            {models.length === 0 ? (
              <div className="rounded-md border border-border-subtle bg-surface-2/40 px-3 py-6 text-center">
                <Icon name="layers" className="text-[20px] text-text-muted" />
                <p className="mt-1 text-[13px] text-text-muted">
                  Add at least one model. The first one is tried first.
                </p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
                <SortableContext items={modelItems.map((m) => m.uid)} strategy={verticalListSortingStrategy}>
                  <div className="flex max-h-[55vh] min-w-0 flex-col gap-1 overflow-y-auto pr-1 sm:max-h-[350px]">
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
              type="button"
              onClick={() => setShowModelSelect(true)}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface py-2 text-[13px] font-medium text-primary transition-colors hover:bg-surface-2"
            >
              <Icon name="add" className="text-[16px]" />
              Add model
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
            <Button onClick={onClose} variant="ghost" size="sm">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={!name.trim() || !!nameError || saving}
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create combo"}
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
