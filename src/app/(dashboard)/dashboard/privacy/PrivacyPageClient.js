"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, Button, Toggle, Badge, ConfirmModal, CardSkeleton } from "@/shared/components";
import SegmentedControl from "@/shared/components/SegmentedControl";
import { useNotificationStore } from "@/store/notificationStore";
import { PRIVACY_MODES } from "@/lib/privacy/privacyMode";
import { ConfigSection, ConfigRow } from "../components/ConfigSection";

import { Icon } from "@/shared/components/Icon";

// Mode ids + permission matrix come from the runtime (src/lib/privacy/privacyMode.js);
// only labels/icons/descriptions and the presets below are UI-owned.
// A null preset leaves the user's current toggle untouched (user-controlled).
const MODE_META = {
  normal: {
    label: "Normal",
    icon: "tune",
    desc: "Balanced default. Every behavior follows your toggles below — exact-match cache on by default, semantic cache and content dedup off.",
  },
  "private-cache": {
    label: "Private cache",
    icon: "lock",
    desc: "Exact-match and content-dedup caching stay under your control. The semantic cache (L2) only ever runs against a local embedding model, and anything shipping the body to an external service (request logs, headroom proxy, pxpipe) is forced off.",
  },
  "private-no-cache": {
    label: "Private no cache",
    icon: "lock_open",
    desc: "No local response caching at all — L1/L2/L3 are forced off. Request bodies are never retained between requests.",
  },
  strict: {
    label: "Strict",
    icon: "shield",
    desc: "Nothing is cached or retained locally, and your blocked-providers list is enforced — blocked providers are never routed to.",
  },
  "local-only": {
    label: "Local only",
    icon: "home",
    desc: "Strictest posture: no caching, no retention, blocked providers enforced, and only self-hosted (local) connections can be routed to.",
  },
};

// Presets applied to the cache toggles when a mode is selected (null = keep current).
// Mirrors MODE_TABLE: private-cache keeps L1/L3 user-controllable and gates L2 behind
// a local embedding model; private-no-cache/strict/local-only force all caches off.
const MODE_PRESETS = {
  normal: { l1: null, l2: null, l3: null },
  "private-cache": { l1: null, l2: false, l3: null },
  "private-no-cache": { l1: false, l2: false, l3: false },
  strict: { l1: false, l2: false, l3: false },
  "local-only": { l1: false, l2: false, l3: false },
};

const MODE_OPTIONS = PRIVACY_MODES.map((id) => ({
  id,
  ...MODE_META[id],
  presets: MODE_PRESETS[id] || { l1: null, l2: null, l3: null },
}));

// Runtime enforcement (src/sse/handlers/chat.js): blocked list is enforced only in
// strict/local-only; local-only also restricts routing to self-hosted connections.
const MATRIX_ROWS = [
  { behavior: "Store identical responses locally (L1)", cells: { normal: "On by default", "private-cache": "User-controlled", "private-no-cache": "Off", strict: "Off", "local-only": "Off" } },
  { behavior: "Semantic similarity cache (L2)", cells: { normal: "Off by default", "private-cache": "Local model only", "private-no-cache": "Off", strict: "Off", "local-only": "Off" } },
  { behavior: "Request-body content dedup rewrite (L3)", cells: { normal: "Off by default", "private-cache": "User-controlled", "private-no-cache": "Off", strict: "Off", "local-only": "Off" } },
  { behavior: "Provider-side prompt caching (L0)", cells: { normal: "Provider-controlled", "private-cache": "Provider-controlled", "private-no-cache": "Provider-controlled", strict: "Provider-controlled", "local-only": "Provider-controlled" } },
  { behavior: "Routing to blocked providers", cells: { normal: "Not enforced", "private-cache": "Not enforced", "private-no-cache": "Not enforced", strict: "Enforced", "local-only": "Enforced" } },
  { behavior: "Connections used for routing", cells: { normal: "Any", "private-cache": "Any", "private-no-cache": "Any", strict: "Any", "local-only": "Self-hosted only" } },
];

