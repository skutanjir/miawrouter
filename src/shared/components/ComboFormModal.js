"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import Input from "./Input";
import Button from "./Button";
import ModelSelectModal from "./ModelSelectModal";

import { Icon } from "@/shared/components/Icon";
const VALID_NAME_REGEX = /^[a-zA-Z0-9_.\-]+$/;

// Inline editable model item
function ModelItem({ index, model, isFirst, isLast, onEdit, onMoveUp, onMoveDown, onRemove }) {
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
    <div className="group flex min-w-0 items-center gap-1.5 rounded-md border border-border-subtle bg-surface-2 px-2 py-1.5">
      <span className="w-4 shrink-0 text-center font-mono text-xs text-text-subtle tabular-nums">{index + 1}</span>
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
        <button
          type="button"
          className="min-w-0 flex-1 truncate rounded px-1.5 py-0.5 text-left font-mono text-xs text-text-main transition-colors duration-150 hover:bg-surface"
          onClick={() => setEditing(true)}
          title="Click to edit this model ID"
        >
          {model}
        </button>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move model up"
          title="Move up"
          className={`rounded p-0.5 transition-colors duration-150 ${isFirst ? "cursor-not-allowed text-text-subtle" : "text-text-muted hover:bg-surface hover:text-primary"}`}
        >
          <Icon name="arrow_upward" className="text-[12px]" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move model down"
          title="Move down"
          className={`rounded p-0.5 transition-colors duration-150 ${isLast ? "cursor-not-allowed text-text-subtle" : "text-text-muted hover:bg-surface hover:text-primary"}`}
        >
          <Icon name="arrow_downward" className="text-[12px]" />
        </button>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove model from combo"
        title="Remove"
        className="rounded p-0.5 text-text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
      >
        <Icon name="close" className="text-[12px]" />
      </button>
    </div>
  );
}

// Reusable Combo create/edit modal. forcePrefix auto-prepends to name.
export default function ComboFormModal({ isOpen, combo, onClose, onSave, activeProviders, kindFilter = null, forcePrefix = "", title }) {
  // Strip prefix when editing existing combo so user only edits suffix
  const initialName = combo?.name
    ? (forcePrefix && combo.name.startsWith(forcePrefix) ? combo.name.slice(forcePrefix.length) : combo.name)
    : "";
  const [name, setName] = useState(initialName);
  const [models, setModels] = useState(combo?.models || []);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [modelAliases, setModelAliases] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/models/alias").then((r) => r.ok ? r.json() : null).then((d) => d && setModelAliases(d.aliases || {})).catch(() => {});
  }, [isOpen]);

  const validateName = (value) => {
    if (!value.trim()) { setNameError("Name is required."); return false; }
    const full = forcePrefix + value;
    if (!VALID_NAME_REGEX.test(full)) { setNameError("Use only letters, numbers, -, _ or . in the name."); return false; }
    setNameError("");
    return true;
  };

  const handleNameChange = (e) => {
    let value = e.target.value;
    // If user types prefix manually, strip it (we always prepend)
    if (forcePrefix && value.startsWith(forcePrefix)) value = value.slice(forcePrefix.length);
    setName(value);
    if (value) validateName(value); else setNameError("");
  };

  const handleAddModel = (model) => {
    if (!models.includes(model.value)) setModels([...models, model.value]);
  };
  const handleDeselectModel = (model) => {
    setModels(models.filter((m) => m !== model.value));
  };
  const handleRemoveModel = (i) => setModels(models.filter((_, idx) => idx !== i));
  const handleMoveUp = (i) => {
    if (i === 0) return;
    const a = [...models]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setModels(a);
  };
  const handleMoveDown = (i) => {
    if (i === models.length - 1) return;
    const a = [...models]; [a[i], a[i + 1]] = [a[i + 1], a[i]]; setModels(a);
  };

  const handleSave = async () => {
    if (!validateName(name)) return;
    setSaving(true);
    await onSave({ name: forcePrefix + name.trim(), models });
    setSaving(false);
  };

  const isEdit = !!combo;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={title || (isEdit ? "Edit Combo" : "Create Combo")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            {forcePrefix ? (
              <>
                <label htmlFor="combo-name" className="text-sm font-medium text-text-main">
                  Combo name
                  <span className="ml-1 text-danger">*</span>
                </label>
                <div className="flex items-stretch">
                  <span className="inline-flex items-center rounded-l-md border border-r-0 border-border bg-surface-2 px-2 font-mono text-sm text-text-muted">
                    {forcePrefix}
                  </span>
                  <input
                    id="combo-name"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="my-combo"
                    className="min-w-0 flex-1 rounded-r-md border border-border bg-surface-2 px-2 py-1.5 font-mono text-sm text-text-main outline-none transition-colors duration-150 focus:border-primary"
                  />
                </div>
                {nameError && (
                  <p className="flex items-center gap-1 text-xs text-danger">
                    <Icon name="error" className="text-[14px]" />
                    {nameError}
                  </p>
                )}
              </>
            ) : (
              <Input label="Combo name" required value={name} onChange={handleNameChange} placeholder="my-combo" error={nameError} />
            )}
            <p className="text-xs text-text-muted">
              {forcePrefix ? `Auto-prefixed with "${forcePrefix}". ` : ""}
              Letters, numbers, <span className="font-mono">-</span>, <span className="font-mono">_</span> and{" "}
              <span className="font-mono">.</span> are allowed.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-main">Models in order</span>
              <span className="text-xs text-text-muted tabular-nums">{models.length} selected</span>
            </div>

            {models.length === 0 ? (
              <div className="flex flex-col items-start gap-1 rounded-[10px] border border-dashed border-border p-3.5">
                <p className="text-sm font-medium text-text-main">No models yet</p>
                <p className="text-[13px] text-text-muted">
                  Add at least one model — the combo routes each request down this list in order.
                </p>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[55vh] sm:max-h-[350px]">
                {models.map((model, index) => (
                  <ModelItem
                    key={index}
                    index={index}
                    model={model}
                    isFirst={index === 0}
                    isLast={index === models.length - 1}
                    onEdit={(v) => { const a = [...models]; a[index] = v; setModels(a); }}
                    onMoveUp={() => handleMoveUp(index)}
                    onMoveDown={() => handleMoveDown(index)}
                    onRemove={() => handleRemoveModel(index)}
                  />
                ))}
              </div>
            )}

            <Button variant="outline" icon="add" onClick={() => setShowModelSelect(true)} fullWidth size="sm">
              Add model
            </Button>
            <p className="text-xs text-text-muted">
              Click a model ID to edit it, and use the arrows to change the routing order.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row">
            <Button onClick={onClose} variant="ghost" fullWidth size="sm">
              Cancel
            </Button>
            <Button onClick={handleSave} fullWidth size="sm" disabled={!name.trim() || !!nameError || saving} loading={saving}>
              {saving ? "Saving…" : isEdit ? "Save combo" : "Create combo"}
            </Button>
          </div>
        </div>
      </Modal>

      {showModelSelect && (
        <ModelSelectModal isOpen={showModelSelect} onClose={() => setShowModelSelect(false)}
          onSelect={handleAddModel} onDeselect={handleDeselectModel}
          activeProviders={activeProviders} modelAliases={modelAliases}
          title="Add Model to Combo" kindFilter={kindFilter}
          addedModelValues={models} closeOnSelect={false} />
      )}
    </>
  );
}
