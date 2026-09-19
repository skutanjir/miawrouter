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
  const badgeClass = !status.enabled
    ? "bg-chassis/60 text-muted/60 border-border-subtle/50 font-normal"
    : status.hasHits
      ? "bg-signal/10 text-signal border-signal/25 font-semibold"
      : "bg-surface text-ink/80 border-border-subtle font-medium";

  return (
    <div
      className={`cw-layer-card flex flex-col justify-between rounded-[var(--radius-brand)] border bg-surface p-2.5 transition-all duration-150 ${isOff ? "opacity-55" : ""} ${active ? "cw-layer-act" : "border-border-subtle"}`}
      data-kind={active ? kind : ""}
      title={`${layer.name} · ${layer.role} · ${status.statusLabel}${status.subDetail ? ` · ${status.subDetail}` : ""}`}
    >
      <div className="flex items-center justify-between gap-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-mono text-xs font-bold text-ink shrink-0">{layer.id}</span>
          <span className="text-xs font-semibold text-ink truncate">{layer.name}</span>
          {active && (
            <span className="size-1.5 rounded-full bg-signal animate-pulse shrink-0" aria-hidden="true" />
          )}
        </div>
        <span
          className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-mono tabular-nums leading-tight ${badgeClass}`}
          title={status.reason ? `Disabled: ${status.reason}` : status.statusLabel}
        >
          {status.badgeText || status.statusLabel}
        </span>
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-1 text-[10px] min-w-0">
        <span className="text-muted truncate" title={status.reason ? `Disabled (${status.reason})` : layer.role}>
          {status.reason ? `Disabled (${status.reason})` : layer.role}
        </span>
        {status.subDetail ? (
          <span className="font-mono tabular-nums text-muted shrink-0">{status.subDetail}</span>
        ) : status.notice ? (
          <span className="text-muted/70 shrink-0">{status.notice}</span>
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
      subtitle="Multi-layer cache performance and prefix interlock telemetry"
      padding="sm"
      className="flex h-full flex-col self-stretch"
    >
      <style>{`.cw-layer-card{transition:border-color .15s ease,background-color .15s ease}
.cw-layer-act{border-color:color-mix(in srgb,var(--cw-glow,var(--color-signal)) 45%,var(--color-border-subtle))!important;background-color:color-mix(in srgb,var(--cw-glow,var(--color-signal)) 8%,var(--color-surface))!important;box-shadow:0 0 0 1px color-mix(in srgb,var(--cw-glow,var(--color-signal)) 20%,transparent)}
.cw-layer-act[data-kind="hit"]{--cw-glow:var(--color-signal)}
.cw-layer-act[data-kind="activity"]{--cw-glow:var(--color-warn)}
.cw-layer-act[data-kind="dedup"]{--cw-glow:var(--color-ink)}
.cw-log-entry{border-radius:3px}
@media (prefers-reduced-motion: reduce){.cw-layer-card,.cw-layer-act,.cw-log-entry{transition:none!important;animation:none!important}}`}</style>
      <div
        className="flex flex-col gap-2.5 rounded-[var(--radius-brand)] border p-3 bg-chassis"
        style={{ borderColor: "var(--color-rule)", flex: 1 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted">
            Cache telemetry ·{" "}
            <span className="font-mono tabular-nums font-semibold text-ink">{fmt(state.events)}</span> {state.events === 1 ? "event" : "events"}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${connMeta.cls}`}>
            <span className={`size-2 rounded-full ${connMeta.dot}`} aria-hidden="true" />
            <span className="sr-only">Cache stream: </span>
            {connMeta.text}
          </span>
        </div>

        {/* Cache performance metric tiles */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex flex-col rounded-[var(--radius-brand)] border border-border-subtle bg-surface px-2.5 py-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
              Events
            </span>
            <span className="font-mono tabular-nums text-sm font-semibold text-ink leading-tight mt-0.5">
              {fmt(state.events)} <span className="text-[10px] font-normal text-muted">{state.events === 1 ? "event" : "events"}</span>
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-brand)] border border-border-subtle bg-surface px-2.5 py-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
              Cache hits
            </span>
            <span
              className={`font-mono tabular-nums text-sm font-semibold leading-tight mt-0.5 ${totalHits > 0 ? "text-signal" : "text-ink"}`}
            >
              {fmt(totalHits)} <span className="text-[10px] font-normal text-muted">hits</span>
            </span>
          </div>

          <div className="flex flex-col rounded-[var(--radius-brand)] border border-border-subtle bg-surface px-2.5 py-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
              Hit rate
            </span>
            <span
              className={`font-mono tabular-nums text-sm font-semibold leading-tight mt-0.5 ${overallHitRate !== null && overallHitRate > 0 ? "text-signal" : "text-ink"}`}
            >
              {overallHitRate !== null ? `${overallHitRate}%` : "—"}{" "}
              <span className="text-[10px] font-normal text-muted">
                {totalLookups > 0 ? `(${fmt(totalHits)}/${fmt(totalLookups)})` : "no data"}
              </span>
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 flex flex-col rounded-[var(--radius-brand)] border border-border-subtle bg-surface px-2.5 py-1.5 min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted truncate">
              Dedup savings
            </span>
            <span
              className="font-mono tabular-nums text-xs font-semibold text-ink leading-tight mt-1 truncate"
              title={`${fmt(state.savings.refs)} refs · ${fmtBytes(state.savings.bytes)} saved`}
            >
              {fmt(state.savings.refs)} refs · {fmtBytes(state.savings.bytes)}
            </span>
          </div>
        </div>

        {/* L0-L3 Cache layers in responsive grid */}
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

        {/* Prefix interlock section */}
        <div
          className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-2.5"
          style={{ borderColor: "var(--color-rule)" }}
        >
          <span className="text-xs font-semibold text-ink">Prefix interlock</span>
          <span
            className="font-mono tabular-nums text-[11px] text-muted"
            title="Probes where a protected-prefix edit was restored before dispatch"
          >
            restored <span className="text-warn font-medium">{fmt(state.interlock.restored)}</span>
          </span>
          <span
            className="font-mono tabular-nums text-[11px] text-muted"
            title="Probes that reached a stable prefix"
          >
            stable <span className="text-ink font-medium">{fmt(state.interlock.stable)}</span>
          </span>
          <span
            className="font-mono tabular-nums text-[11px] text-muted"
            title="Latest observed breakpoint count inserted for a stable prefix"
          >
            breakpoints <span className="text-ink font-medium">{state.interlock.breakpoints === null ? "—" : String(state.interlock.breakpoints)}</span>
          </span>
          <span className="text-[10px] text-muted ml-auto" style={{ opacity: 0.85 }}>
            Raw telemetry · unbilled
          </span>
        </div>

        {/* Single live region event log */}
        <p
          key={state.latest}
          role="status"
          aria-live="polite"
          className="cw-log-entry truncate border-t pt-2 font-mono text-[11px] text-muted"
          style={{ borderColor: "var(--color-rule)" }}
          title={state.latest}
        >
          {state.latest || "Waiting for cache events — run a request to see activity."}
        </p>
      </div>
    </Card>
  );
}
