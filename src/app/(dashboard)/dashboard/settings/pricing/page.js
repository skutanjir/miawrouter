"use client";

import { useState, useEffect } from "react";
import { Card, Button, CardSkeleton } from "@/shared/components";
import PricingModal from "@/shared/components/PricingModal";
import { ConfigSection, ConfigRow } from "../../components/ConfigSection";

import { Icon } from "@/shared/components/Icon";

const COST_FORMULA =
  "(input_tokens × input_rate) + (output_tokens × output_rate) + (cached_tokens × cached_rate)";

const TOKEN_TYPES = [
  { name: "Input", note: "Standard prompt tokens." },
  { name: "Output", note: "Completion and response tokens." },
  { name: "Cached", note: "Cached input tokens, typically about 50% of the input rate." },
  { name: "Reasoning", note: "Reasoning/thinking tokens; falls back to the output rate." },
  { name: "Cache creation", note: "Tokens spent creating cache entries; falls back to the input rate." },
];

export default function PricingSettingsPage() {
  const [showModal, setShowModal] = useState(false);
  const [currentPricing, setCurrentPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/pricing");
      if (!response.ok) throw new Error(`Pricing request failed (${response.status})`);
      const data = await response.json();
      setCurrentPricing(data);
    } catch (error) {
      console.error("Failed to load pricing:", error);
      setLoadError(error.message || "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  };

  const handlePricingUpdated = () => {
    loadPricing();
  };

  // Count total models with pricing
  const getModelCount = () => {
    if (!currentPricing) return 0;
    let count = 0;
    for (const provider in currentPricing) {
      count += Object.keys(currentPricing[provider]).length;
    }
    return count;
  };

  // Get providers list
  const getProviders = () => {
    if (!currentPricing) return [];
    return Object.keys(currentPricing).sort();
  };

  const providerRows = getProviders().map((provider) => ({
    provider,
    models: Object.keys(currentPricing[provider] || {}).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Pricing</h1>
          <p>
            The per-token rates used to turn recorded usage into a cost figure. Rates are yours to
            edit; nothing here affects how a request is routed.
          </p>
        </div>
        <Button icon="edit" size="sm" onClick={() => setShowModal(true)}>
          Edit pricing
        </Button>
      </div>

      {loading ? (
        <CardSkeleton />
      ) : loadError ? (
        <Card className="border-danger/35" padding="lg">
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Icon name="error" className="text-[24px] text-danger" />
            <p className="text-[13px] text-text-muted">Could not load pricing — {loadError}</p>
            <p className="text-xs text-text-muted">
              Costs on the Usage page are unavailable until this endpoint answers.
            </p>
            <Button variant="secondary" size="sm" className="mt-1" onClick={loadPricing}>
              Retry
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <ConfigSection
            title="Current pricing table"
            icon="price_change"
            subtitle="Loaded from /api/pricing. Counts are the number of models carrying a rate."
          >
            <ConfigRow
              label="Models with pricing"
              help="Every model id that has at least one rate defined."
              control={<span className="font-mono text-sm font-medium tabular-nums text-text-main">{getModelCount()}</span>}
            />
            <ConfigRow
              label="Providers covered"
              help={providerRows.length > 0 ? providerRows.map((r) => r.provider).join(", ") : "No provider has a rate yet."}
              control={<span className="font-mono text-sm font-medium tabular-nums text-text-main">{providerRows.length}</span>}
            />
            <ConfigRow
              label="Custom overrides"
              help="Overrides you set replace the shipped defaults for that model. Resetting restores the defaults."
              control={
                <Button variant="secondary" size="sm" icon="edit" onClick={() => setShowModal(true)}>
                  Manage rates
                </Button>
              }
            />
          </ConfigSection>

          <Card
            title="Models per provider"
            icon="table_rows"
            subtitle={`${getModelCount()} rated models across ${providerRows.length} providers`}
          >
            {providerRows.length === 0 ? (
              <p className="text-[13px] text-text-muted">
                No rates defined yet. Open Edit pricing to add a rate for a model.
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-[10px] border border-border-subtle">
                <table className="w-full border-collapse text-left" aria-label="Rated models per provider">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border text-[13px] text-text-muted">
                      <th scope="col" className="px-3 py-2 font-medium">Provider</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Rated models</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providerRows.map((row) => (
                      <tr key={row.provider} className="border-b border-border-subtle last:border-b-0">
                        <td className="px-3 py-2 font-mono text-[13px] text-text-main">{row.provider}</td>
                        <td className="px-3 py-2 text-right font-mono text-[13px] tabular-nums text-text-muted">
                          {row.models}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <ConfigSection
            title="How costs are computed"
            icon="receipt_long"
            subtitle="Applied to recorded usage; the router never estimates tokens."
          >
            <ConfigRow
              label="Cost calculation"
              help="Each request's cost uses the token counts it actually reported."
            >
              <code className="mt-2 block overflow-x-auto rounded-md border border-border-subtle bg-surface-2/40 p-2 font-mono text-[11px] text-text-main">
                {COST_FORMULA}
              </code>
            </ConfigRow>
            <ConfigRow
              label="Rate unit"
              help="All rates are dollars per million tokens ($/1M). A rate of 2.50 means $2.50 per 1,000,000 tokens."
            />
            <ConfigRow
              label="Token types"
              help="A model can define a rate per token type; a missing type falls back as described below."
            >
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {TOKEN_TYPES.map((type) => (
                  <div key={type.name} className="min-w-0">
                    <dt className="text-[13px] font-medium text-text-main">{type.name}</dt>
                    <dd className="text-xs text-text-muted">{type.note}</dd>
                  </div>
                ))}
              </dl>
            </ConfigRow>
          </ConfigSection>
        </>
      )}

      {showModal && (
        <PricingModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSave={handlePricingUpdated}
        />
      )}
    </div>
  );
}
