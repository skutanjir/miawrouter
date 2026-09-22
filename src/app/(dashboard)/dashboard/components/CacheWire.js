"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/shared/components";
import {
  MAX_COUNT,
  STORAGE_KEY,
  ACT_MS,
  LAYERS,
  fmt,
  fmtBytes,
  timeOf,
  computeEffectiveCacheLayers,
  createInitialState,
  loadState,
  getLayerStatus,
  parseCacheWireEvent,
} from "./cacheWireUtils.js";

function LayerCard({ layer, status, active, kind }) {
  const isOff = !status.enabled;
  return (
    <div
      className={`cw-layer-card flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-brand)] border bg-surface px-2.5 py-2 ${isOff ? "opacity-60" : ""} ${active ? "cw-layer-act" : "border-border-subtle"}`}
      data-kind={active ? kind : ""}
      title={`${layer.name} · ${layer.role} · ${status.statusLabel}${status.subDetail ? ` · ${status.subDetail}` : ""}`}
    >
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-muted">{layer.id}</span>
          <span className="truncate text-xs font-medium text-ink">{layer.name}</span>
        </div>
        <span className={`shrink-0 font-mono text-[10px] ${isOff ? "text-muted" : status.hasHits ? "text-signal" : "text-ink"}`}>
          {status.badgeText || status.statusLabel}
        </span>
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-2 text-[11px]">
        <span className="truncate text-muted" title={status.reason || layer.role}>
          {status.reason ? `Off · ${status.reason}` : layer.role}
        </span>
        {status.subDetail ? (
          <span className="shrink-0 font-mono tabular-nums text-ink">{status.subDetail}</span>
        ) : status.notice ? (
          <span className="shrink-0 text-muted">{status.notice}</span>
        ) : null}
      </div>
    </div>
  );
}

