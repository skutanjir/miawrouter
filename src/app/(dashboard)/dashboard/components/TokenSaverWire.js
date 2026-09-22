"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/shared/components";

const MAX_COUNT = 999999;
const STORAGE_KEY = "miawrouter.tokenSaverWire.v1"; // versioned — bump to discard stale sessionStorage payloads
const ACT_MS = 480;
const STAGE_IDS = ["caveman", "ponytail", "rtk", "headroom", "pxpipe", "provider"];
const STAGES = [
  { id: "caveman", step: "01", label: "Caveman", sub: "system inject", icon: "bolt" },
  { id: "ponytail", step: "02", label: "Ponytail", sub: "system inject", icon: "bolt" },
  { id: "rtk", step: "03", label: "RTK", sub: "tool_result", icon: "compress" },
  { id: "headroom", step: "04", label: "Headroom", sub: "proxy", icon: "filter_alt" },
  { id: "pxpipe", step: "05", label: "PXPIPE", sub: "image ctx", icon: "swap_vert" },
];

const fmt = (n) => (n >= MAX_COUNT ? `${MAX_COUNT}+` : String(n));
const fmtBytes = (n) => {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
};
const fmtTk = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const num = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const sstr = (v, max = 120) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";
// Derived percentage — only from the actual bytes/tokens this stage reported.
const pctOf = (before, after) => {
  if (!(before > 0) || after === null || after >= before) return null;
  const p = Math.round((1 - after / before) * 100);
  return p > 0 ? p : null;
};

