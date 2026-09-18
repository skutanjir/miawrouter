"use client";

import { useState } from "react";
import { Card, Button, Badge } from "@/shared/components";
import CacheStatsPanel from "../components/CacheStatsPanel";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

export default function CachePageClient() {
  const [period, setPeriod] = useState("7d");
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [result, setResult] = useState(null); // { ok, cleared } | { error }

  const clearCache = async () => {
    setClearing(true);
    setResult(null);
    try {
      const res = await fetch("/api/cache/clear", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Clear failed (${res.status})`);
      setResult({ ok: true, cleared: body.cleared || [] });
    } catch (error) {
      setResult({ ok: false, error: error.message || "Clear failed" });
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-6 px-1 sm:px-0">
      <div className="flex flex-col gap-3 border-b border-border-subtle pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-main sm:text-2xl">
            Cache Control & Telemetry
          </h1>
          <p className="mt-0.5 text-xs text-text-muted sm:text-sm">
            Local L1/L2 response cache, provider L0 prompt cache, and L3 content-address dedup.
          </p>
        </div>
        {!confirming ? (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)} icon="delete">
            Clear cache
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="warning" size="sm">Clear all local cache layers?</Badge>
            <Button variant="danger" size="sm" onClick={clearCache} disabled={clearing}>
              {clearing ? "Clearing…" : "Confirm"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} disabled={clearing}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {result && (
        <Card
          padding="sm"
          className={result.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-fail/30 bg-fail/5"}
        >
          <p className={`text-xs font-medium ${result.ok ? "text-emerald-600 dark:text-emerald-400" : "text-fail"}`}>
            {result.ok
              ? `Cleared: ${result.cleared.join(", ")}`
              : result.error}
          </p>
        </Card>
      )}

      <CacheStatsPanel period={period} setPeriod={setPeriod} />

      <Card padding="sm" className="border-border-subtle bg-surface-2/40">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[16px] text-muted mt-0.5">info</span>
          <div className="text-xs text-muted space-y-1">
            <p>
              <strong className="text-ink font-medium">L0</strong> is provider-confirmed prompt-cache usage (token
              savings at the provider). <strong className="text-ink font-medium">L1/L2</strong> are local
              response-cache hits. <strong className="text-ink font-medium">L3</strong> dedup is activity, not a
              provider cache hit.
            </p>
            <p>
              Clearing resets the local L1/L2/L3 layers. Metrics shown here come from recorded events only —
              no values are estimated.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
