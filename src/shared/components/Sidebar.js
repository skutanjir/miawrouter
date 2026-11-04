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
import BrandAsset from "./BrandAsset";


import { Icon } from "@/shared/components/Icon";
// const VISIBLE_MEDIA_KINDS = ["embedding", "image", "imageToText", "tts", "stt", "webSearch", "webFetch", "video", "music"];
const VISIBLE_MEDIA_KINDS = ["embedding", "image", "video", "tts", "stt"];
// Combined entry: webSearch + webFetch share one page at /dashboard/media-providers/web
const COMBINED_WEB_ITEM = { id: "web", label: "Web Fetch & Search", icon: "travel_explore", href: "/dashboard/media-providers/web" };

// ── Navigation sections ──────────────────────────────────────────────
// Each item: { href, label, icon, comingSoon? }
// comingSoon items render as disabled with a "Soon" badge.

const coreItems = [
  { href: "/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/dashboard/endpoint", label: "Endpoint & Key", icon: "vpn_key" },
  { href: "/dashboard/providers", label: "Providers", icon: "dns" },
  { href: "/dashboard/health", label: "Health", icon: "ecg_heart" },
  { href: "/dashboard/runtime", label: "Runtime", icon: "memory" },
];

const SIDEBAR_VERSION = `V${APP_CONFIG.version}`;

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
  { href: "/dashboard/settings/pricing", label: "Pricing", icon: "price_change" },
  { href: "/dashboard/cache", label: "Cache", icon: "cached" },
  { href: "/dashboard/guardrails", label: "Guardrails", icon: "verified_user" },
];

const toolItems = [
  { href: "/dashboard/pxpipe", label: "PXPIPE", icon: "image" },
  { href: "/dashboard/cli-tools", label: "CLI Tools", icon: "terminal" },
  { href: "/dashboard/playground", label: "Playground", icon: "science" },
  { href: "/dashboard/basic-chat", label: "Basic Chat", icon: "chat" },
  { href: "/dashboard/mitm", label: "MITM", icon: "shield" },
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
  { href: "/dashboard/console-log", label: "Console Log", icon: "monitor" },
  { href: "/dashboard/translator", label: "Translator", icon: "translate" },
];

const systemItems = [
  { href: "/dashboard/proxy-pools", label: "Proxy Pools", icon: "lan" },
];

// ── Nav item renderer ────────────────────────────────────────────────
function NavItem({ item, active, onClick, indented, compact = false }) {
  const base = cn(
    "nav-item group",
    indented && "pl-6 py-1.5 min-h-[32px]",
    compact && "py-1.5 min-h-[33px]",
    active && "nav-item-active",
    item.comingSoon && "opacity-50 cursor-not-allowed pointer-events-none"
  );

  const content = (
    <>
      <Icon
        name={item.icon}
        weight="duotone"
        className={cn(
          "shrink-0 transition-transform duration-150 group-hover:scale-105",
          indented || compact ? "text-[15px]" : "text-[17px]",
          active
            ? "text-primary"
            : !item.comingSoon && "text-text-muted group-hover:text-primary transition-colors"
        )}
      />
      <span className={cn("truncate", indented || compact ? "text-[12.5px]" : "text-[13px]", "flex-1")}>{item.label}</span>
      {active && (
        <span className="size-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
      )}
      {item.comingSoon && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-bg-hover text-text-muted border border-border-subtle select-none">
          Soon
        </span>
      )}
    </>
  );

  if (item.comingSoon) {
    return <div className={base} title={item.label}>{content}</div>;
  }

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={base}
      aria-current={active ? "page" : undefined}
      title={item.label}
    >
      {content}
    </Link>
  );
}