function timeOf(ts) {
  const ms = Number(ts);
  const d = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// Compute presentation state and metrics for each stage
function getStagePresentation(stageId, st, config) {
  const configured = config?.[stageId];

  switch (stageId) {
    case "caveman":
    case "ponytail": {
      if (configured?.enabled === false) {
        return { status: "off", badge: "off", badgeKind: "off", detail: "Disabled in settings" };
      }
      const m = st[stageId];
      const level = m?.level || configured?.level || "full";
      return {
        status: "active",
        badge: `on · ${level}`,
        badgeKind: "neutral",
        detail: `System injection: ${level}`,
      };
    }
    case "rtk": {
      if (configured?.enabled === false) {
        return { status: "off", badge: "off", badgeKind: "off", detail: "Disabled in settings" };
      }
      const { hits, bytesBefore, bytesAfter } = st.rtk;
      const p = pctOf(bytesBefore, bytesAfter);
      if (bytesBefore !== null && bytesAfter !== null) {
        return {
          status: "active",
          badge: p !== null ? `−${p}%` : `${fmt(hits)} hits`,
          badgeKind: p !== null ? "signal" : "neutral",
          detail: `${fmtBytes(bytesBefore)} → ${fmtBytes(bytesAfter)}${hits > 0 ? ` (${fmt(hits)} hits)` : ""}`,
        };
      }
      if (hits > 0) {
        return {
          status: "active",
          badge: `${fmt(hits)} hits`,
          badgeKind: "neutral",
          detail: `${fmt(hits)} tool results compressed`,
        };
      }
      return {
        status: "idle",
        badge: configured?.enabled ? `on · ${configured.mode || "standard"}` : "—",
        badgeKind: "neutral",
        detail: configured?.mode ? `Mode: ${configured.mode}` : "Ready",
      };
    }
    case "headroom": {
      if (configured?.enabled === false) {
        return { status: "off", badge: "off", badgeKind: "off", detail: "Disabled in settings" };
      }
      const m = st.headroom;
      if (!m) {
        return {
          status: "idle",
          badge: configured?.enabled ? "enabled" : "—",
          badgeKind: "neutral",
          detail: "Budget monitoring active",
        };
      }
      if (!m.applied) {
        return {
          status: "skipped",
          badge: "bypassed",
          badgeKind: "warn",
          detail: m.reason || "Context threshold not reached",
        };
      }
      const parts = [];
      let p = null;
      if (m.tokensBefore !== null && m.tokensAfter !== null) {
        parts.push(`${fmtTk(m.tokensBefore)} → ${fmtTk(m.tokensAfter)} tok`);
        p = pctOf(m.tokensBefore, m.tokensAfter);
      } else if (m.bodyBefore !== null && m.bodyAfter !== null) {
        parts.push(`${fmtBytes(m.bodyBefore)} → ${fmtBytes(m.bodyAfter)}`);
        p = pctOf(m.bodyBefore, m.bodyAfter);
      }
      return {
        status: "active",
        badge: p !== null ? `−${p}%` : "compacted",
        badgeKind: "signal",
        detail: parts.length ? parts.join(" · ") : "Context compacted",
      };
    }
    case "pxpipe": {
      if (configured?.enabled === false) {
        return { status: "off", badge: "off", badgeKind: "off", detail: "Disabled in settings" };
      }
      const m = st.pxpipe;
      if (!m) {
        return {
          status: "idle",
          badge: configured?.enabled ? "enabled" : "—",
          badgeKind: "neutral",
          detail: "Image optimizer ready",
        };
      }
      if (!m.applied) {
        return {
          status: "skipped",
          badge: "bypassed",
          badgeKind: "warn",
          detail: m.reason || "No qualifying media",
        };
      }
      const parts = [];
      if (m.tokensBeforeEst !== null && m.tokensAfterEst !== null) {
        parts.push(`${fmtTk(m.tokensBeforeEst)} → ${fmtTk(m.tokensAfterEst)} tok`);
      }
      if (m.imageCount !== null) {
        parts.push(`${m.imageCount} img`);
      }
      return {
        status: "active",
        badge: m.savedPct !== null ? `est. −${Math.round(m.savedPct)}%` : "applied",
        badgeKind: "signal",
        detail: parts.length ? parts.join(" · ") : "Media tokens reduced",
      };
    }
    default:
      return { status: "unknown", badge: "—", badgeKind: "neutral", detail: "" };
  }
}

function StageInstrumentRow({ stage, presentation, active, kind }) {
  const isOff = presentation.status === "off";
  const tone = presentation.badgeKind === "signal"
    ? "text-signal"
    : presentation.badgeKind === "warn"
      ? "text-warn"
      : "text-muted";

  return (
    <div
      className={`tsw-stage-row grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-2 border-b border-border-subtle py-1.5 last:border-b-0 ${isOff ? "opacity-55" : ""} ${active ? "tsw-stage-act" : ""}`}
      data-kind={kind}
      title={`${stage.label} (${stage.sub}) · ${presentation.badge} · ${presentation.detail}`}
    >
      <span className="font-mono text-[10px] text-muted">{stage.step}</span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-xs font-medium text-ink">{stage.label}</span>
          <span className="truncate text-[11px] text-muted">{stage.sub}</span>
        </div>
        <p className="truncate font-mono text-[11px] text-muted" title={presentation.detail}>
          {presentation.detail}
        </p>
      </div>
      <span className={`font-mono text-[11px] tabular-nums ${tone}`}>{presentation.badge}</span>
    </div>
  );
}

function createInitialState() {
  return {
    req: 0,
    caveman: null,
    ponytail: null,
    rtk: { hits: 0, bytesBefore: null, bytesAfter: null },
    headroom: null,
    pxpipe: null,
    provider: null,
    latest: "",
  };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const n = (v, max, fallback = 0) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? Math.min(Math.floor(x), max) : fallback;
  };
  const b = (v) => {
    if (v === null || v === undefined) return null;
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? Math.min(x, Number.MAX_SAFE_INTEGER) : null;
  };
  const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
  const lvl = (v) => {
    const o = obj(v);
    const level = sstr(o.level, 12);
    return level ? { level } : null;
  };
  const rtk = obj(raw.rtk);
  const hasHeadroom = raw.headroom && typeof raw.headroom === "object" && !Array.isArray(raw.headroom);
  const hasPxpipe = raw.pxpipe && typeof raw.pxpipe === "object" && !Array.isArray(raw.pxpipe);
  const headroom = obj(raw.headroom);
  const pxpipe = obj(raw.pxpipe);
  const provider = obj(raw.provider);
  return {
    req: n(raw.req, MAX_COUNT),
    caveman: lvl(raw.caveman),
    ponytail: lvl(raw.ponytail),
    rtk: {
      hits: n(rtk.hits, MAX_COUNT),
      bytesBefore: b(rtk.bytesBefore),
      bytesAfter: b(rtk.bytesAfter),
    },
    headroom: hasHeadroom ? {
      applied: headroom.applied === true,
      bodyBefore: b(headroom.bodyBefore),
      bodyAfter: b(headroom.bodyAfter),
      tokensBefore: b(headroom.tokensBefore),
      tokensAfter: b(headroom.tokensAfter),
      reason: sstr(headroom.reason, 120),
    } : null,
    pxpipe: hasPxpipe ? {
      applied: pxpipe.applied === true,
      tokensBeforeEst: b(pxpipe.tokensBeforeEst),
      tokensAfterEst: b(pxpipe.tokensAfterEst),
      savedPct: b(pxpipe.savedPct),
      imageCount: b(pxpipe.imageCount),
      reason: sstr(pxpipe.reason, 120),
    } : null,
    provider:
      provider.provider || provider.model
        ? { provider: sstr(provider.provider, 40), model: sstr(provider.model, 60) }
        : null,
    latest: typeof raw.latest === "string" ? raw.latest.slice(0, 300) : "",
  };
}

