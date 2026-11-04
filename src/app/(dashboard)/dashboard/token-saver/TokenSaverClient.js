"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import { Card, Button, Input, Modal, Toggle, ConfirmModal, Select } from "@/shared/components";
import { getCurrentLocale, onLocaleChange, translate } from "@/i18n/runtime";
import { waitForHeadroomInstall } from "@/shared/utils/headroomInstall";
import {
  WENYAN_LOCALES,
  CAVEMAN_LEVELS,
  PONYTAIL_LEVELS,
} from "../endpoint/endpointConstants";
import {
  getTokenSaverGroups,
  TOKEN_SAVER_TIERS,
  TOKEN_SAVER_GENERAL_SETTINGS,
} from "@/lib/catalog/tokenSaverCatalog";
import { ConfigSection, ConfigRow } from "../components/ConfigSection";
import { Icon } from "@/shared/components/Icon";

const RESPONSE_FOCUS_OPTIONS = [
  { value: "balanced", label: "Balanced" },
  { value: "code", label: "Code-first" },
  { value: "explanation", label: "Explanation-first" },
];

export default function TokenSaverClient() {
  const [rtkEnabled, setRtkEnabledState] = useState(true);
  const [rtkMode, setRtkMode] = useState("standard");
  const [autoTriggerTokens, setAutoTriggerTokens] = useState("4000");
  const [responseFocus, setResponseFocus] = useState("balanced");
  const [headroomEnabled, setHeadroomEnabled] = useState(false);
  const [headroomUrl, setHeadroomUrl] = useState("http://localhost:8787");
  const [headroomStatus, setHeadroomStatus] = useState({
    installed: false,
    running: false,
    python: null,
    loading: true,
  });
  const [showHeadroomInstallModal, setShowHeadroomInstallModal] =
    useState(false);
  const [headroomActionLoading, setHeadroomActionLoading] = useState(false);
  const [headroomActionError, setHeadroomActionError] = useState("");
  const [headroomInstaller, setHeadroomInstaller] = useState("auto");
  const [headroomExtras, setHeadroomExtras] = useState({
    version: null,
    extras: { code: false, ml: false },
    available: ["code", "ml"],
    loading: false,
  });
  const [pendingExtras, setPendingExtras] = useState([]);
  const [extrasActionLoading, setExtrasActionLoading] = useState(false);
  const [extrasActionError, setExtrasActionError] = useState("");
  const [removingExtra, setRemovingExtra] = useState(null);
  const [installLog, setInstallLog] = useState("");
  const [extrasConfirm, setExtrasConfirm] = useState(null);
  const [codeAware, setCodeAware] = useState(false);
  const [kompress, setKompress] = useState(true);
  const [restartingProxy, setRestartingProxy] = useState(false);
  const logPollRef = useRef(null);
  const [cavemanEnabled, setCavemanEnabled] = useState(false);
  const [cavemanLevel, setCavemanLevel] = useState("full");
  const [ponytailEnabled, setPonytailEnabled] = useState(false);
  const [ponytailLevel, setPonytailLevel] = useState("full");
  const [pxpipeEnabled, setPxpipeEnabled] = useState(false);
  const [pxpipeMinChars, setPxpipeMinChars] = useState(25000);
  const [pxpipeStatus, setPxpipeStatus] = useState({
    installed: false,
    installing: false,
    running: false,
    version: null,
    loading: true,
  });
  const [pxpipeHealth, setPxpipeHealth] = useState(null);
  const [showPxpipeModal, setShowPxpipeModal] = useState(false);
  const [pxpipeActionLoading, setPxpipeActionLoading] = useState(false);
  const [pxpipeActionError, setPxpipeActionError] = useState("");
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    setLocale(getCurrentLocale());
    return onLocaleChange(() => setLocale(getCurrentLocale()));
  }, []);

  const isWenyanLocale = WENYAN_LOCALES.includes(locale);
  const visibleCavemanLevels = isWenyanLocale
    ? CAVEMAN_LEVELS
    : CAVEMAN_LEVELS.filter((lvl) => !lvl.wenyan);

  useEffect(() => {
    const current = CAVEMAN_LEVELS.find((lvl) => lvl.id === cavemanLevel);
    if (current?.wenyan && !isWenyanLocale) {
      setCavemanLevel("ultra");
      patchSetting({ cavemanLevel: "ultra" });
    }
  }, [isWenyanLocale, cavemanLevel]);

  const patchSetting = async (patch) => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch (error) {
      console.log("Error updating setting:", error);
    }
  };

  const handleRtkEnabled = async (value) => {
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtkEnabled: value }),
      });
      if (res.ok) setRtkEnabledState(value);
    } catch (error) {
      console.log("Error updating rtkEnabled:", error);
    }
  };

  const handleCavemanEnabled = (value) => {
    setCavemanEnabled(value);
    patchSetting({ cavemanEnabled: value });
  };

  const handleRtkMode = (mode) => {
    setRtkMode(mode);
    patchSetting({ rtkMode: mode });
  };

  const handleAutoTriggerBlur = () => {
    const next = Math.max(0, Math.floor(Number(autoTriggerTokens) || 0));
    setAutoTriggerTokens(String(next));
    patchSetting({ tokenSaverAutoTriggerTokens: next });
  };

  const handleResponseFocus = (value) => {
    setResponseFocus(value);
    patchSetting({ responseFocus: value });
  };

  const handleHeadroomEnabled = (value) => {
    const nextUrl = headroomUrl.trim() || "http://localhost:8787";
    setHeadroomUrl(nextUrl);
    setHeadroomEnabled(value);
    patchSetting({ headroomEnabled: value, headroomUrl: nextUrl });
  };

  const handleHeadroomUrlBlur = async () => {
    const next = headroomUrl.trim() || "http://localhost:8787";
    setHeadroomUrl(next);
    await patchSetting({ headroomUrl: next });
    refreshHeadroomStatus();
  };

  const refreshHeadroomStatus = useCallback(async () => {
    setHeadroomStatus((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/headroom/status", {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      setHeadroomStatus({ ...data, loading: false });
      if (!data?.installed) {
        setHeadroomExtras({
          version: null,
          extras: { code: false, ml: false },
          available: ["code", "ml"],
          loading: false,
        });
        setPendingExtras([]);
        return;
      }
      try {
        const er = await fetch("/api/headroom/extras", {
          headers: { "Cache-Control": "no-store" },
        });
        if (!er.ok) throw new Error("extras status failed");
        const ed = await er.json();
        setHeadroomExtras((s) => ({
          ...s,
          version: ed.version ?? null,
          extras: ed.extras || { code: false, ml: false },
          available: ed.available || ["code", "ml"],
          loading: false,
        }));
        setPendingExtras([]);
      } catch {
        setHeadroomExtras({
          version: null,
          extras: { code: false, ml: false },
          available: ["code", "ml"],
          loading: false,
        });
        setPendingExtras([]);
      }
    } catch {
      setHeadroomStatus({
        installed: false,
        running: false,
        python: null,
        loading: false,
      });
      setHeadroomExtras({
        version: null,
        extras: { code: false, ml: false },
        available: ["code", "ml"],
        loading: false,
      });
      setPendingExtras([]);
    }
  }, []);

  const handleHeadroomStart = useCallback(async () => {
    setHeadroomActionError("");
    setHeadroomActionLoading(true);
    try {
      const res = await fetch("/api/headroom/start", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to start proxy");
      await refreshHeadroomStatus();
    } catch (e) {
      setHeadroomActionError(e.message);
    } finally {
      setHeadroomActionLoading(false);
    }
  }, [refreshHeadroomStatus]);

  const handleHeadroomStop = useCallback(async () => {
    setHeadroomActionLoading(true);
    try {
      await fetch("/api/headroom/stop", { method: "POST" });
      await refreshHeadroomStatus();
    } finally {
      setHeadroomActionLoading(false);
    }
  }, [refreshHeadroomStatus]);

  const togglePendingExtra = (extra) => {
    setPendingExtras((cur) =>
      cur.includes(extra) ? cur.filter((e) => e !== extra) : [...cur, extra]
    );
  };

  // Poll the install log tail while a pip install/uninstall is running.
  const startLogPolling = useCallback(() => {
    setInstallLog("");
    clearInterval(logPollRef.current);
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/headroom/extras?log=1", {
          headers: { "Cache-Control": "no-store" },
        });
        const d = await r.json().catch(() => ({}));
        if (typeof d.log === "string") setInstallLog(d.log);
      } catch { /* ignore transient poll errors */ }
    };
    tick();
    logPollRef.current = setInterval(tick, 1500);
  }, []);

  const stopLogPolling = useCallback(() => {
    if (logPollRef.current) {
      clearInterval(logPollRef.current);
      logPollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopLogPolling(), [stopLogPolling]);

  const handleHeadroomInstall = useCallback(async () => {
    setHeadroomActionLoading(true);
    setHeadroomActionError("");
    startLogPolling();
    try {
      const response = await fetch("/api/headroom/extras", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extras: [], installer: headroomInstaller }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Headroom setup failed");
      await waitForHeadroomInstall(data.job, { onProgress: (progress) => setInstallLog(progress.log || "") });
      await refreshHeadroomStatus();
    } catch (error) { setHeadroomActionError(error.message); }
    finally { stopLogPolling(); setHeadroomActionLoading(false); }
  }, [headroomInstaller, refreshHeadroomStatus, startLogPolling, stopLogPolling]);

  const installExtrasConfirmed = useCallback(async () => {
    if (pendingExtras.length === 0) return;
    setExtrasActionLoading(true);
    setExtrasActionError("");
    startLogPolling();
    try {
      const res = await fetch("/api/headroom/extras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extras: pendingExtras, installer: headroomInstaller }),
      });
      let data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Install failed");
      data = await waitForHeadroomInstall(data.job, { onProgress: (progress) => setInstallLog(progress.log || "") });
      setHeadroomExtras((s) => ({
        ...s,
        version: data.version ?? s.version,
        extras: data.extras || s.extras,
      }));
      setPendingExtras([]);
    } catch (e) {
      setExtrasActionError(e.message);
    } finally {
      stopLogPolling();
      setExtrasActionLoading(false);
    }
  }, [pendingExtras, headroomInstaller, startLogPolling, stopLogPolling]);

  useEffect(() => {
    if (!showHeadroomInstallModal) return;
    let mounted = true;
    fetch("/api/headroom/extras?log=1", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const progress = await response.json();
      if (!mounted) return;
      setInstallLog(progress.log || "");
      if (progress.job?.status !== "running") return;
      setHeadroomActionLoading(true);
      try {
        await waitForHeadroomInstall(progress.job, { onProgress: (next) => { if (mounted) setInstallLog(next.log || ""); } });
        if (mounted) await refreshHeadroomStatus();
      } catch (error) { if (mounted) setHeadroomActionError(error.message); }
      finally { if (mounted) setHeadroomActionLoading(false); }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [showHeadroomInstallModal, refreshHeadroomStatus]);

  const removeExtraConfirmed = useCallback(async (extra) => {
    setRemovingExtra(extra);
    setExtrasActionError("");
    startLogPolling();
    try {
      const res = await fetch("/api/headroom/extras", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extras: [extra] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Remove failed");
      setHeadroomExtras((s) => ({
        ...s,
        version: data.version ?? s.version,
        extras: data.extras || s.extras,
      }));
    } catch (e) {
      setExtrasActionError(e.message);
    } finally {
      stopLogPolling();
      setRemovingExtra(null);
    }
  }, [startLogPolling, stopLogPolling]);

  const handleInstallExtras = useCallback(() => {
    if (pendingExtras.length === 0) return;
    // Warn about the heavy ~1GB torch download before installing [ml].
    if (pendingExtras.includes("ml")) {
      setExtrasConfirm({
        title: "Install [ml]",
        message: "[ml] downloads ~1 GB (torch + huggingface-hub). Continue?",
        confirmText: "Install",
        variant: "primary",
        onConfirm: installExtrasConfirmed,
      });
      return;
    }
    installExtrasConfirmed();
  }, [pendingExtras, installExtrasConfirmed]);

  const handleRemoveExtra = useCallback((extra) => {
    setExtrasConfirm({
      title: `Remove [${extra}]`,
      message: `Remove [${extra}] and its packages?`,
      confirmText: "Remove",
      variant: "danger",
      onConfirm: () => removeExtraConfirmed(extra),
    });
  }, [removeExtraConfirmed]);

  // Toggle an extra's active state (persist setting), then restart the proxy so
  // the new --code-aware / --disable-kompress flags take effect.
  const toggleExtraActive = useCallback(async (extra, value) => {
    setExtrasActionError("");
    if (extra === "code") setCodeAware(value);
    if (extra === "ml") setKompress(value);
    const key = extra === "code" ? "headroomCodeAware" : "headroomKompress";
    await patchSetting({ [key]: value });
    if (!headroomStatus.running) return;
    setRestartingProxy(true);
    try {
      const res = await fetch("/api/headroom/restart", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Restart failed");
      await refreshHeadroomStatus();
    } catch (e) {
      setExtrasActionError(e.message);
    } finally {
      setRestartingProxy(false);
    }
  }, [headroomStatus.running, refreshHeadroomStatus]);

  const handleCavemanLevel = (level) => {
    setCavemanLevel(level);
    patchSetting({ cavemanLevel: level });
  };

  const handlePonytailEnabled = (value) => {
    setPonytailEnabled(value);
    patchSetting({ ponytailEnabled: value });
  };

  const handlePonytailLevel = (level) => {
    setPonytailLevel(level);
    patchSetting({ ponytailLevel: level });
  };

  const refreshPxpipeStatus = useCallback(async () => {
    setPxpipeStatus((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/pxpipe/status", {
        headers: { "Cache-Control": "no-store" },
      });
      const data = await res.json();
      setPxpipeStatus({ ...data, loading: false });
      if (typeof data.minChars === "number") setPxpipeMinChars(data.minChars);
    } catch {
      setPxpipeStatus({ installed: false, installing: false, running: false, version: null, loading: false });
    }
  }, []);

  const runPxpipeHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/pxpipe/health", { method: "POST" });
      setPxpipeHealth(await res.json());
    } catch (e) {
      setPxpipeHealth({ healthy: false, checks: [], error: e.message });
    }
  }, []);

  const pxpipeAction = useCallback(
    async (endpoint) => {
      setPxpipeActionError("");
      setPxpipeActionLoading(true);
      try {
        const res = await fetch(`/api/pxpipe/${endpoint}`, { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `PXPIPE ${endpoint} failed`);
        await refreshPxpipeStatus();
        await runPxpipeHealth();
      } catch (e) {
        setPxpipeActionError(e.message);
      } finally {
        setPxpipeActionLoading(false);
      }
    },
    [refreshPxpipeStatus, runPxpipeHealth]
  );

  const handlePxpipeEnabled = (value) => {
    setPxpipeEnabled(value);
    patchSetting({ pxpipeEnabled: value });
  };

  const handlePxpipeMinCharsBlur = () => {
    const next = Math.max(0, Number(pxpipeMinChars) || 25000);
    setPxpipeMinChars(next);
    patchSetting({ pxpipeMinChars: next });
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setRtkEnabledState(data.rtkEnabled !== false);
          setRtkMode(data.rtkMode || "standard");
          setAutoTriggerTokens(
            String(
              typeof data.tokenSaverAutoTriggerTokens === "number"
                ? data.tokenSaverAutoTriggerTokens
                : TOKEN_SAVER_GENERAL_SETTINGS.autoTrigger.default
            )
          );
          setResponseFocus(["balanced", "code", "explanation"].includes(data.responseFocus)
            ? data.responseFocus
            : "balanced");
          setHeadroomEnabled(!!data.headroomEnabled);
          setHeadroomUrl(data.headroomUrl || "http://localhost:8787");
          setCodeAware(data.headroomCodeAware === true);
          setKompress(data.headroomKompress !== false);
          setCavemanEnabled(!!data.cavemanEnabled);
          setCavemanLevel(data.cavemanLevel || "full");
          setPonytailEnabled(!!data.ponytailEnabled);
          setPonytailLevel(data.ponytailLevel || "full");
          setPxpipeEnabled(!!data.pxpipeEnabled);
          if (typeof data.pxpipeMinChars === "number") setPxpipeMinChars(data.pxpipeMinChars);
          refreshHeadroomStatus();
          // PRD: run the PXPIPE health check automatically when the page opens
          refreshPxpipeStatus().then(runPxpipeHealth);
        }
      } catch {}
    };
    loadSettings();
  }, [refreshHeadroomStatus, refreshPxpipeStatus, runPxpipeHealth]);

  const headroomRunning = !!headroomStatus.running;
  const headroomStatusLabel = headroomStatus.loading
    ? "Checking…"
    : headroomRunning
      ? "Running"
      : headroomStatus.localUrl !== false && !headroomStatus.installed
        ? "Not installed"
        : headroomStatus.localUrl !== false
          ? "Stopped"
          : "External";
  const headroomLocalUrl = headroomStatus.localUrl !== false;
  const headroomCanStart = !!headroomStatus.canStart;
  const headroomManaged =
    headroomLocalUrl && !!headroomStatus.managedPid;

  const pxpipeHealthy = pxpipeHealth?.healthy === true;
  const pxpipeOff = !pxpipeEnabled || !pxpipeStatus.installed;
  const pxpipeStatusLabel = pxpipeOff
    ? "Off"
    : pxpipeStatus.loading
      ? "Checking…"
      : pxpipeStatus.installing
        ? "Installing…"
        : !pxpipeStatus.installed
          ? "Not installed"
          : pxpipeHealthy
            ? "Healthy"
            : pxpipeStatus.running
              ? "Running"
              : "Stopped";
  const pxpipeOk = !pxpipeOff && (pxpipeHealthy || pxpipeStatus.running);

  // ── Catalog status derivation ──────────────────────────────────────────
  // Status text comes only from real state; unavailable entries carry no
  // control at all (nothing to toggle, so nothing is rendered).
  const chipCls = (tone) =>
    tone === "success"
      ? "text-xs px-2 py-0.5 rounded-md bg-success/10 text-success"
      : tone === "warning"
        ? "text-xs px-2 py-0.5 rounded-md bg-warning/10 text-warning"
        : "text-xs px-2 py-0.5 rounded-md bg-surface-2 text-text-muted";

  const catalogStatus = (entry) => {
    switch (entry.id) {
      case "rtk":
        return {
          chip: { text: rtkEnabled ? "On" : "Off", tone: rtkEnabled ? "success" : "muted" },
          link: { text: "Master switch", href: "#rtk" },
        };
      case "lite":
      case "standard":
      case "aggressive":
        return { mode: true };
      case "codex-responses":
        return {
          chip: { text: rtkEnabled ? "Covered · RTK on" : "Covered · RTK off", tone: rtkEnabled ? "success" : "muted" },
          link: { text: "Toggle via RTK master", href: "#rtk" },
        };
      case "headroom":
        return {
          chip: {
            text: headroomEnabled && headroomRunning ? "On" : headroomEnabled ? "Enabled · proxy offline" : "Off",
            tone: headroomEnabled && headroomRunning ? "success" : "muted",
          },
          link: { text: "Control", href: "#headroom-control" },
        };
      case "caveman":
        return {
          chip: { text: cavemanEnabled ? `On · ${cavemanLevel}` : "Off", tone: cavemanEnabled ? "success" : "muted" },
          link: { text: "Control", href: "#caveman-control" },
        };
      case "terse-prose":
        return {
          chip: { text: cavemanEnabled ? `On · via Caveman (${cavemanLevel})` : "Off · via Caveman", tone: cavemanEnabled ? "success" : "muted" },
          link: { text: "Caveman control", href: "#caveman-control" },
          injected: true,
        };
      case "ponytail":
        return {
          chip: { text: ponytailEnabled ? `On · ${ponytailLevel}` : "Off", tone: ponytailEnabled ? "success" : "muted" },
          link: { text: "Control", href: "#ponytail-control" },
        };
      case "less-code":
        return {
          chip: { text: ponytailEnabled ? `On · via Ponytail (${ponytailLevel})` : "Off · via Ponytail", tone: ponytailEnabled ? "success" : "muted" },
          link: { text: "Ponytail control", href: "#ponytail-control" },
          injected: true,
        };
      default:
        return {};
    }
  };

  const renderCatalogRow = (entry) => {
    const unavailable = entry.status === "unavailable";
    const st = catalogStatus(entry);
    return (
      <tr
        key={entry.id}
        className="border-b border-border-subtle last:border-b-0"
        aria-disabled={unavailable}
      >
        {/* Engine */}
        <td className="min-w-[18rem] px-3 py-2.5 align-top">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className={`text-[13px] font-medium ${unavailable ? "text-text-muted" : "text-text-main"}`}>
                {entry.label}
              </span>
              <code className="font-mono text-[11px] text-text-subtle">{entry.id}</code>
              {entry.safeDefault && <span className={chipCls("success")}>Safe default</span>}
              {st.injected && <span className={chipCls("muted")}>instruction injection</span>}
            </span>
            <span className="text-[13px] leading-relaxed text-text-muted">
              {unavailable ? `No runtime in this build — ${entry.detail}` : entry.detail}
            </span>
          </div>
        </td>

        {/* Runtime coverage */}
        <td className="min-w-[16rem] px-3 py-2.5 align-top">
          <span
            className="line-clamp-2 font-mono text-[11px] text-text-muted"
            title={entry.coverage || "No runtime in this build"}
          >
            {entry.coverage || "No runtime in this build"}
          </span>
        </td>

        {/* Status */}
        <td className="px-3 py-2.5 align-top">
          {unavailable ? (
            <span className={chipCls("warning")}>Unavailable</span>
          ) : st.chip ? (
            <span className={chipCls(st.chip.tone)}>{st.chip.text}</span>
          ) : (
            <span className="text-xs text-text-muted">Exclusive mode</span>
          )}
        </td>

        {/* Control */}
        <td className="px-3 py-2.5 align-top">
          {st.mode ? (
            <button
              type="button"
              disabled={rtkMode === entry.id || !rtkEnabled}
              onClick={() => handleRtkMode(entry.id)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                rtkMode === entry.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-text-muted hover:bg-surface-2 hover:text-text-main disabled:opacity-40"
              }`}
              title={!rtkEnabled ? "RTK master switch is off — enable RTK first" : entry.detail}
            >
              {rtkMode === entry.id ? "Active mode" : "Use this mode"}
            </button>
          ) : st.link ? (
            <a href={st.link.href} className="text-xs text-primary hover:underline">
              {st.link.text}
            </a>
          ) : (
            <span className="text-xs text-text-muted">Not configurable</span>
          )}
        </td>
      </tr>
    );
  };

  const PRESETS = [
    {
      id: "max_saver",
      icon: "bolt",
      name: "Maximum Savings",
      tone: "success",
      description: "Aggressive compression for tool outputs, with concise code-first responses and no filler.",
      settings: {
        rtkEnabled: true,
        rtkMode: "aggressive",
        tokenSaverAutoTriggerTokens: 0,
        responseFocus: "code",
        ponytailEnabled: true,
        ponytailLevel: "full",
        cavemanEnabled: true,
        cavemanLevel: "lite",
      },
    },
    {
      id: "balanced",
      icon: "tune",
      name: "Balanced (Recommended)",
      tone: "primary",
      description: "Standard tool-output compression without changing response style. The safe default.",
      settings: {
        rtkEnabled: true,
        rtkMode: "standard",
        tokenSaverAutoTriggerTokens: 2000,
        responseFocus: "balanced",
        ponytailEnabled: false,
        cavemanEnabled: false,
      },
    },
    {
      id: "developer_pro",
      icon: "terminal",
      name: "Developer Pro",
      tone: "primary",
      description: "For coding agents (Claude Code, Cursor, Windsurf): direct code patches with minimal boilerplate.",
      settings: {
        rtkEnabled: true,
        rtkMode: "standard",
        tokenSaverAutoTriggerTokens: 1000,
        responseFocus: "code",
        ponytailEnabled: true,
        ponytailLevel: "full",
        cavemanEnabled: false,
      },
    },
    {
      id: "passthrough",
      icon: "block",
      name: "Passthrough (Off)",
      tone: "muted",
      description: "Every filter off, for raw evaluation or debugging responses that must not be touched.",
      settings: {
        rtkEnabled: false,
        cavemanEnabled: false,
        ponytailEnabled: false,
        responseFocus: "balanced",
        tokenSaverAutoTriggerTokens: 4000,
      },
    },
  ];

  const [appliedPresetId, setAppliedPresetId] = useState(null);

  const applyPreset = async (preset) => {
    const s = preset.settings;
    if (s.rtkEnabled !== undefined) setRtkEnabledState(s.rtkEnabled);
    if (s.rtkMode !== undefined) setRtkMode(s.rtkMode);
    if (s.tokenSaverAutoTriggerTokens !== undefined) setAutoTriggerTokens(String(s.tokenSaverAutoTriggerTokens));
    if (s.responseFocus !== undefined) setResponseFocus(s.responseFocus);
    if (s.ponytailEnabled !== undefined) setPonytailEnabled(s.ponytailEnabled);
    if (s.ponytailLevel !== undefined) setPonytailLevel(s.ponytailLevel);
    if (s.cavemanEnabled !== undefined) setCavemanEnabled(s.cavemanEnabled);
    if (s.cavemanLevel !== undefined) setCavemanLevel(s.cavemanLevel);

    await patchSetting(s);
    setAppliedPresetId(preset.id);
    setTimeout(() => setAppliedPresetId(null), 2500);
  };

  const getActivePresetId = () => {
    if (!rtkEnabled && !cavemanEnabled && !ponytailEnabled && responseFocus === "balanced") {
      return "passthrough";
    }
    if (
      rtkEnabled &&
      rtkMode === "aggressive" &&
      Number(autoTriggerTokens) === 0 &&
      responseFocus === "code" &&
      ponytailEnabled &&
      cavemanEnabled
    ) {
      return "max_saver";
    }
    if (
      rtkEnabled &&
      rtkMode === "standard" &&
      responseFocus === "code" &&
      ponytailEnabled &&
      !cavemanEnabled
    ) {
      return "developer_pro";
    }
    if (
      rtkEnabled &&
      rtkMode === "standard" &&
      responseFocus === "balanced" &&
      !cavemanEnabled &&
      !ponytailEnabled
    ) {
      return "balanced";
    }
    return "custom";
  };
  const activePresetId = getActivePresetId();
  const activePresetLabel = translate(
    PRESETS.find((preset) => preset.id === activePresetId)?.name || "Custom"
  );
  const groups = getTokenSaverGroups();
  const totalEngines = TOKEN_SAVER_TIERS.reduce((n, t) => n + t.engineIds.length, 0);
  const unavailableCount = groups.reduce(
    (n, g) => n + g.entries.filter((e) => e.status === "unavailable").length,
    0
  );

  const responseFocusLabel =
    responseFocus === "code" ? "Code-first" : responseFocus === "explanation" ? "Explanation-first" : "Balanced";

  const liveState = [
    { label: "RTK tool compression", value: rtkEnabled ? `On · ${rtkMode}` : "Off", on: rtkEnabled },
    { label: "Headroom prompt compression", value: headroomEnabled ? `On · ${headroomStatusLabel}` : "Off", on: headroomEnabled && headroomRunning },
    { label: "Caveman output style", value: cavemanEnabled ? `On · ${cavemanLevel}` : "Off", on: cavemanEnabled },
    { label: "Ponytail minimal-code bias", value: ponytailEnabled ? `On · ${ponytailLevel}` : "Off", on: ponytailEnabled },
    { label: "PXPIPE image context", value: pxpipeStatusLabel, on: pxpipeOk },
    { label: "Response focus", value: responseFocusLabel, on: false },
    {
      label: "Auto-trigger threshold",
      value: Number(autoTriggerTokens) === 0 ? "Immediate (0 tokens)" : `${autoTriggerTokens} tokens`,
      on: false,
    },
  ];

  return (
    <div className="saver-workspace flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Token saver</h1>
          <p>
            Compress what leaves this machine — tool output, prompts and response style — so each
            request costs fewer tokens at the provider.
          </p>
        </div>
        <a href="/dashboard/usage" className="workspace-link">View live activity</a>
      </div>

      <nav className="saver-section-nav" aria-label="Token saver sections">
        <a href="#quick-presets">Profiles</a>
        <a href="#rtk">Compression</a>
        <a href="#token-saver-catalog">Engine catalog</a>
        <a href="#token-saver-general">Preferences</a>
      </nav>

      {/* Current state — derived from the live settings above, nothing estimated. */}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-[10px] border border-border-subtle bg-surface-2/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {liveState.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs text-text-muted">{item.label}</dt>
            <dd className={`mt-0.5 truncate text-[13px] font-medium ${item.on ? "text-success" : "text-text-main"}`}>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Profiles */}
      <ConfigSection
        id="quick-presets"
        title={translate("Quick Presets (Token Saver Profiles)")}
        icon="tune"
        subtitle={translate("Choose a 1-click ready-to-use strategy for optimal performance and token savings without complex manual configuration.")}
        action={
          <span className="text-[13px] text-text-muted">
            {translate("Current Profile:")} <span className="font-medium text-text-main">{activePresetLabel}</span>
          </span>
        }
      >
        {PRESETS.map((preset) => {
          const isActive = activePresetId === preset.id;
          const isApplied = appliedPresetId === preset.id;
          return (
            <ConfigRow
              key={preset.id}
              label={translate(preset.name)}
              help={translate(preset.description)}
              badge={isActive ? <span className={chipCls("success")}>{translate("Active Profile")}</span> : null}
              control={
                <Button
                  variant={isActive ? "secondary" : "primary"}
                  size="sm"
                  onClick={() => applyPreset(preset)}
                  loading={isApplied}
                  disabled={isActive && !isApplied}
                  icon={isApplied ? "check" : undefined}
                >
                  {isApplied ? translate("Applied Successfully!") : isActive ? translate("Active Profile") : translate("Apply Profile")}
                </Button>
              }
            />
          );
        })}
      </ConfigSection>

      {/* Compression engines */}
      <ConfigSection
        id="rtk"
        title="Compression"
        icon="bolt"
        subtitle="Each engine runs at a different point in the request. Off means the request passes through untouched."
      >
        <ConfigRow
          label={
            <>
              Compress tool output{" "}
              <a
                href="https://github.com/rtk-ai/rtk"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-normal text-primary hover:underline"
              >
                (RTK)
              </a>
            </>
          }
          help="Rewrites git/grep/ls/tree/log output in tool results — typically 60–90% fewer input tokens."
          control={
            <Toggle
              checked={rtkEnabled}
              onChange={() => handleRtkEnabled(!rtkEnabled)}
              ariaLabel="Compress tool output with RTK"
            />
          }
        />

        {/* RTK mode */}
        <ConfigRow
          disabled={!rtkEnabled}
          label="RTK compression mode"
          help="One shared mode for the single RTK pass. Aggressive lowers the per-blob threshold to 100B; lite compresses only blobs of 2KB or more."
          control={
            <div className="flex items-center gap-1.5">
              {["lite", "standard", "aggressive"].map((mode) => (
                <Button
                  key={mode}
                  variant={rtkMode === mode ? "primary" : "secondary"}
                  size="sm"
                  disabled={!rtkEnabled}
                  onClick={() => handleRtkMode(mode)}
                >
                  {mode}
                </Button>
              ))}
            </div>
          }
        />

        <ConfigRow
          id="headroom-control"
          label={
            <>
              Compress prompts{" "}
              <a
                href="https://github.com/headroomlabs-ai/headroom"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-normal text-primary hover:underline"
              >
                (Headroom)
              </a>
            </>
          }
          help="Sends the prompt through a local /v1/compress proxy before routing it to the model."
          badge={
            <span className={chipCls(headroomRunning ? "success" : "muted")}>{headroomStatusLabel}</span>
          }
          control={
            <>
              <Button
                variant="secondary"
                size="sm"
                icon="settings"
                onClick={() => setShowHeadroomInstallModal(true)}
              >
                {headroomRunning ? "Manage" : "Set up"}
              </Button>
              <Toggle
                checked={headroomEnabled}
                disabled={!headroomRunning}
                onChange={() => handleHeadroomEnabled(!headroomEnabled)}
                ariaLabel="Compress prompts with Headroom"
              />
            </>
          }
        >
          {headroomStatus.installed && (
            <div className="mt-3 rounded-md border border-border-subtle bg-surface-2/40 p-3">
              <p className="text-[13px] text-text-muted">
                Compression extras{headroomExtras.version ? ` · v${headroomExtras.version}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {headroomExtras.available.map((extra) => {
                  const installed = !!headroomExtras.extras[extra];
                  const pending = pendingExtras.includes(extra);
                  const extraTitle =
                    extra === "code"
                      ? "tree-sitter AST compression for code responses"
                      : "Kompress-v2 HF model for prose/agentic traces (~+1GB)";

                  if (installed) {
                    const active = extra === "code" ? codeAware : kompress;
                    return (
                      <div
                        key={extra}
                        className="flex items-center gap-2 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs"
                        title={extraTitle}
                      >
                        <Toggle
                          size="sm"
                          checked={active}
                          disabled={restartingProxy}
                          onChange={() => toggleExtraActive(extra, !active)}
                          ariaLabel={`Activate ${extra} extra`}
                        />
                        <span className="font-mono font-medium text-text-main">[{extra}]</span>
                        <span className="text-text-muted">{active ? "on" : "off"}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExtra(extra)}
                          disabled={removingExtra === extra}
                          className="text-danger hover:underline disabled:opacity-50"
                          title={`Uninstall [${extra}]`}
                        >
                          {removingExtra === extra ? "Uninstalling…" : "Uninstall"}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <label
                      key={extra}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors ${
                        pending
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface text-text-muted hover:text-text-main"
                      }`}
                      title={extraTitle}
                    >
                      <input
                        type="checkbox"
                        className="size-3"
                        checked={pending}
                        onChange={() => togglePendingExtra(extra)}
                      />
                      <span className="font-mono font-medium">[{extra}]</span>
                      <span>not installed</span>
                    </label>
                  );
                })}
                {pendingExtras.length > 0 && (
                  <Button
                    size="sm"
                    loading={extrasActionLoading}
                    onClick={handleInstallExtras}
                  >
                    {extrasActionLoading ? "Installing…" : `Install [proxy,${pendingExtras.join(",")}]`}
                  </Button>
                )}
              </div>
              {extrasActionError && <p className="mt-1 text-xs text-danger">{extrasActionError}</p>}
              {restartingProxy && <p className="mt-1 text-xs text-text-muted">Restarting proxy…</p>}
              {(extrasActionLoading || removingExtra) && installLog && (
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-surface p-2 font-mono text-[10px] leading-tight text-text-muted">
                  {installLog}
                </pre>
              )}
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                Installing adds the package; the on/off switch activates it and restarts the proxy.
                The default install is <code className="font-mono">[proxy]</code> only (SmartCrusher for
                JSON). <code className="font-mono">[code]</code> adds AST compression
                (Python/JS/TS/Go/Rust/Java/C/C++/Perl). <code className="font-mono">[ml]</code> adds the
                Kompress-v2 model for prose and agentic traces but costs about 1 GB (torch +
                huggingface-hub).
              </p>
            </div>
          )}
        </ConfigRow>

        <ConfigRow
          id="caveman-control"
          label={
            <>
              Compress output style{" "}
              <a
                href="https://github.com/JuliusBrussee/caveman"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-normal text-primary hover:underline"
              >
                (Caveman)
              </a>
            </>
          }
          help="Injects a terse-style system prompt so technical answers come back shorter."
          control={
            <>
              {cavemanEnabled && (
                <div className="flex items-center gap-1.5">
                  {visibleCavemanLevels.map((lvl) => (
                    <Button
                      key={lvl.id}
                      variant={cavemanLevel === lvl.id ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => handleCavemanLevel(lvl.id)}
                      title={lvl.desc}
                    >
                      {lvl.label}
                    </Button>
                  ))}
                </div>
              )}
              <Toggle
                checked={cavemanEnabled}
                onChange={() => handleCavemanEnabled(!cavemanEnabled)}
                ariaLabel="Compress output style with Caveman"
              />
            </>
          }
        >
          {cavemanEnabled && CAVEMAN_LEVELS.find((lvl) => lvl.id === cavemanLevel)?.desc && (
            <p className="mt-1.5 text-xs text-primary">
              {CAVEMAN_LEVELS.find((lvl) => lvl.id === cavemanLevel)?.desc}
            </p>
          )}
        </ConfigRow>

        <ConfigRow
          id="ponytail-control"
          label={
            <>
              Bias toward minimal code{" "}
              <a
                href="https://github.com/DietrichGebert/ponytail"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-normal text-primary hover:underline"
              >
                (Ponytail)
              </a>
            </>
          }
          help="Bias the model toward YAGNI: reuse the standard library, delete instead of adding."
          control={
            <>
              {ponytailEnabled && (
                <div className="flex items-center gap-1.5">
                  {PONYTAIL_LEVELS.map((lvl) => (
                    <Button
                      key={lvl.id}
                      variant={ponytailLevel === lvl.id ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => handlePonytailLevel(lvl.id)}
                      title={lvl.desc}
                    >
                      {lvl.label}
                    </Button>
                  ))}
                </div>
              )}
              <Toggle
                checked={ponytailEnabled}
                onChange={() => handlePonytailEnabled(!ponytailEnabled)}
                ariaLabel="Bias toward minimal code with Ponytail"
              />
            </>
          }
        >
          {ponytailEnabled && PONYTAIL_LEVELS.find((lvl) => lvl.id === ponytailLevel)?.desc && (
            <p className="mt-1.5 text-xs text-primary">
              {PONYTAIL_LEVELS.find((lvl) => lvl.id === ponytailLevel)?.desc}
            </p>
          )}
        </ConfigRow>

        <ConfigRow
          label={
            <>
              Compress prompts as images{" "}
              <a
                href="https://github.com/teamchong/pxpipe"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-normal text-primary hover:underline"
              >
                (PXPIPE)
              </a>
            </>
          }
          help="Renders large text context as images before sending it. Suited to huge prompts and long conversations."
          badge={<span className={chipCls(pxpipeOk ? "success" : "muted")}>{pxpipeStatusLabel}</span>}
          control={
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowPxpipeModal(true)}
              >
                {pxpipeStatus.installed ? "Manage" : "Set up"}
              </Button>
              <a
                href="/dashboard/pxpipe"
                className="text-xs text-primary hover:underline"
              >
                Dashboard
              </a>
              <Toggle
                checked={!pxpipeOff}
                disabled={!pxpipeStatus.installed}
                onChange={() => handlePxpipeEnabled(!pxpipeEnabled)}
                ariaLabel="Compress prompts as images with PXPIPE"
              />
            </>
          }
        />
      </ConfigSection>

      {/* Engine catalog */}
      <Card
        id="token-saver-catalog"
        title="Engine catalog"
        icon="category"
        subtitle="Every engine this build knows about, grouped by tier. Entries with no runtime are never wired to a fake toggle."
        action={
          <span className="font-mono text-xs text-text-muted">
            {totalEngines - unavailableCount} covered · {unavailableCount} unavailable
          </span>
        }
      >
        <div className="overflow-x-auto rounded-[10px] border border-border-subtle">
          <table className="w-full min-w-[60rem] border-collapse text-left" aria-label="Token saver engine catalog">
            <thead>
              <tr className="border-b border-border text-[13px] text-text-muted">
                <th scope="col" className="px-3 py-2 font-medium">Engine</th>
                <th scope="col" className="px-3 py-2 font-medium">Runtime</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Control</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.id}>
                  <tr className="border-b border-border-subtle bg-surface-2/60">
                    <th scope="colgroup" colSpan={4} className="px-3 py-2 text-left">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-text-main">{group.label}</span>
                        <span className="text-xs text-text-muted">
                          {group.entries.length} engine{group.entries.length === 1 ? "" : "s"}
                        </span>
                        {group.heuristic && <span className={chipCls("warning")}>heuristic availability</span>}
                      </span>
                    </th>
                  </tr>
                  {group.entries.map(renderCatalogRow)}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Preferences */}
      <ConfigSection
        id="token-saver-general"
        title="Preferences"
        icon="tune"
        subtitle="Global behavior shared by every compression engine."
      >
        <ConfigRow
          label="Auto-trigger threshold"
          help={TOKEN_SAVER_GENERAL_SETTINGS.autoTrigger.detail}
          control={
            <Input
              type="number"
              min="0"
              step="100"
              value={autoTriggerTokens}
              onChange={(e) => setAutoTriggerTokens(e.target.value)}
              onBlur={handleAutoTriggerBlur}
              aria-label="Auto-trigger threshold in tokens"
              className="w-36"
              inputClassName="font-mono text-sm"
            />
          }
        />
        <ConfigRow
          label="Response focus"
          help="Code-first or explanation-first answers. Balanced adds no extra focus instruction."
          control={
            <Select
              options={RESPONSE_FOCUS_OPTIONS}
              value={responseFocus}
              onChange={(event) => handleResponseFocus(event.target.value)}
              aria-label="Response focus"
              className="w-44"
            />
          }
        />
        <ConfigRow
          label="Preserve system prompt"
          help={TOKEN_SAVER_GENERAL_SETTINGS.preserveSystem.detail}
          control={<span className={chipCls("success")}>Always</span>}
        />
        <ConfigRow
          label="Cache-aligned live zone"
          help={TOKEN_SAVER_GENERAL_SETTINGS.liveZone.detail}
          control={<span className={chipCls("success")}>Enabled · fixed</span>}
        />
      </ConfigSection>

      <Modal
        isOpen={showHeadroomInstallModal}
        title={headroomRunning ? "Headroom" : "Set up Headroom"}
        onClose={() => setShowHeadroomInstallModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-muted">
            RTK works inside MiawRouter without Python. Headroom is an optional compression proxy.
            Setup creates a private Python environment and leaves system packages unchanged.
          </p>
          <p className="text-xs text-text-muted">
            Setup runs in the background and allows up to 45 minutes per step; large downloads can
            take longer on a slow connection. You can close this panel and reopen it to check
            progress — keep MiawRouter running.
          </p>
          <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-2/40 p-3 text-[13px]">
            <p className="font-mono">
              Python 3.10+: {headroomStatus.loading ? "checking…" : headroomStatus.python || "not detected"}
            </p>
            <p className="font-mono">
              uv: {headroomStatus.uv ? "available" : "not detected"} · pip: {headroomStatus.pip ? "available" : "not detected"}
            </p>
            <Select
              label="Package installer"
              value={headroomInstaller}
              onChange={(event) => setHeadroomInstaller(event.target.value)}
              disabled={headroomActionLoading || extrasActionLoading}
              options={[
                { value: "auto", label: "Auto (prefer uv, otherwise pip)" },
                { value: "uv", label: "uv" },
                { value: "pip", label: "pip" },
              ]}
              aria-label="Headroom package installer"
            />
            <p className="text-xs text-text-muted">
              If Python is missing, uv can download Python 3.12 during setup. With pip, install
              Python 3.10+ with pip and venv first. PXPIPE uses Node.js/npm and does not need Python.
            </p>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-muted">Status</span>
            <span className={headroomRunning ? "text-success" : "text-warning"}>{headroomStatusLabel}</span>
          </div>
          {headroomRunning && (
            <a
              href="/api/headroom/proxy/dashboard"
              target="_blank"
              rel="noreferrer"
              className="w-full rounded-md border border-border px-4 py-2 text-center text-[13px] text-text-main transition-colors hover:bg-surface-2"
            >
              Open Headroom dashboard
            </a>
          )}
          <Input
            label="Proxy URL"
            value={headroomUrl}
            onChange={(e) => setHeadroomUrl(e.target.value)}
            onBlur={handleHeadroomUrlBlur}
            placeholder="http://localhost:8787"
            inputClassName="font-mono text-sm"
            hint="A local proxy enables Start/Stop here; an external sidecar such as http://headroom:8787 works too."
          />
          {headroomManaged ? (
            <Button
              onClick={handleHeadroomStop}
              variant="ghost"
              fullWidth
              disabled={headroomActionLoading}
            >
              {headroomActionLoading ? "Stopping…" : "Stop Headroom"}
            </Button>
          ) : headroomRunning ? (
            <p className="text-[13px] text-success">
              The Headroom proxy is reachable. You can enable the token saver.
            </p>
          ) : headroomCanStart ? (
            <Button
              onClick={handleHeadroomStart}
              fullWidth
              disabled={headroomActionLoading}
            >
              {headroomActionLoading ? "Starting…" : "Start Headroom"}
            </Button>
          ) : !headroomLocalUrl ? (
            <p className="text-[13px] text-warning">
              Start Headroom separately at the configured URL, then recheck.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              <Button fullWidth onClick={handleHeadroomInstall} disabled={headroomActionLoading || !headroomStatus.canInstall}>
                {headroomActionLoading ? "Installing…" : "Install Headroom"}
              </Button>
              {!headroomStatus.loading && !headroomStatus.canInstall && (
                <p className="text-xs text-text-muted">
                  Install{" "}
                  <a href="https://docs.astral.sh/uv/getting-started/installation/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    uv
                  </a>{" "}
                  or{" "}
                  <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    Python
                  </a>
                  , then click Recheck.
                </p>
              )}
            </div>
          )}
          {headroomActionError && <p className="text-[13px] text-danger">{headroomActionError}</p>}
          {installLog && (
            <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle bg-surface-2/40 p-3 font-mono text-xs">
              {installLog}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={() => refreshHeadroomStatus()} variant="ghost" fullWidth>
              Recheck
            </Button>
            <Button onClick={() => setShowHeadroomInstallModal(false)} fullWidth>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showPxpipeModal}
        title={pxpipeStatus.installed ? "PXPIPE" : "Set up PXPIPE"}
        onClose={() => setShowPxpipeModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-[13px] text-text-muted">
            Compresses prompts with multimodal encoding and runs in-process — no extra server or
            environment variables.
          </p>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-text-muted">Status</span>
            <span className={pxpipeOk ? "text-success" : "text-warning"}>
              {pxpipeStatusLabel}
              {pxpipeStatus.version ? ` · v${pxpipeStatus.version}` : ""}
            </span>
          </div>
          {pxpipeHealth?.checks?.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface-2/40 p-3">
              <p className="text-[13px] font-medium text-text-main">Health check</p>
              {pxpipeHealth.checks.map((check) => (
                <div key={check.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className={`flex items-center gap-1.5 ${check.ok ? "text-success" : "text-warning"}`}>
                    <Icon name={check.ok ? "check_circle" : "radio_button_unchecked"} className="text-[13px]" />
                    {check.label}
                  </span>
                  {check.detail && (
                    <span className="max-w-[50%] truncate font-mono text-text-muted">{check.detail}</span>
                  )}
                </div>
              ))}
              {pxpipeHealth.error && <p className="mt-1 text-xs text-warning">{pxpipeHealth.error}</p>}
            </div>
          )}
          {!pxpipeStatus.installed ? (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] text-warning">PXPIPE is not installed.</p>
              <Button
                onClick={() => pxpipeAction("install")}
                fullWidth
                disabled={pxpipeActionLoading || pxpipeStatus.installing}
              >
                {pxpipeActionLoading || pxpipeStatus.installing ? "Installing…" : "Install"}
              </Button>
              <p className="text-xs text-text-muted">
                Installs the npm package <code className="font-mono">pxpipe-proxy</code> into the
                MiawRouter data directory. This can take a few minutes.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {pxpipeStatus.running ? (
                <>
                  <Button onClick={() => pxpipeAction("restart")} variant="secondary" disabled={pxpipeActionLoading}>
                    Restart
                  </Button>
                  <Button onClick={() => pxpipeAction("stop")} variant="secondary" disabled={pxpipeActionLoading}>
                    Stop
                  </Button>
                </>
              ) : (
                <Button onClick={() => pxpipeAction("start")} disabled={pxpipeActionLoading}>
                  {pxpipeActionLoading ? "Starting…" : "Start"}
                </Button>
              )}
              <Button onClick={() => pxpipeAction("install")} variant="secondary" disabled={pxpipeActionLoading}>
                Repair
              </Button>
              <a
                href="/dashboard/pxpipe#logs"
                className="col-span-2 rounded-md border border-border px-4 py-2 text-center text-[13px] text-text-main transition-colors hover:bg-surface-2"
              >
                Open logs
              </a>
            </div>
          )}
          <Input
            label="Minimum prompt size (characters)"
            value={String(pxpipeMinChars)}
            onChange={(e) => setPxpipeMinChars(e.target.value)}
            onBlur={handlePxpipeMinCharsBlur}
            placeholder="25000"
            inputClassName="font-mono text-sm"
            hint="Requests smaller than this bypass PXPIPE and are sent as-is."
          />
          {pxpipeActionError && <p className="text-[13px] text-danger">{pxpipeActionError}</p>}
          <div className="flex gap-2">
            <Button
              onClick={() => refreshPxpipeStatus().then(runPxpipeHealth)}
              variant="ghost"
              fullWidth
            >
              Recheck
            </Button>
            <Button onClick={() => setShowPxpipeModal(false)} fullWidth>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!extrasConfirm}
        onClose={() => setExtrasConfirm(null)}
        onConfirm={() => {
          const fn = extrasConfirm?.onConfirm;
          setExtrasConfirm(null);
          fn?.();
        }}
        title={extrasConfirm?.title}
        message={extrasConfirm?.message}
        confirmText={extrasConfirm?.confirmText}
        variant={extrasConfirm?.variant}
      />
    </div>
  );
}