function NavSection({
  title,
  icon = "folder",
  items,
  onClose,
  isActive,
  expanded,
  onToggle,
  children,
  extraCount = 0,
}) {
  const hasActiveChild = items.some((item) => !item.comingSoon && isActive(item.href));
  const totalCount = items.length + extraCount;

  return (
    <div className="rounded-lg transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all cursor-pointer group",
          expanded
            ? "bg-surface-2 text-text-main font-semibold shadow-2xs border border-border"
            : hasActiveChild
              ? "bg-surface-2/60 text-text-main font-semibold border border-border-subtle"
              : "text-text-muted hover:bg-surface-2/60 hover:text-text-main border border-transparent"
        )}
        aria-expanded={expanded}
        title={title}
      >
        <span
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md border transition-colors",
            expanded || hasActiveChild
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border-subtle bg-surface text-text-muted group-hover:text-text-main"
          )}
        >
          <Icon name={icon} className="text-[14px]" />
        </span>
        <span className="text-[13px] tracking-tight flex-1 truncate">{title}</span>
        {hasActiveChild && !expanded && (
          <span className="size-1.5 rounded-full bg-primary shrink-0" title="Active page in section" />
        )}
        <span className="nav-section-count">{totalCount}</span>
        <Icon
          name="expand_more"
          className="text-[13px] text-text-muted/80 transition-transform duration-150 shrink-0"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {expanded && (
        <div className="mt-1 ml-3.5 pl-2.5 border-l border-border space-y-0.5 py-0.5">
          {items.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              compact
              active={!item.comingSoon && isActive(item.href)}
              onClick={onClose}
            />
          ))}
          {children}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ onClose, forceExpanded = false }) {
  const pathname = usePathname();
  const [navQuery, setNavQuery] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [localEndpoint, setLocalEndpoint] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [shutdownCountdown, setShutdownCountdown] = useState(0);
  const [enableTranslator, setEnableTranslator] = useState(false);
  const [openSection, setOpenSection] = useState("core");
  const { copied, copy } = useCopyToClipboard(2000);
  const { copied: endpointCopied, copy: copyEndpoint } = useCopyToClipboard(2000);

  const INSTALL_CMD = UPDATER_CONFIG.installCmdLatest;

  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setCollapsed(localStorage.getItem("miawrouter-sidebar-collapsed") === "true");
      setLocalEndpoint(new URL("/v1", window.location.origin).toString());
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem("miawrouter-sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => { if (data.enableTranslator) setEnableTranslator(true); })
      .catch(() => {});
  }, []);

  // Defer version check — not needed for first paint (keeps refresh snappy)
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      fetch("/api/version")
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled && data.hasUpdate) setUpdateInfo(data);
        })
        .catch(() => {});
    };
    let idleId;
    let timeoutId;
    if (typeof requestIdleCallback === "function") {
      idleId = requestIdleCallback(run, { timeout: 4000 });
    } else {
      timeoutId = setTimeout(run, 2500);
    }
    return () => {
      cancelled = true;
      if (idleId != null && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
    };
  }, []);


  const isActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/endpoint") {
      return pathname.startsWith("/dashboard/endpoint");
    }
    if (href === "/dashboard/free-tiers") {
      return pathname.startsWith("/dashboard/free-tiers") || pathname.startsWith("/dashboard/free-provider-rankings");
    }
    return pathname.startsWith(href);
  };

  // Automatically sync the single active menu folder when route changes
  useEffect(() => {
    if (pathname.startsWith("/dashboard/media-providers")) {
      setOpenSection("system");
      setMediaOpen(true);
      return;
    }
    if (analyticsItems.some((i) => isActive(i.href))) {
      setOpenSection("analytics");
    } else if (configItems.some((i) => isActive(i.href))) {
      setOpenSection("config");
    } else if (toolItems.some((i) => isActive(i.href))) {
      setOpenSection("tools");
    } else if (integrationItems.some((i) => isActive(i.href))) {
      setOpenSection("integrations");
    } else if (agentItems.some((i) => isActive(i.href))) {
      setOpenSection("agents");
    } else if (
      systemItems.some((i) => isActive(i.href)) ||
      debugItems.some((i) => isActive(i.href)) ||
      isActive("/dashboard/profile")
    ) {
      setOpenSection("system");
    } else if (coreItems.some((i) => isActive(i.href))) {
      setOpenSection("core");
    }
  }, [pathname]);

  const toggleSection = (key) => {
    setOpenSection((prev) => (prev === key ? "" : key));
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

  const visibleDebugItems = debugItems.filter(
    (item) => item.href !== "/dashboard/translator" || enableTranslator
  );

  // Quick-access pinned shortcuts so the user can jump anywhere with 1 click
  const quickHubLinks = [
    { href: "/dashboard", label: "Overview", icon: "dashboard" },
    { href: "/dashboard/usage", label: "Usage & Routing", icon: "bar_chart" },
    { href: "/dashboard/providers", label: "Providers", icon: "dns" },
    { href: "/dashboard/endpoint", label: "Endpoint", icon: "vpn_key" },
  ];

  return (
    <>
      <aside className={`sidebar-shell flex ${collapsed && !forceExpanded ? "sidebar-collapsed w-[68px]" : "w-[256px]"} h-full flex-col transition-[width] duration-150`}>
        <div className="sidebar-brand flex flex-col gap-2 px-3.5 py-3">
          <div className="flex items-center gap-2.5">
            <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5" title="MiawRouter dashboard">
              <div className="sidebar-brand-icon flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
                <BrandAsset kind="icon" className="size-full object-contain p-0.5" />
              </div>
              <div className="sidebar-brand-copy flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-[14.5px] font-bold tracking-tight text-text-main">{APP_CONFIG.name}</h1>
                  <span className="status-dot status-dot-live" title="Gateway Active" />
                </div>
                <span className="text-[10.5px] font-mono font-medium text-text-muted">{SIDEBAR_VERSION} · AI Router</span>
              </div>
            </Link>
            <button type="button" onClick={toggleCollapsed} className="sidebar-collapse-toggle inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text-main" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
              <Icon name={collapsed ? "chevron_right" : "chevron_left"} className="text-[15px]" />
            </button>
          </div>
          {updateInfo && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-primary/25 bg-primary/5 p-2 mt-1">
              <div className="flex items-center gap-1.5">
                <Icon name="rocket_launch" className="text-[14px] text-primary" />
                <span className="text-xs font-semibold text-primary">
                  Update available: v{updateInfo.latestVersion}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowUpdateModal(true)}
                  className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-bg transition-colors hover:bg-primary-hover"
                >
                  Update now
                </button>
                <button
                  onClick={() => copy(INSTALL_CMD)}
                  title="Copy install command"
                  className="min-w-0 flex-1 cursor-pointer text-left transition-opacity hover:opacity-80"
                >
                  <code className="block truncate font-mono text-[10px] text-text-muted">
                    {copied ? "Copied" : INSTALL_CMD}
                  </code>
                </button>
              </div>
            </div>
          )}
        </div>

        <label className="sidebar-search">
          <Icon name={"search"} className="text-[15px] text-text-muted shrink-0" aria-hidden="true" />
          <input
            aria-label="Search navigation"
            placeholder="Jump to menu…"
            value={navQuery}
            onChange={(event) => setNavQuery(event.target.value)}
          />
          {navQuery && (
            <button type="button" aria-label="Clear navigation search" onClick={() => setNavQuery("")} className="text-text-muted hover:text-text-main">
              <Icon name={"close"} className="text-[14px]" />
            </button>
          )}
        </label>
        <div className="sidebar-endpoint-row">
          <Icon name="hub" weight="duotone" className="text-[14px] text-primary shrink-0" />
          <span className="sr-only">Local endpoint</span>
          <code className="min-w-0 flex-1 truncate font-mono text-[11px] font-medium text-text-main" title={localEndpoint}>
            {localEndpoint}
          </code>
          <button
            type="button"
            onClick={() => copyEndpoint(localEndpoint)}
            disabled={!localEndpoint}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-primary disabled:opacity-50"
            aria-label="Copy local endpoint"
            title="Copy local endpoint"
          >
            <Icon name={endpointCopied ? "check" : "content_copy"} className={cn("text-[13px]", endpointCopied && "text-success")} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-2 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navQuery.trim() ? (() => {
            const items = [
              ...coreItems, ...analyticsItems, ...configItems, ...toolItems,
              ...integrationItems, ...agentItems, ...systemItems,
              ...debugItems.filter((item) => item.href !== "/dashboard/translator" || enableTranslator),
              ...MEDIA_PROVIDER_KINDS.filter((kind) => VISIBLE_MEDIA_KINDS.includes(kind.id)).map((kind) => ({ ...kind, href: `/dashboard/media-providers/${kind.id}` })),
              COMBINED_WEB_ITEM,
              { href: "/dashboard/profile", label: "Settings", icon: "settings" },
            ].filter((item) => item.label.toLowerCase().includes(navQuery.trim().toLowerCase()));
            return items.length ? items.map((item) => <NavItem key={item.href} item={item} active={isActive(item.href)} onClick={onClose} />) : <p className="p-3 text-xs text-text-muted" role="status">No features found. Try CLI, MITM, or providers.</p>;
          })() : <>
          {/* Compact 2x2 Quick Hub Grid (when not collapsed) */}
          {(!collapsed || forceExpanded) && (
            <div className="mb-2 rounded-xl border border-border bg-surface/70 p-1.5">
              <div className="flex items-center justify-between px-1.5 pb-1">
                <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted">
                  Quick Access
                </span>
                <span className="text-[10px] font-mono text-text-subtle">1-Click Hub</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {quickHubLinks.map((q) => {
                  const active = isActive(q.href);
                  return (
                    <Link
                      key={q.href}
                      href={q.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] font-medium transition-all truncate",
                        active
                          ? "bg-surface-2 text-text-main font-semibold border border-border shadow-2xs"
                          : "text-text-muted hover:bg-surface-2/70 hover:text-text-main border border-transparent"
                      )}
                      title={q.label}
                    >
                      <Icon name={q.icon} className={cn("text-[13px] shrink-0", active ? "text-primary" : "text-text-muted")} />
                      <span className="truncate">{q.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unified Single-Open Menu Hub ("Satu Menu Rapi Kemana-Mana") */}
          <div className="space-y-1">
            {(!collapsed || forceExpanded) && (
              <div className="flex items-center justify-between px-2 py-0.5">
                <span className="sidebar-section-caption text-text-muted">Console Menu</span>
                <span className="text-[10px] font-mono text-text-subtle">Accordion</span>
              </div>
            )}

            <NavSection
              title="Core & Gateway"
              icon="dashboard"
              items={coreItems}
              isActive={isActive}
              onClose={onClose}
              expanded={openSection === "core"}
              onToggle={() => toggleSection("core")}
            />

            <NavSection
              title="Usage & Analytics"
              icon="bar_chart"
              items={analyticsItems}
              isActive={isActive}
              onClose={onClose}
              expanded={openSection === "analytics"}
              onToggle={() => toggleSection("analytics")}
            />

            <NavSection
              title="Routing & Config"
              icon="tune"
              items={configItems}
              isActive={isActive}
              onClose={onClose}
              expanded={openSection === "config"}
              onToggle={() => toggleSection("config")}
            />

            <NavSection
              title="Workspace Tools"
              icon="terminal"
              items={toolItems}
              isActive={isActive}
              onClose={onClose}
              expanded={openSection === "tools"}
              onToggle={() => toggleSection("tools")}
            />

            <NavSection
              title="Integrations & API"
              icon="cable"
              items={integrationItems}
              isActive={isActive}
              onClose={onClose}
              expanded={openSection === "integrations"}
              onToggle={() => toggleSection("integrations")}
            />

            <NavSection
              title="Agents & Skills"
              icon="smart_toy"
              items={agentItems}
              isActive={isActive}
              onClose={onClose}
              expanded={openSection === "agents"}
              onToggle={() => toggleSection("agents")}
            />

            <NavSection
              title="System & Media"
              icon="settings"
              items={[
                ...systemItems,
                ...visibleDebugItems,
                { href: "/dashboard/profile", label: "Settings", icon: "settings" },
              ]}
              extraCount={1}
              isActive={(href) => isActive(href) || pathname.startsWith("/dashboard/media-providers")}
              onClose={onClose}
              expanded={openSection === "system"}
              onToggle={() => toggleSection("system")}
            >
              {/* Media Providers nested submenu */}
              <button
                type="button"
                onClick={() => setMediaOpen((v) => !v)}
                aria-expanded={mediaOpen}
                aria-controls="sidebar-media-provider-links"
                aria-label="Toggle media provider navigation"
                title="Media Providers"
                className={cn(
                  "nav-item py-1.5 min-h-[33px] group w-full",
                  pathname.startsWith("/dashboard/media-providers") && "nav-item-active"
                )}
              >
                <Icon name="perm_media" weight="duotone" className="text-[15px] text-text-muted group-hover:text-primary shrink-0" />
                <span className="text-[12.5px] font-medium flex-1 text-left truncate">Media Providers</span>
                <Icon name="expand_more" className="text-[12px] text-text-muted/70 transition-transform duration-150" style={{ transform: mediaOpen ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {mediaOpen && (
                <div id="sidebar-media-provider-links" className="space-y-0.5 mt-0.5 ml-3 pl-2 border-l border-border-subtle">
                  {MEDIA_PROVIDER_KINDS.filter((k) => VISIBLE_MEDIA_KINDS.includes(k.id)).map((kind) => (
                    <Link
                      key={kind.id}
                      href={`/dashboard/media-providers/${kind.id}`}
                      title={kind.label}
                      onClick={onClose}
                      className={cn(
                        "nav-item py-1 min-h-[30px] pl-3 group",
                        pathname.startsWith(`/dashboard/media-providers/${kind.id}`) && "nav-item-active"
                      )}
                    >
                      <Icon name={kind.icon} weight="duotone" className="text-[14px] shrink-0" />
                      <span className="text-xs truncate">{kind.label}</span>
                    </Link>
                  ))}
                  <Link
                    key={COMBINED_WEB_ITEM.id}
                    href={COMBINED_WEB_ITEM.href}
                    title={COMBINED_WEB_ITEM.label}
                    onClick={onClose}
                    className={cn(
                      "nav-item py-1 min-h-[30px] pl-3 group",
                      pathname.startsWith(COMBINED_WEB_ITEM.href) && "nav-item-active"
                    )}
                  >
                    <Icon name={COMBINED_WEB_ITEM.icon} weight="duotone" className="text-[14px] shrink-0" />
                    <span className="text-xs truncate">{COMBINED_WEB_ITEM.label}</span>
                  </Link>
                </div>
              )}
            </NavSection>
          </div>
          </>}
        </nav>

        {/* Pinned Footer Bar */}
        {(!collapsed || forceExpanded) && (
          <div className="border-t border-border-subtle px-3 py-2.5 flex items-center justify-between gap-2 bg-surface/40 mt-auto shrink-0">
            <Link
              href="/dashboard/profile"
              onClick={onClose}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors flex-1",
                isActive("/dashboard/profile")
                  ? "bg-surface-2 text-text-main font-semibold border border-border"
                  : "text-text-muted hover:bg-surface-2 hover:text-text-main"
              )}
            >
              <Icon name="settings" className="text-[14px]" />
              <span>Settings</span>
            </Link>
            <Link
              href="/dashboard/health"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-[11px] font-mono text-text-muted hover:text-text-main transition-colors"
              title="System Health"
            >
              <span className="status-dot status-dot-live" />
              <span>Online</span>
            </Link>
          </div>
        )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
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
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-danger/10 text-danger">
                <Icon name="power_off" className="text-[32px]" />
              </div>
              <h2 className="mb-2 text-xl font-semibold text-text-main">Server Disconnected</h2>
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



function ManualUpdatePanel({ latestVersion, installCmd, copied, onCopyAndShutdown, onCancel, countdown, isDisconnected }) {
  const isCountingDown = countdown > 0;
  return (
    <div className="w-full max-w-lg rounded-[14px] border border-border bg-surface p-6 text-text-main shadow-elevated">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-warning/10 text-warning">
          <Icon name="content_copy" className="text-[20px]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Update MiawRouter{latestVersion ? ` to v${latestVersion}` : ""}</h2>
          <p className="text-xs text-text-muted">
            {isDisconnected
              ? "Server stopped. Paste the command into a terminal to install."
              : isCountingDown
                ? `Command copied. Server will stop in ${countdown}s...`
                : "Click the button below to copy the install command and shutdown."}
          </p>
        </div>
      </div>

      <p className="mb-2 text-sm">Install command:</p>
      <div className="mb-4 w-full rounded-md bg-surface-2 px-3 py-2">
        <code className="break-all font-mono text-xs text-warning">{installCmd}</code>
      </div>

      <ol className="mb-4 list-inside list-decimal space-y-1 text-xs text-text-muted">
        <li>Click <strong>Copy &amp; Shutdown</strong> below.</li>
        <li>Paste the command into your terminal and press Enter.</li>
        <li>Run <code className="rounded bg-surface-2 px-1 text-success">miawrouter</code> again after install.</li>
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
            {copied ? "Copied. Shutting down..." : isCountingDown ? `Shutting down in ${countdown}s` : "Copy & Shutdown"}
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
Sidebar.propTypes = {
  onClose: PropTypes.func,
  forceExpanded: PropTypes.bool,
};