function loadState() {
  if (typeof window === "undefined") return null;
  try {
    return normalizeState(JSON.parse(sessionStorage.getItem(STORAGE_KEY)));
  } catch {
    return null;
  }
}

export default function TokenSaverWire() {
  const [state, setState] = useState(createInitialState);
  const [config, setConfig] = useState(null);
  const [conn, setConn] = useState("connecting"); // connecting | live | disconnected
  const [act, setAct] = useState(null); // transient activity: { id, stage, note, kind }
  const actTimer = useRef(null);
  const actIdRef = useRef(0);
  const actQueue = useRef([]);
  const hydratedRef = useRef(false);

  // Declared before the hydrate effect: on mount the persist effect runs while
  // hydratedRef is false, so the empty initial state can never overwrite
  // stored data before hydration applies it.
  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable/quota exceeded — persistence is best-effort
    }
  }, [state]);

  useEffect(() => {
    const stored = loadState();
    if (stored) setState(stored);
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((settings) => {
        if (cancelled || !settings) return;
        setConfig({
          caveman: { enabled: settings.cavemanEnabled === true, level: sstr(settings.cavemanLevel, 12) || "full" },
          ponytail: { enabled: settings.ponytailEnabled === true, level: sstr(settings.ponytailLevel, 12) || "full" },
          rtk: { enabled: settings.rtkEnabled !== false, mode: sstr(settings.rtkMode, 12) || "standard" },
          headroom: { enabled: settings.headroomEnabled === true },
          pxpipe: { enabled: settings.pxpipeEnabled === true },
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const triggerAct = (stage, note, kind) => {
    actQueue.current.push({ id: ++actIdRef.current, stage, note, kind });
    if (actTimer.current) return;

    const playNext = () => {
      const next = actQueue.current.shift();
      if (!next) {
        setAct(null);
        actTimer.current = null;
        return;
      }
      setAct(next);
      actTimer.current = setTimeout(() => {
        actTimer.current = null;
        playNext();
      }, ACT_MS);
    };
    playNext();
  };

  useEffect(() => {
    const es = new EventSource("/api/events?type=saver");
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
      if (!msg || msg.type !== "saver" || !msg.event || typeof msg.event !== "object") return;
      const ev = msg.event;
      if (!STAGE_IDS.includes(ev.stage)) return; // unknown stages are ignored
      const t = timeOf(ev.ts || Date.now());
      const line = (parts) => parts.filter(Boolean).join(" · ");
      const s = ev.stage;

      if (s === "caveman" || s === "ponytail") {
        const level = sstr(ev.level, 12);
        const label = s === "caveman" ? "Caveman" : "Ponytail";
        setState((prev) => ({
          ...prev,
          [s]: { level },
          latest: line([`${t} ${label} on`, level]),
        }));
        triggerAct(s, level ? `on · ${level}` : "on", "ok");
      } else if (s === "rtk") {
        const before = num(ev.bytesBefore);
        const after = num(ev.bytesAfter);
        const hits = num(ev.hits);
        const p = before !== null && after !== null ? pctOf(before, after) : null;
        setState((prev) => ({
          ...prev,
          rtk: {
            hits: Math.min(prev.rtk.hits + (hits || 0), MAX_COUNT),
            bytesBefore: before !== null ? before : prev.rtk.bytesBefore,
            bytesAfter: after !== null ? after : prev.rtk.bytesAfter,
          },
          latest: line([
            `${t} RTK`,
            hits ? `${hits} hits` : "",
            before !== null && after !== null ? `${fmtBytes(before)} → ${fmtBytes(after)}` : "",
            p !== null ? `−${p}%` : "",
          ]),
        }));
        triggerAct("rtk", p !== null ? `−${p}%` : "applied", "ok");
      } else if (s === "headroom") {
        const applied = ev.applied === true;
        const meta = {
          applied,
          bodyBefore: num(ev.bodyBefore),
          bodyAfter: num(ev.bodyAfter),
          tokensBefore: num(ev.tokensBefore),
          tokensAfter: num(ev.tokensAfter),
          reason: sstr(ev.reason, 120),
        };
        setState((prev) => ({
          ...prev,
          headroom: meta,
          latest: line([`${t} Headroom`, applied ? "applied" : meta.reason ? `skipped · ${meta.reason}` : "skipped"]),
        }));
        triggerAct("headroom", applied ? "applied" : meta.reason || "skipped", applied ? "ok" : "skip");
      } else if (s === "pxpipe") {
        const applied = ev.applied === true;
        const before = num(ev.tokensBeforeEst);
        const after = num(ev.tokensAfterEst);
        let pct = num(ev.savedPct);
        if (pct === null) pct = pctOf(before, after); // derived — still an estimate
        const meta = {
          applied,
          tokensBeforeEst: before,
          tokensAfterEst: after,
          savedPct: pct !== null ? Math.min(pct, 100) : null,
          imageCount: num(ev.imageCount),
          reason: sstr(ev.reason, 120),
        };
        const note = applied ? (pct !== null ? `est. −${Math.round(meta.savedPct)}%` : "applied") : meta.reason || "skipped";
        setState((prev) => ({
          ...prev,
          pxpipe: meta,
          latest: line([`${t} PXPIPE`, note]),
        }));
        triggerAct("pxpipe", note, applied ? "ok" : "skip");
      } else if (s === "provider") {
        const provider = sstr(ev.provider, 40);
        const model = sstr(ev.model, 60);
        setState((prev) => ({
          ...prev,
          req: Math.min(prev.req + 1, MAX_COUNT),
          provider: { provider, model },
          latest: line([`${t} → dispatch`, provider, model]),
        }));
        triggerAct("provider", "dispatch", "ok");
      }
    };

    return () => {
      es.close();
      clearTimeout(actTimer.current);
      actQueue.current = [];
    };
  }, []);

  const connMeta = {
    connecting: { text: "Connecting…", cls: "text-warn", dot: "bg-warn" },
    live: { text: "Live", cls: "text-ink", dot: "bg-signal" },
    disconnected: { text: "Disconnected — reconnecting", cls: "text-fail", dot: "bg-fail" },
  }[conn];

  const providerStat =
    state.provider && state.provider.provider
      ? `${state.provider.provider}${state.provider.model ? `/${state.provider.model}` : ""}`
      : "—";

  return (
    <Card
      title="Token saver wire"
      subtitle="Caveman, Ponytail, RTK, Headroom, PXPIPE"
      padding="sm"
      elev
      className="panel-lift flex h-full flex-col self-stretch"
    >
      <style>{`.tsw-stage-act{background:color-mix(in srgb,var(--color-signal) 8%,transparent)}
@media (prefers-reduced-motion: reduce){.tsw-stage-row{transition:none!important}}`}</style>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="min-w-0 truncate font-mono text-xs text-ink" title={providerStat}>
            {fmt(state.req)} {state.req === 1 ? "dispatch" : "dispatches"}
            <span className="text-muted"> · {providerStat}</span>
          </p>
          <span className={`inline-flex items-center gap-1.5 text-xs ${connMeta.cls}`}>
            <span className={`size-1.5 rounded-full ${connMeta.dot}`} aria-hidden="true" />
            <span className="sr-only">Token-saver stream: </span>
            {connMeta.text}
          </span>
        </div>

        <div role="group" aria-label="Token-saver stages">
          {STAGES.map((stage) => {
            const active = !!act && act.stage === stage.id;
            const presentation = getStagePresentation(stage.id, state, config);
            return (
              <StageInstrumentRow
                key={stage.id}
                stage={stage}
                presentation={presentation}
                active={active}
                kind={active ? act.kind : ""}
              />
            );
          })}
        </div>

        <p className="text-[11px] text-muted">
          RTK and Headroom show reported byte deltas. PXPIPE is an estimate.
        </p>
        <p
          role="status"
          aria-live="polite"
          className="truncate border-t border-border-subtle pt-2 font-mono text-[11px] text-muted"
          title={state.latest || act?.note}
        >
          {act?.note || state.latest || "No saver events yet. Send a request to see which stage compressed it."}
        </p>
      </div>
    </Card>
  );
}
