"use client";

import { useState } from "react";
import { Card, Button, Badge } from "@/shared/components";
import CacheStatsPanel from "../components/CacheStatsPanel";

import { Icon } from "@/shared/components/Icon";

const LAYERS = [
  { id: "L0", icon: "cloud", name: "Provider prompt cache", note: "Reported by the provider — savings happen upstream, not on this machine." },
  { id: "L1", icon: "bolt", name: "Local exact-match cache", note: "In-memory, TTL-bounded. Only deterministic, non-streaming requests are stored." },
  { id: "L2", icon: "psychology", name: "Local semantic cache", note: "Reuses responses for similar requests via a local embedding model." },
  { id: "L3", icon: "compress", name: "Content dedup", note: "Rewrites repeated large blocks in the last message as references. Activity, not a cache hit." },
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
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Cache</h1>
          <p>
            What the router reused instead of re-asking a provider. Metrics come from recorded
            events only — nothing on this page is estimated.
          </p>
        </div>
        {!confirming ? (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)} icon="delete">
            Clear cache
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-text-muted">Clear all local layers?</span>
            <Button variant="danger" size="sm" onClick={clearCache} loading={clearing}>
              Confirm clear
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={clearing}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {result && (
        <Card padding="sm" className={result.ok ? "border-success/35" : "border-danger/35"}>
          <div className="flex items-start gap-2">
            <Icon
              name={result.ok ? "success" : "error"}
              className={`mt-0.5 text-[16px] ${result.ok ? "text-success" : "text-danger"}`}
            />
            <p className={`text-[13px] ${result.ok ? "text-success" : "text-danger"}`}>
              {result.ok ? `Cleared: ${result.cleared.join(", ") || "nothing cached"}` : result.error}
            </p>
          </div>
        </Card>
      )}

      <CacheStatsPanel period={period} setPeriod={setPeriod} />

      <Card title="Cache layers" icon="layers" subtitle="Four separate mechanisms feed the numbers above.">
        <dl className="grid gap-3.5 sm:grid-cols-2">
          {LAYERS.map((layer) => (
            <div key={layer.id} className="flex items-start gap-3 min-w-0 rounded-xl border border-border-subtle bg-surface-2/50 p-3.5">
              <div className="icon-box icon-box-sm text-primary mt-0.5">
                <Icon name={layer.icon} weight="duotone" className="text-[16px]" />
              </div>
              <div className="min-w-0">
                <dt className="flex items-center gap-2">
                  <code className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-bold text-primary">{layer.id}</code>
                  <span className="text-[13.5px] font-semibold text-text-main">{layer.name}</span>
                </dt>
                <dd className="mt-1 text-[12.5px] leading-relaxed text-text-muted">{layer.note}</dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
          <Badge variant="default" size="sm">L0 provider</Badge>
          <Badge variant="primary" size="sm">L1/L2 local</Badge>
          <Badge variant="default" size="sm">L3 dedup</Badge>
          <p className="text-[13px] text-text-muted">
            Clearing resets the local L1/L2/L3 layers only; a provider&apos;s own prompt cache is not
            under this router&apos;s control.
          </p>
        </div>
      </Card>
    </div>
  );
}