const AUTH_LABELS = {
  oauth: "OAuth",
  apikey: "API Key",
  api_key: "API Key",
  cookie: "Cookie",
  free: "Free",
};

export default function PrivacyPageClient() {
  const notify = useNotificationStore();
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState("normal");
  const [cacheL1, setCacheL1] = useState(true);
  const [cacheL2, setCacheL2] = useState(false);
  const [cacheL3, setCacheL3] = useState(false);
  const [connections, setConnections] = useState([]);
  const [blockedProviders, setBlockedProviders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const patchSettings = useCallback(
    async (patch, opts = {}) => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error("Settings update failed");
        if (opts.success) notify.success(opts.success);
      } catch (error) {
        console.log("Error updating setting:", error);
        notify.error(opts.error || "Failed to save setting");
      } finally {
        setSaving(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [settingsRes, providersRes] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/providers", { cache: "no-store" }),
        ]);
        const settings = settingsRes.ok ? await settingsRes.json() : {};
        const providersData = providersRes.ok ? await providersRes.json() : {};
        setPrivacyMode(settings.privacyMode || "normal");
        setCacheL1(settings.cacheL1Enabled !== false);
        setCacheL2(settings.cacheL2Enabled === true);
        setCacheL3(settings.cacheL3Enabled === true);
        setBlockedProviders(Array.isArray(settings.privacyBlockedProviders) ? settings.privacyBlockedProviders : []);
        setConnections(providersData.connections || []);
      } catch (error) {
        console.log("Error loading privacy page:", error);
        notify.error("Failed to load privacy settings");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [notify]);

  const handleModeChange = (modeId) => {
    const mode = MODE_OPTIONS.find((m) => m.id === modeId);
    if (!mode) return;
    const presets = mode.presets;
    setPrivacyMode(modeId);
    if (presets.l1 !== null) setCacheL1(presets.l1);
    if (presets.l2 !== null) setCacheL2(presets.l2);
    if (presets.l3 !== null) setCacheL3(presets.l3);
    const patch = { privacyMode: modeId };
    if (presets.l1 !== null) patch.cacheL1Enabled = presets.l1;
    if (presets.l2 !== null) patch.cacheL2Enabled = presets.l2;
    if (presets.l3 !== null) patch.cacheL3Enabled = presets.l3;
    patchSettings(patch, { success: `Privacy mode set to ${mode.label}` });
  };

  const handleCacheToggle = (key, value, label) => {
    if (key === "cacheL1Enabled") setCacheL1(value);
    if (key === "cacheL2Enabled") setCacheL2(value);
    if (key === "cacheL3Enabled") setCacheL3(value);
    patchSettings({ [key]: value }, { success: `${label} ${value ? "enabled" : "disabled"}` });
  };

  const handleClearCache = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    try {
      const res = await fetch("/api/cache/clear", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Clear failed");
      notify.success("Local response caches cleared");
    } catch (error) {
      console.log("Error clearing cache:", error);
      notify.error(error.message || "Failed to clear cache");
    } finally {
      setClearing(false);
    }
  };

  // Block/unblock one provider: only the settings list is patched and the local
  // state updated. Connections stay configured and active — the runtime enforces
  // the list at routing time (strict/local-only), never by disabling connections.
  const toggleBlockProvider = async (providerId) => {
    const isBlocked = blockedProviders.includes(providerId);
    const nextBlocked = isBlocked
      ? blockedProviders.filter((id) => id !== providerId)
      : [...new Set([...blockedProviders, providerId])];

    setBlockedProviders(nextBlocked);
    await patchSettings(
      { privacyBlockedProviders: nextBlocked },
      { success: isBlocked ? `${providerId} unblocked` : `${providerId} blocked` }
    );
  };

  const blockedCount = blockedProviders.length;
  const blockedConnections = connections.filter((c) => blockedProviders.includes(c.provider));
  const providerIds = [...new Set(connections.map((c) => c.provider))];
  const currentMode = MODE_OPTIONS.find((m) => m.id === privacyMode);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Privacy</h1>
          <p>
            What this router keeps on your machine, and which providers it is allowed to route to.
            Data only leaves your machine when a request goes to a provider you connected.
          </p>
        </div>
      </div>

      {/* Privacy mode */}
      <ConfigSection
        title="Privacy mode"
        icon="tune"
        subtitle="Pick a posture; it acts as a permission gate over the cache and routing controls below."
      >
        <ConfigRow
          label="Mode"
          help={currentMode?.desc}
          control={
            <SegmentedControl
              ariaLabel="Privacy mode"
              options={MODE_OPTIONS.map((m) => ({ value: m.id, label: m.label, icon: m.icon }))}
              value={privacyMode}
              onChange={handleModeChange}
            />
          }
        >
          <p className="mt-1.5 text-xs text-text-muted">
            Stored in settings as <code className="font-mono">privacyMode</code>. Behaviors a mode
            forbids stay off at runtime regardless of the toggle value below.
          </p>
        </ConfigRow>
      </ConfigSection>

      {/* Effective behavior matrix */}
      <Card
        title="Effective behavior"
        icon="table_rows"
        subtitle="What each mode does across the router's privacy-relevant behaviors."
      >
        <div className="overflow-x-auto rounded-[10px] border border-border-subtle">
          <table className="w-full border-collapse text-left text-[13px]" aria-label="Privacy mode behavior matrix">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-3 py-2 font-medium text-text-muted">
                  Behavior
                </th>
                {MODE_OPTIONS.map((m) => (
                  <th
                    key={m.id}
                    scope="col"
                    className={`whitespace-nowrap px-3 py-2 font-medium ${
                      privacyMode === m.id ? "bg-primary/10 text-primary" : "text-text-muted"
                    }`}
                  >
                    {m.label}
                    {privacyMode === m.id && <span className="ml-1.5 text-xs">current</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX_ROWS.map((row) => (
                <tr key={row.behavior} className="border-b border-border-subtle last:border-b-0">
                  <td className="px-3 py-2.5 text-text-main">{row.behavior}</td>
                  {MODE_OPTIONS.map((m) => (
                    <td
                      key={m.id}
                      className={`whitespace-nowrap px-3 py-2.5 ${
                        privacyMode === m.id ? "font-medium text-primary" : "text-text-muted"
                      }`}
                    >
                      {row.cells[m.id]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          Provider-side prompt caching (L0) is controlled by the upstream provider and its pricing —
          this router cannot force it off. The blocked-providers list is enforced at routing time in
          strict and local-only modes; local-only additionally routes only to self-hosted connections.
        </p>
      </Card>

      {/* Cache & data retention */}
      <ConfigSection
        title="Cache & data retention"
        icon="database"
        subtitle="Local response caches answer repeat requests without reaching a provider."
        action={
          <Button
            size="sm"
            variant="secondary"
            icon="delete_sweep"
            onClick={() => setShowClearConfirm(true)}
            disabled={clearing}
            loading={clearing}
          >
            Clear cache
          </Button>
        }
      >
        <ConfigRow
          label="Exact-match cache (L1)"
          help="Stores exact responses locally in memory, TTL-bounded, for deterministic non-streaming requests. Off means every identical request goes to the provider again."
          control={
            <Toggle
              checked={cacheL1}
              disabled={saving}
              onChange={() => handleCacheToggle("cacheL1Enabled", !cacheL1, "Exact-match cache")}
              ariaLabel="Exact-match cache"
            />
          }
        />
        <ConfigRow
          label="Semantic cache (L2)"
          help="Reuses responses for semantically similar requests through local embeddings. Off by default: it retains more data and needs a configured embedding model."
          control={
            <Toggle
              checked={cacheL2}
              disabled={saving}
              onChange={() => handleCacheToggle("cacheL2Enabled", !cacheL2, "Semantic cache")}
              ariaLabel="Semantic cache"
            />
          }
        />
        <ConfigRow
          label="Content dedup (L3)"
          help="Rewrites repeated large blocks in the last message as compact references. Off by default because it modifies the request body."
          control={
            <Toggle
              checked={cacheL3}
              disabled={saving}
              onChange={() => handleCacheToggle("cacheL3Enabled", !cacheL3, "Content dedup")}
              ariaLabel="Content dedup"
            />
          }
        />
        <p className="pt-4 text-xs leading-relaxed text-text-muted">
          Caches are in-memory and bounded — entries expire automatically.{" "}
          <strong className="font-medium text-text-main">Clear cache</strong> empties L1/L2/L3
          immediately. With every layer off, the router retains nothing between requests. Modes that
          force caching off override these toggles at runtime.
        </p>
      </ConfigSection>

      {/* Blocked providers */}
      <ConfigSection
        title="Blocked providers"
        icon="block"
        subtitle="Blocked providers are never routed to in strict and local-only modes. Blocking only stops routing — connections stay configured and active."
        action={
          providerIds.length > 0 ? (
            <div className="flex items-center gap-2">
              <Badge variant={blockedCount > 0 ? "error" : "default"} size="sm">
                {blockedCount} blocked
              </Badge>
              {blockedCount > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    providerIds.forEach((p) => {
                      if (blockedProviders.includes(p)) toggleBlockProvider(p);
                    });
                  }}
                >
                  Unblock all
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {connections.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <Icon name="link_off" className="text-[22px] text-text-muted" />
            <p className="text-[13px] text-text-muted">
              No provider connections configured yet, so there is nothing to block.
            </p>
            <Link href="/dashboard/providers" className="text-[13px] text-primary hover:underline">
              Add a provider connection
            </Link>
          </div>
        ) : (
          <>
            {providerIds.map((providerId) => {
              const conns = connections.filter((c) => c.provider === providerId);
              const isBlocked = blockedProviders.includes(providerId);
              return (
                <ConfigRow
                  key={providerId}
                  label={conns[0]?.name || providerId}
                  badge={
                    <>
                      <code className="font-mono text-[11px] text-text-muted">{providerId}</code>
                      {conns.length > 1 && (
                        <span className="text-xs text-text-muted">{conns.length} connections</span>
                      )}
                      {isBlocked && (
                        <Badge variant="error" size="sm" icon="block">
                          Blocked
                        </Badge>
                      )}
                    </>
                  }
                  help={
                    conns
                      .map((c) => AUTH_LABELS[c.authType] || c.authType)
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .join(", ") || "No auth type"
                  }
                  control={
                    <Toggle
                      size="sm"
                      checked={!isBlocked}
                      disabled={saving}
                      onChange={() => toggleBlockProvider(providerId)}
                      ariaLabel={`${providerId} routing`}
                      title={isBlocked ? "Unblock provider" : "Block provider"}
                    />
                  }
                />
              );
            })}
            {blockedConnections.length > 0 && (
              <p className="pt-3 text-xs leading-relaxed text-text-muted">
                Blocking stops the router sending requests to that provider in strict and local-only
                modes; connections remain configured and active. The list is stored in settings as{" "}
                <code className="font-mono">privacyBlockedProviders</code>.
              </p>
            )}
          </>
        )}
      </ConfigSection>

      {/* Training disclosure */}
      <Card title="Training & your data" icon="school">
        <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-text-muted">
          <p>
            This router cannot force an external provider to exclude your data from training. Once a
            request reaches a provider, that provider&apos;s terms govern what it does with the data —
            not this router.
          </p>
          <p className="font-medium text-text-main">What you can control</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="font-medium text-text-main">Don&apos;t send it</strong> — block
              providers above (enforced in strict and local-only modes) or remove their connections.
              This is the only guarantee that a provider never sees the data.
            </li>
            <li>
              <strong className="font-medium text-text-main">Don&apos;t retain it locally</strong> —
              disable every cache layer and clear the cache above; the router then keeps nothing
              between requests.
            </li>
            <li>
              <strong className="font-medium text-text-main">Keep it local</strong> — self-hosted
              providers (whisper.cpp, llama.cpp, vLLM, Kokoro) never leave your machine, and
              local-only mode restricts routing to them.
            </li>
          </ul>
        </div>
      </Card>

      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearCache}
        title="Clear local response caches"
        message="Empties the in-memory L1/L2/L3 caches now. The next identical request will be sent to the provider again. Continue?"
        confirmText="Clear cache"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
