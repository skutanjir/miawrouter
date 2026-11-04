"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal, Input, Button, Badge } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";

// Dual-mode modal: edit when `node` provided, add otherwise
export default function AddCustomEmbeddingModal({ isOpen, onClose, onCreated, onSaved, node }) {
  const isEdit = !!node;
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    baseUrl: DEFAULT_BASE_URL,
  });
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [checkKey, setCheckKey] = useState("");
  const [checkModelId, setCheckModelId] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setValidationResult(null);
    setSaveError(null);
    setCheckKey("");
    setCheckModelId("");
    if (isEdit) {
      setFormData({
        name: node.name || "",
        prefix: node.prefix || "",
        baseUrl: node.baseUrl || DEFAULT_BASE_URL,
      });
    } else {
      setFormData({ name: "", prefix: "", baseUrl: DEFAULT_BASE_URL });
    }
  }, [isOpen, isEdit, node]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim()) return;
    setSubmitting(true);
    setSaveError(null);
    try {
      const url = isEdit ? `/api/provider-nodes/${node.id}` : "/api/provider-nodes";
      const method = isEdit ? "PUT" : "POST";
      const payload = {
        name: formData.name,
        prefix: formData.prefix,
        baseUrl: formData.baseUrl,
      };
      if (!isEdit) payload.type = "custom-embedding";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (isEdit) onSaved?.(data.node);
        else onCreated?.(data.node);
      } else {
        setSaveError({
          message: data.error || `The router rejected the provider (HTTP ${res.status}).`,
          action: `Check the prefix "${formData.prefix}" — it has to be unique among provider prefixes — then save again.`,
        });
      }
    } catch (error) {
      console.log("Error saving custom embedding node:", error);
      setSaveError({
        message: "Saving the provider failed: the request could not reach the router.",
        action: "Check that MiawRouter is still running, then save again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      const res = await fetch("/api/provider-nodes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: formData.baseUrl,
          apiKey: checkKey,
          type: "custom-embedding",
          modelId: checkModelId.trim() || undefined,
        }),
      });
      const data = await res.json();
      setValidationResult(data);
    } catch {
      setValidationResult({ valid: false, error: "Network error" });
    } finally {
      setValidating(false);
    }
  };

  const renderValidationResult = () => {
    if (!validationResult) return null;
    const { valid, error, dimensions } = validationResult;
    if (valid) {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            Endpoint answered
          </Badge>
          {dimensions && (
            <span className="text-[13px] text-text-muted tabular-nums">{dimensions} dimensions</span>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
        <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-text-main">The endpoint rejected the test request</p>
          <p className="mt-1 text-text-muted">{error || "No reason was returned by the endpoint."}</p>
          <p className="mt-1 text-text-muted">
            Verify the base URL and that the API key belongs to it, then check again. A model ID that the
            provider does not serve also fails here.
          </p>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} title={isEdit ? "Edit Custom Embedding" : "Add Custom Embedding"} onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Voyage AI"
            hint="A friendly label shown in provider lists."
          />
          <Input
            label="Prefix"
            required
            value={formData.prefix}
            onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
            placeholder="voyage"
            hint="Prefixes every model ID, e.g. voyage/voyage-3."
            inputClassName="font-mono text-[13px]"
          />
          <Input
            label="Base URL"
            required
            value={formData.baseUrl}
            onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
            placeholder="https://api.voyageai.com/v1"
            hint="Most embedding APIs are OpenAI-compatible: Voyage, Cohere, Jina, Mistral, Together…"
            inputClassName="font-mono text-[13px]"
          />
        </div>

        <section className="flex flex-col gap-4 border-t border-border-subtle pt-5">
          <div>
            <h3 className="text-[15px] font-semibold text-text-main">Connection check</h3>
            <p className="mt-1 text-[13px] text-text-muted">
              Sends one embeddings request with these credentials. Nothing is stored by the check.
            </p>
          </div>

          <Input
            label="API Key"
            type="password"
            value={checkKey}
            onChange={(e) => setCheckKey(e.target.value)}
            placeholder="Key used for the test request only"
            inputClassName="font-mono text-[13px]"
          />
          <Input
            label="Model ID"
            value={checkModelId}
            onChange={(e) => setCheckModelId(e.target.value)}
            placeholder="e.g. voyage-3, embed-english-v3.0, text-embedding-3-small"
            hint="Required for the check: the request is sent to this model."
            inputClassName="font-mono text-[13px]"
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleValidate}
              disabled={!checkKey || !checkModelId.trim() || validating || !formData.baseUrl.trim()}
              variant="secondary"
              loading={validating}
            >
              {validating ? "Checking…" : "Check endpoint"}
            </Button>
            {renderValidationResult()}
          </div>
        </section>

        {saveError && (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
            <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-text-main">{saveError.message}</p>
              <p className="mt-1 text-text-muted">{saveError.action}</p>
            </div>
          </div>
        )}

        <div className="flex gap-2 border-t border-border-subtle pt-5">
          <Button onClick={onClose} variant="ghost" fullWidth>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            fullWidth
            disabled={!formData.name.trim() || !formData.prefix.trim() || !formData.baseUrl.trim() || submitting}
            loading={submitting}
          >
            {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save" : "Create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

AddCustomEmbeddingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreated: PropTypes.func,
  onSaved: PropTypes.func,
  node: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    prefix: PropTypes.string,
    baseUrl: PropTypes.string,
  }),
};