export default function CacheWire() {
  const [state, setState] = useState(createInitialState);
  const [config, setConfig] = useState(null);
  const [conn, setConn] = useState("connecting"); // connecting | live | disconnected
  const [act, setAct] = useState(null); // transient activity: { id, layer, kind, label }
  const actTimer = useRef(null);
  const actIdRef = useRef(0);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable/quota exceeded — persistence is best-effort
    }
  }, [state]);

  useEffect(() => {
    let frameId;
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      frameId = window.requestAnimationFrame(() => {
        const stored = loadState();
        if (stored) setState(stored);
        hydratedRef.current = true;
      });
    } else {
      hydratedRef.current = true;
    }
    return () => {
      if (frameId && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => {
        if (cancelled) return;
        if (!settings) {
          setConfig(computeEffectiveCacheLayers(null, { error: true }));
          return;
        }
        setConfig(computeEffectiveCacheLayers(settings));
      })
      .catch(() => {
        if (!cancelled) setConfig(computeEffectiveCacheLayers(null, { error: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerAct = (layer, kind, label) => {
    clearTimeout(actTimer.current);
    const id = ++actIdRef.current;
    setAct({ id, layer, kind, label });
    actTimer.current = setTimeout(() => {
      setAct((prev) => (prev && prev.id === id ? null : prev));
    }, ACT_MS);
  };

  useEffect(() => {
    const es = new EventSource("/api/events?type=cache");
    es.onopen = () => setConn("live");
    es.onerror = () => setConn("disconnected");

    es.onmessage = (e) => {
      setConn("live");
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (!msg || msg.type !== "cache" || !msg.event || typeof msg.event !== "object") return;
      const ev = msg.event;
      const parsed = parseCacheWireEvent(ev);
      const t = timeOf(ev.ts || Date.now());
      const who = ev.provider ? (ev.model ? `${ev.provider}/${ev.model}` : ev.provider) : "";
      const line = (parts) => parts.filter(Boolean).join(" · ");
      const recordEvent = ({ layer, hit, miss, log }) =>
        setState((prev) => {
          const next = {
            ...prev,
            events: Math.min(prev.events + 1, MAX_COUNT),
            latest: log,
          };
          if (layer && (hit || miss)) {
            const currentLookups = prev.lookups?.[layer] || 0;
            next.lookups = {
              ...prev.lookups,
              [layer]: Math.min(currentLookups + 1, MAX_COUNT),
            };
            if (hit) {
              const currentHits = prev.hits?.[layer] || 0;
              next.hits = {
                ...prev.hits,
                [layer]: Math.min(currentHits + 1, MAX_COUNT),
              };
            } else if (miss) {
              const currentMisses = prev.misses?.[layer] || 0;
              next.misses = {
                ...prev.misses,
                [layer]: Math.min(currentMisses + 1, MAX_COUNT),
              };
            }
          }
          return next;
        });

      if (parsed?.layer) {
        triggerAct(parsed.layer, parsed.kind, parsed.label);
      }

      if (ev.type === "cache_probe") {
        const parts = [`${t} L0 probe`, who];
        if (ev.stable) parts.push(`${ev.breakpoints ?? 0} breakpoints`);
        else if (ev.turns !== undefined) parts.push(`${ev.turns}/2 turns to stable`);
        if (ev.restored) parts.push("prefix restored");
        setState((prev) => ({
          ...prev,
          events: Math.min(prev.events + 1, MAX_COUNT),
          interlock: {
            restored: Math.min(prev.interlock.restored + (ev.restored ? 1 : 0), MAX_COUNT),
            stable: Math.min(prev.interlock.stable + (ev.stable ? 1 : 0), MAX_COUNT),
            breakpoints:
              Number.isFinite(ev.breakpoints) && ev.breakpoints >= 0
                ? ev.breakpoints
                : prev.interlock.breakpoints,
          },
          latest: line(parts),
        }));
      } else if (ev.type === "cache_usage") {
        const isHit = Number(ev.cacheRead) > 0;
        if (isHit) {
          recordEvent({
            layer: "L0",
            hit: true,
            log: line([`${t} L0 hit`, who, `${ev.cacheRead} read`]),
          });
        } else {
          recordEvent({
            layer: "L0",
            miss: true,
            log: line([`${t} L0 miss`, who, `${ev.cacheCreation ?? 0} written`]),
          });
        }
      } else if (ev.type === "cache_l1") {
        if (ev.action === "hit") {
          recordEvent({ layer: "L1", hit: true, log: line([`${t} L1 hit`, who]) });
        } else if (ev.action === "miss") {
          recordEvent({ layer: "L1", miss: true, log: line([`${t} L1 miss`, who]) });
        } else {
          bump(line([`${t} L1 ${ev.action ?? "event"}`, who]));
        }
      } else if (ev.type === "cache_l2") {
        if (ev.action === "hit") {
          const sim =
            parsed?.validSim !== null && parsed?.validSim !== undefined
              ? `${(parsed.validSim * 100).toFixed(1)}% sim`
              : null;
          recordEvent({ layer: "L2", hit: true, log: line([`${t} L2 hit`, who, sim]) });
        } else if (ev.action === "miss") {
          recordEvent({ layer: "L2", miss: true, log: line([`${t} L2 miss`, who]) });
        } else {
          bump(line([`${t} L2 ${ev.action ?? "event"}`, who]));
        }
      } else if (ev.type === "cache_l3") {
        const refs = parsed ? parsed.refs : Math.max(0, Number(ev.refs) || 0);
        const bytes = parsed ? parsed.bytesSaved : Math.max(0, Number(ev.bytesSaved) || 0);
        setState((prev) => ({
          ...prev,
          events: Math.min(prev.events + 1, MAX_COUNT),
          savings: {
            refs: Math.min(prev.savings.refs + refs, MAX_COUNT),
            bytes: Math.min(prev.savings.bytes + bytes, Number.MAX_SAFE_INTEGER),
          },
          latest: line([`${t} L3 dedup`, who, `${refs} refs`, fmtBytes(bytes)]),
        }));
      } else {
        bump(line([`${t} cache ${ev.type}`, who]));
      }
    };

    return () => {
      es.close();
      clearTimeout(actTimer.current);
    };
  }, []);

  const connMeta = {
    connecting: { text: "Connecting…", cls: "text-warn", dot: "bg-warn" },
    live: { text: "Live", cls: "text-ink", dot: "bg-signal" },
    disconnected: { text: "Disconnected — reconnecting", cls: "text-fail", dot: "bg-fail" },
  }[conn];

  const totalHits = (state.hits?.L0 || 0) + (state.hits?.L1 || 0) + (state.hits?.L2 || 0);
  const totalMisses = (state.misses?.L0 || 0) + (state.misses?.L1 || 0) + (state.misses?.L2 || 0);
  const totalLookups =
    (state.lookups?.L0 || 0) + (state.lookups?.L1 || 0) + (state.lookups?.L2 || 0) ||
    totalHits + totalMisses;
  const overallHitRate = totalLookups > 0 ? Math.round((totalHits / totalLookups) * 100) : null;

  return (
    <Card
      title="Cache activity"
      subtitle="L0 prompt, L1 exact, L2 semantic, L3 dedup"
      padding="sm"
      elev
      className="panel-lift flex h-full flex-col self-stretch"
    >
      <style>{`.cw-layer-card{transition:border-color .15s ease,background-color .15s ease}
.cw-layer-act{border-color:color-mix(in srgb,var(--cw-glow,var(--color-signal)) 45%,var(--color-border-subtle))!important;background-color:color-mix(in srgb,var(--cw-glow,var(--color-signal)) 8%,var(--color-surface))!important}
.cw-layer-act[data-kind="hit"]{--cw-glow:var(--color-signal)}
.cw-layer-act[data-kind="activity"]{--cw-glow:var(--color-warn)}
.cw-layer-act[data-kind="dedup"]{--cw-glow:var(--color-ink)}
@media (prefers-reduced-motion: reduce){.cw-layer-card,.cw-layer-act{transition:none!important}}`}</style>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-xs tabular-nums text-ink">
            {overallHitRate !== null ? `${overallHitRate}% hit` : "No lookups yet"}
            <span className="text-muted"> · {fmt(totalHits)} hit · {fmt(totalMisses)} miss · {fmt(state.events)} events</span>
          </p>
          <span className={`inline-flex items-center gap-1.5 text-xs ${connMeta.cls}`}>
            <span className={`size-1.5 rounded-full ${connMeta.dot}`} aria-hidden="true" />
            <span className="sr-only">Cache stream: </span>
            {connMeta.text}
          </span>
        </div>

        <div
          role="group"
          aria-label="Cache layers: L0 Prompt, L1 Exact, L2 Semantic, L3 Dedup"
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {LAYERS.map((layer) => {
            const active = !!act && act.layer === layer.id;
            const status = getLayerStatus(layer.id, state, config);
            return (
              <LayerCard
                key={layer.id}
                layer={layer}
                status={status}
                active={active}
                kind={active ? act.kind : ""}
              />
            );
          })}
        </div>

        <dl className="grid grid-cols-3 gap-2 border-t border-border-subtle pt-2.5 text-[11px]">
          <div>
            <dt className="text-muted">Restored</dt>
            <dd className="font-mono tabular-nums text-ink">{fmt(state.interlock.restored)}</dd>
          </div>
          <div>
            <dt className="text-muted">Stable</dt>
            <dd className="font-mono tabular-nums text-ink">{fmt(state.interlock.stable)}</dd>
          </div>
          <div>
            <dt className="text-muted">Breakpoints</dt>
            <dd className="font-mono tabular-nums text-ink">{state.interlock.breakpoints === null ? "—" : String(state.interlock.breakpoints)}</dd>
          </div>
        </dl>
        <p className="text-[11px] text-muted">
          Dedup {fmt(state.savings.refs)} refs · {fmtBytes(state.savings.bytes)} saved. Unbilled telemetry.
        </p>

        <p
          key={state.latest}
          role="status"
          aria-live="polite"
          className="truncate border-t border-border-subtle pt-2 font-mono text-[11px] text-muted"
          title={state.latest}
        >
          {state.latest || "No cache events yet. Send a request to see hits, misses, and dedup."}
        </p>
      </div>
    </Card>
  );
}
