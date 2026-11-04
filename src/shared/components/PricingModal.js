"use client";

import { useState, useEffect } from "react";
import { getDefaultPricing } from "open-sse/providers/pricing.js";
import Modal, { ConfirmModal } from "./Modal";
import Button from "./Button";

import { Icon } from "@/shared/components/Icon";
const PRICING_FIELDS = ["input", "output", "cached", "reasoning", "cache_creation"];

export default function PricingModal({ isOpen, onClose, onSave }) {
  const [pricingData, setPricingData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPricing();
    }
  }, [isOpen]);

  const loadPricing = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/pricing");
      if (response.ok) {
        const data = await response.json();
        setPricingData(data);
      } else {
        // Fallback to defaults
        const defaults = getDefaultPricing();
        setPricingData(defaults);
      }
    } catch (err) {
      console.error("Failed to load pricing:", err);
      const defaults = getDefaultPricing();
      setPricingData(defaults);
    } finally {
      setLoading(false);
    }
  };

  const handlePricingChange = (provider, model, field, value) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    setPricingData((prev) => {
      const newData = { ...prev };
      if (!newData[provider]) newData[provider] = {};
      if (!newData[provider][model]) newData[provider][model] = {};
      newData[provider][model][field] = numValue;
      return newData;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pricingData),
      });

      if (response.ok) {
        onSave?.();
        onClose();
      } else {
        const payload = await response.json().catch(() => ({}));
        setError({
          message: `Saving the rates failed (HTTP ${response.status}${payload.error ? `: ${payload.error}` : ""}).`,
          action: "Fix the highlighted rates or reload the page to fetch the stored values, then save again.",
        });
      }
    } catch (err) {
      console.error("Failed to save pricing:", err);
      setError({
        message: "Saving the rates failed: the request could not reach the server.",
        action: "Check that MiawRouter is still running, then save again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setConfirmReset(false);
    setError(null);
    try {
      const response = await fetch("/api/pricing", { method: "DELETE" });
      if (response.ok) {
        const defaults = getDefaultPricing();
        setPricingData(defaults);
      } else {
        setError({
          message: `Resetting the rates failed (HTTP ${response.status}).`,
          action: "Check that MiawRouter is still running, then reset again.",
        });
      }
    } catch (err) {
      console.error("Failed to reset pricing:", err);
      setError({
        message: "Resetting the rates failed: the request could not reach the server.",
        action: "Check that MiawRouter is still running, then reset again.",
      });
    }
  };

  if (!isOpen) return null;

  const allProviders = Object.keys(pricingData).sort();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Pricing Configuration"
        size="full"
        className="max-w-6xl!"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              icon="restore"
              onClick={() => setConfirmReset(true)}
              disabled={saving || loading}
              className="mr-auto"
            >
              Reset to defaults
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={loading}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-[13px] leading-relaxed text-text-muted">
            All rates are in US dollars per million tokens. An input rate of{" "}
            <span className="font-mono tabular-nums text-text-main">2.50</span> means $2.50 per 1,000,000
            input tokens.
          </p>

          {error && (
            <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
              <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-text-main">{error.message}</p>
                <p className="mt-1 text-text-muted">{error.action}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-text-muted">
              <Icon name="progress_activity" className="animate-spin text-[18px]" />
              Loading billing rates from the router…
            </div>
          ) : allProviders.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-[10px] border border-border bg-surface-2 p-4 text-sm">
              <p className="font-medium text-text-main">No providers have configured rates</p>
              <p className="text-text-muted">
                Cost tracking stays empty until at least one provider is connected. Add a connection, then
                reopen this dialog.
              </p>
            </div>
          ) : (
            allProviders.map((provider) => {
              const models = Object.keys(pricingData[provider]).sort();
              return (
                <section key={provider} className="overflow-hidden rounded-[10px] border border-border">
                  <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-2.5">
                    <h3 className="text-[15px] font-semibold text-text-main">{provider}</h3>
                    <span className="text-xs text-text-muted">
                      {models.length} {models.length === 1 ? "model" : "models"}
                    </span>
                  </header>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead className="bg-surface-2 text-text-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Model</th>
                          <th className="px-3 py-2 text-right font-medium">Input</th>
                          <th className="px-3 py-2 text-right font-medium">Output</th>
                          <th className="px-3 py-2 text-right font-medium">Cached</th>
                          <th className="px-3 py-2 text-right font-medium">Reasoning</th>
                          <th className="px-3 py-2 text-right font-medium">Cache creation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {models.map((model) => (
                          <tr key={model} className="border-t border-border-subtle hover:bg-surface-2/60">
                            <td className="px-3 py-1.5 font-mono text-text-main">{model}</td>
                            {PRICING_FIELDS.map((field) => (
                              <td key={field} className="px-3 py-1.5 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  aria-label={`${provider} ${model} ${field} rate`}
                                  value={pricingData[provider][model][field] || 0}
                                  onChange={(e) => handlePricingChange(provider, model, field, e.target.value)}
                                  className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right font-mono text-[13px] tabular-nums text-text-main transition-colors duration-150 focus:outline-none focus:border-primary"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        title="Reset pricing to defaults"
        message="Every provider rate returns to the MiawRouter default table and your edits are discarded. This cannot be undone."
        confirmText="Reset rates"
        cancelText="Keep my rates"
      />
    </>
  );
}
