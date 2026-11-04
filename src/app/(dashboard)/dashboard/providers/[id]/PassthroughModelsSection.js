"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Button, ProviderIcon } from "@/shared/components";
import { getProviderCustomModelRows } from "@/shared/utils/providerCustomModels";

import { Icon } from "@/shared/components/Icon";
function PassthroughModelRow({ modelId, fullModel, copied, onCopy, onDeleteAlias, onTest, testStatus, isTesting, providerId }) {
  const borderColor = testStatus === "ok"
    ? "border-success/40"
    : testStatus === "error"
    ? "border-danger/40"
    : "border-border-subtle";

  return (
    <div role="row" className={`flex min-w-0 items-center gap-3 border-b px-3 py-2 ${borderColor} hover:bg-surface-2/60`}>
      {testStatus === "ok" ? (
        <Icon name={"check_circle"} className="shrink-0 text-base text-success" />
      ) : testStatus === "error" ? (
        <Icon name={"cancel"} className="shrink-0 text-base text-danger" />
      ) : (
        <ProviderIcon providerId={providerId} size={18} fallbackIcon="smart_toy" className="shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{modelId}</p>

        <div className="flex items-center gap-1 mt-1">
        <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-text-main">{fullModel}</code>
          <div className="relative group/btn">
            <button
              onClick={() => onCopy(fullModel, `model-${modelId}`)}
              className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-primary"
            >
              <Icon name={copied === `model-${modelId}` ? "check" : "content_copy"} className=" text-sm" />
            </button>
            <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
              {copied === `model-${modelId}` ? "Copied!" : "Copy"}
            </span>
          </div>
          {onTest && (
            <div className="relative group/btn">
              <button
                onClick={onTest}
                disabled={isTesting}
                className="rounded-md p-1 text-text-muted hover:bg-surface-2 hover:text-primary transition-colors"
              >
                <Icon name={isTesting ? "progress_activity" : "science"} className=" text-sm" style={isTesting ? { animation: "spin 1s linear infinite" } : undefined} />
              </button>
              <span className="pointer-events-none absolute top-5 left-1/2 -translate-x-1/2 text-[10px] text-text-muted whitespace-nowrap opacity-0 group-hover/btn:opacity-100 transition-opacity">
                {isTesting ? "Testing..." : "Test"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={onDeleteAlias}
        className="rounded-md p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
        title="Remove model"
      >
        <Icon name={"delete"} className=" text-sm" />
      </button>
    </div>
  );
}

PassthroughModelRow.propTypes = {
  modelId: PropTypes.string.isRequired,
  providerId: PropTypes.string,
  fullModel: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onTest: PropTypes.func,
  testStatus: PropTypes.oneOf(["ok", "error"]),
  isTesting: PropTypes.bool,
};

export default function PassthroughModelsSection({ providerId, providerAlias, modelAliases, customModels, copied, onCopy, onDeleteAlias, onAddCustomModel, onDeleteCustomModel }) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);

  const allModels = getProviderCustomModelRows({
    customModels,
    modelAliases,
    providerAlias,
    type: "llm",
  });

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();

    if (allModels.some((model) => model.id === modelId)) {
      alert("Model already exists for this provider.");
      return;
    }

    setAdding(true);
    try {
      await onAddCustomModel(modelId);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        OpenRouter supports any model. Add models and create aliases for quick access.
      </p>

      {/* Add new model */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="new-model-input" className="text-xs text-text-muted mb-1 block">Model ID (from OpenRouter)</label>
          <input
            id="new-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="anthropic/claude-3-opus"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? "Adding..." : "Add"}
        </Button>
      </div>

      {/* Models list */}
      {allModels.length > 0 && (
        <div role="table" aria-label="Passthrough models" className="flex flex-col overflow-hidden rounded-md border border-border-subtle">
          {allModels.map(({ id, fullModel, alias, source }) => (
            <PassthroughModelRow
              key={`${source}-${fullModel}`}
              modelId={id}
              providerId={providerId}
              fullModel={fullModel}
              copied={copied}
              onCopy={onCopy}
              onDeleteAlias={() => source === "custom" ? onDeleteCustomModel(id) : onDeleteAlias(alias)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

PassthroughModelsSection.propTypes = {
  providerAlias: PropTypes.string.isRequired,
  providerId: PropTypes.string,
  modelAliases: PropTypes.object.isRequired,
  customModels: PropTypes.arrayOf(PropTypes.object),
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  onAddCustomModel: PropTypes.func.isRequired,
  onDeleteCustomModel: PropTypes.func.isRequired,
};
