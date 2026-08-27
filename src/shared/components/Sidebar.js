"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/shared/utils/cn";
import { APP_CONFIG, UPDATER_CONFIG } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS } from "@/shared/constants/providers";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import Button from "./Button";
import { ConfirmModal } from "./Modal";


// const VISIBLE_MEDIA_KINDS = ["embedding", "image", "imageToText", "tts", "stt", "webSearch", "webFetch", "video", "music"];
const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];
// Combined entry: webSearch + webFetch share one page at /dashboard/media-providers/web
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };

// ── Navigation sections ──────────────────────────────────────────────
// Each item: { href, label, icon, comingSoon? }
// comingSoon items render as disabled with a "Soon" badge.

const coreItems = [
  { href: "/dashboard/endpoint", label: "Endpoint & Key", icon: "api" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/health", label: "Health", icon: "ecg_heart" },
  { href: "/dashboard/runtime", label: "Runtime", icon: "memory" },
];

// Sidebar-only version label (product decision; intentionally independent of
// the package.json version shown by /api/version).
const SIDEBAR_VERSION = "V1.0.5";

const analyticsItems = [
  { href: "/dashboard/usage", label: "Usage + Cache", icon: "bar_chart" },
  { href: "/dashboard/quota", label: "Quota Tracker", icon: "data_usage" },
  { href: "/dashboard/provider-stats", label: "Provider Stats", icon: "analytics" },
  { href: "/dashboard/activity", label: "Activity", icon: "history" },
  { href: "/dashboard/logs", label: "Logs", icon: "receipt_long" },
  { href: "/dashboard/costs", label: "Costs", icon: "payments" },
];

const configItems = [
  { href: "/dashboard/free-tiers", label: "Free Tiers", icon: "redeem" },
  { href: "/dashboard/privacy", label: "Privacy", icon: "privacy_tip" },
  { href: "/dashboard/combos", label: "Combo & Vision Adapter", icon: "layers" },
  { href: "/dashboard/token-saver", label: "Token Saver", icon: "savings" },
  { href: "/dashboard/settings/feature-flags", label: "Feature Flags", icon: "flag" },
  { href: "/dashboard/cache", label: "Cache", icon: "cached" },
  { href: "/dashboard/guardrails", label: "Guardrails", icon: "verified_user" },
];

const toolItems = [
  { href: "/dashboard/pxpipe", label: "PXPIPE", icon: "image" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
  { href: "/dashboard/playground", label: "Playground", icon: "science" },
  { href: "/dashboard/memory", label: "Memory", icon: "psychology" },
];

const integrationItems = [
  { href: "/dashboard/mcp", label: "MCP", icon: "cable" },
    { href: "/dashboard/a2a", label: "A2A", icon: "swap_horiz" },
  { href: "/dashboard/batch", label: "Batch", icon: "batch_prediction" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "webhook" },
  { href: "/dashboard/api-endpoints", label: "API Endpoints", icon: "api" },
];

const agentItems = [
  { href: "/dashboard/cloud-agents", label: "Agent Registry", icon: "cloud" },
  { href: "/dashboard/agent-skills", label: "Agent Skills", icon: "smart_toy" },
  { href: "/dashboard/discovery", label: "Discovery", icon: "explore" },
  { href: "/dashboard/skill-discovery", label: "Skill Discovery", icon: "rocket_launch" },
  { href: "/dashboard/skills", label: "Skills", icon: "extension" },
];

const debugItems = [
  { href: "/dashboard/console-log", label: "Console Log", icon: "terminal" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];

const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
];

// ── Nav item renderer ────────────────────────────────────────────────
function NavItem({ item, active, onClick, indented }) {
  const base = cn(
    "nav-item group",
    indented && "pl-8",
    active && "nav-item-active",
    item.comingSoon && "opacity-50 cursor-not-allowed pointer-events-none"
  );

  const iconClass = cn(
    "material-symbols-outlined",
    indented ? "text-[16px]" : "text-[18px]",
    active ? "fill-1" : !item.comingSoon && "group-hover:text-primary transition-colors"
  );

  const content = (
    <>
      <span className={iconClass}>{item.icon}</span>
      <span className={cn("font-medium", indented ? "text-sm" : "text-[13px]", "flex-1")}>{item.label}</span>
      {item.comingSoon && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-bg-hover text-text-muted border border-border-subtle select-none">
          Soon
        </span>
      )}
    </>
  );

  if (item.comingSoon) {
    return <div className={base}>{content}</div>;
  }

  return (
    <Link href={item.href} onClick={onClick} className={base}>
      {content}
    </Link>
  );
}

function NavSection({ title, items, pathname, onClose, open: defaultOpen = true }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const hasActive = items.some((it) => !it.comingSoon && pathname.startsWith(it.href));

  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="label px-3 mb-1 flex items-center gap-1 w-full hover:text-text-main transition-colors cursor-pointer"
      >
        {title}
        <span
          className="material-symbols-outlined text-[14px] transition-transform"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          expand_more
        </span>
      </button>
      {expanded && items.map((item) => (
        <NavItem
          key={item.href}
          item={item}
          active={!item.comingSoon && pathname.startsWith(item.href)}
          onClick={onClose}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ onClose }) {
  const pathname = usePathname();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const { copied, copy } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => { if (data.enableTranslator) setEnableTranslator(true); })
      .catch(() => {});
  }, []);

  // Lazy check for new npm version on mount
  useEffect(() => {
    fetch("/api/version")
      .then(res => res.json())
      .then(data => { if (data.hasUpdate) setUpdateInfo(data); })
      .catch(() => {});
  }, []);

  const isActive = (href) => {
    if (href === "/dashboard/endpoint") {
      return pathname === "/dashboard" || pathname.startsWith("/dashboard/endpoint");
    }
    if (href === "/dashboard/free-tiers") {
      return pathname.startsWith("/dashboard/free-tiers") || pathname.startsWith("/dashboard/free-provider-rankings");
    }
    return pathname.startsWith(href);
  };

  // Open manual update panel (no countdown yet — user must click Copy to trigger shutdown)
  const handleUpdate = () => {
    setShowUpdateModal(false);
    setIsUpdating(true);
  };

  // Triggered by Copy button inside ManualUpdatePanel: copy + countdown + shutdown
  const handleCopyAndShutdown = async () => {
    try { await navigator.clipboard.writeText(INSTALL_CMD); } catch { /* clipboard blocked */ }
    copy(INSTALL_CMD);
    let remaining = UPDATER_CONFIG.shutdownCountdownSec;
    setShutdownCountdown(remaining);
    const timer = setInterval(() => {
      remaining -= 1;
      setShutdownCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        fetch("/api/version/shutdown", { method: "POST" }).catch(() => {});
        setIsDisconnected(true);
      }
    }, 1000);
  };

  const handleCancelUpdate = () => {
    setIsUpdating(false);
    setShutdownCountdown(0);
  };

  // Note: legacy updater poll removed. New flow: copy install cmd + shutdown server,
  // user runs the command manually in another terminal.


  return (
    <>
      <aside className="flex w-64 flex-col border-r border-border-subtle bg-sidebar transition-colors duration-300 min-h-full">
        {/* Logo */}
        <div className="px-5 py-5 flex flex-col gap-2">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex items-center justify-center size-8 rounded-[var(--radius-brand)] bg-gradient-to-br from-brand-500 to-brand-700 shadow-[var(--shadow-warm)]">
              <span className="material-symbols-outlined text-white text-[18px]">hub</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-semibold tracking-tight text-text-main">
                {APP_CONFIG.name}
              </h1>
              <span className="text-xs text-text-muted">{SIDEBAR_VERSION}</span>
            </div>
          </Link>
          {updateInfo && (
            <div className="flex flex-col gap-1.5 rounded p-1 -m-1">
              <span className="text-xs font-semibold text-green-600 dark:text-amber-500">
                ↑ New version available: v{updateInfo.latestVersion}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="px-2 py-1 rounded bg-green-600 hover:bg-green-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  Update now
                </button>
                <button
                  onClick={() => copy(INSTALL_CMD)}
                  title="Copy install command"
                  className="flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer min-w-0"
                >
                  <code className="block text-[10px] text-green-600/80 dark:text-amber-400/70 font-mono truncate">
                    {copied ? "✓ copied!" : INSTALL_CMD}
                  </code>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
          {/* Core */}
          {coreItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={!item.comingSoon && isActive(item.href)}
              onClick={onClose}
            />
          ))}

          {/* Analytics */}
          <NavSection
            title="Analytics"
            items={analyticsItems}
            pathname={pathname}
            onClose={onClose}
          />

          {/* Configuration */}
          <NavSection
            title="Configuration"
            items={configItems}
            pathname={pathname}
            onClose={onClose}
          />

          {/* Tools */}
          <NavSection
            title="Tools"
            items={toolItems}
            pathname={pathname}
            onClose={onClose}
          />

          {/* Integrations */}
          <NavSection
            title="Integrations"
            items={integrationItems}
            pathname={pathname}
            onClose={onClose}
          />

          {/* Agents */}
          <NavSection
            title="Agents"
            items={agentItems}
            pathname={pathname}
            onClose={onClose}
          />

          {/* System section */}
          <div className="pt-3 mt-2 space-y-1">
            <p className="label px-3 mb-1">
              System
            </p>

            {/* Media Providers accordion */}
            <button
              onClick={() => setMediaOpen((v) => !v)}
              className={cn(
                "nav-item group w-full",
                pathname.startsWith("/dashboard/media-providers") && "nav-item-active"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">perm_media</span>
              <span className="text-[13px] font-medium flex-1 text-left">Media Providers</span>
              <span className="material-symbols-outlined text-[14px] transition-transform" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                expand_more
              </span>
            </button>
            {mediaOpen && (
              <div className="flex flex-col gap-1">
                {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                  <Link
                    key={kind.id}
                    href={`/dashboard/media-providers/${kind.id}`}
                    onClick={onClose}
                    className={cn(
                      "nav-item pl-8 group",
                      pathname.startsWith(`/dashboard/media-providers/${kind.id}`) && "nav-item-active"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">{kind.icon}</span>
                    <span className="text-sm">{kind.label}</span>
                  </Link>
                ))}
                <Link
                  key={COMBINED_WEB_ITEM.id}
                  href={COMBINED_WEB_ITEM.href}
                  onClick={onClose}
                  className={cn(
                    "nav-item pl-8 group",
                    pathname.startsWith(COMBINED_WEB_ITEM.href) && "nav-item-active"
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">{COMBINED_WEB_ITEM.icon}</span>
                  <span className="text-sm">{COMBINED_WEB_ITEM.label}</span>
                </Link>
              </div>
            )}

            {systemItems.map((item) => (
              <NavItem
                key={item.href}
                item={item}
                active={isActive(item.href)}
                onClick={onClose}
              />
            ))}

            {/* Debug items (inside System section, before Settings) */}
            {debugItems.map((item) => {
              const show = item.href !== "/dashboard/translator" || enableTranslator;
              return show ? (
                <NavItem
                  key={item.href}
                  item={item}
                  active={isActive(item.href)}
                  onClick={onClose}
                />
              ) : null;
            })}

            {/* Settings */}
            <NavItem
              item={{ href: "/dashboard/profile", label: "Settings", icon: "settings" }}
              active={isActive("/dashboard/profile")}
              onClick={onClose}
            />
          </div>
        </nav>

      </aside>

      {/* Update Confirmation Modal */}
      <ConfirmModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        onConfirm={handleUpdate}
        title="Update MiawRouter"
        message={`Show install command for v${updateInfo?.latestVersion || ""}? You can copy it and shutdown to install manually.`}
        confirmText="Show Command"
        cancelText="Cancel"
        variant="primary"
      />

      {/* Disconnected / Updating Overlay */}
      {(isDisconnected || isUpdating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          {isUpdating ? (
            <ManualUpdatePanel
              latestVersion={updateInfo?.latestVersion}
              installCmd={INSTALL_CMD}
              copied={copied}
              onCopyAndShutdown={handleCopyAndShutdown}
              onCancel={handleCancelUpdate}
              countdown={shutdownCountdown}
              isDisconnected={isDisconnected}
            />
          ) : (
            <div className="text-center p-8">
              <div className="flex items-center justify-center size-16 rounded-full bg-red-500/20 text-red-500 mx-auto mb-4">
                <span className="material-symbols-outlined text-[32px]">power_off</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Server Disconnected</h2>
              <p className="text-text-muted mb-6">The proxy server has been stopped.</p>
              <Button variant="secondary" onClick={() => globalThis.location.reload()}>
                Reload Page
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

Sidebar.propTypes = {
  onClose: PropTypes.func,
};

function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-xl bg-neutral-900/95 border border-white/10 p-6 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center size-11 rounded-full bg-amber-500/20 text-amber-400">
          <span className="material-symbols-outlined text-[24px]">content_copy</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Update MiawRouter{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p className="text-xs text-white/60">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="text-sm text-white/80 mb-2">Install command:</p>
      <div className="w-full px-3 py-2 rounded bg-white/5 mb-4">
        <code className="text-xs font-mono text-amber-400 break-all">{installCmd}</code>
      </div>

      <ol className="text-xs text-white/70 space-y-1 list-decimal list-inside mb-4">
        <li>Click <strong>Copy & Shutdown</strong> below.</li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>Run <code className="px-1 rounded bg-white/10 text-green-400">miawrouter</code> again after install.</li>
      </ol>

      {isDisconnected ? (
        <Button variant="secondary" fullWidth onClick={() => globalThis.location.reload()}>
          Reload Page
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isCountingDown}>
            Cancel
          </Button>
          <Button variant="primary" fullWidth onClick={onCopyAndShutdown} disabled={isCountingDown}>
            {copied ? "✓ Copied — shutting down..." : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
          </Button>
        </div>
      )}
    </div>
  );
}

ManualUpdatePanel.propTypes = {
  latestVersion: PropTypes.string,
  installCmd: PropTypes.string.isRequired,
  copied: PropTypes.bool,
  onCopyAndShutdown: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  countdown: PropTypes.number,
  isDisconnected: PropTypes.bool,
};
