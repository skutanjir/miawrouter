"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderIcon from "@/shared/components/ProviderIcon";
import HeaderMenu from "@/shared/components/HeaderMenu";
import HeaderLanguage from "@/shared/components/HeaderLanguage";
import ThemeToggle from "@/shared/components/ThemeToggle";
import { useHeaderSearchStore } from "@/store/headerSearchStore";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { MEDIA_PROVIDER_KINDS, AI_PROVIDERS } from "@/shared/constants/providers";
import { getProviderIconSrc } from "@/shared/utils/providerIcon";
import { translate } from "@/i18n/runtime";

import { Icon } from "@/shared/components/Icon";
const getPageInfo = (pathname) => {
  if (!pathname) return { title: "", description: "", breadcrumbs: [] };

  // Media provider detail: /dashboard/media-providers/[kind]/[id]
  const mediaDetailMatch = pathname.match(/\/media-providers\/([^/]+)\/([^/]+)$/);
  if (mediaDetailMatch) {
    const kindId = mediaDetailMatch[1];
    const providerId = mediaDetailMatch[2];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    const provider = AI_PROVIDERS[providerId];
    return {
      title: provider?.name || providerId,
      description: "",
      breadcrumbs: [
        { label: "Media Providers", href: `/dashboard/media-providers/${kindId}` },
        { label: kindConfig?.label || kindId, href: `/dashboard/media-providers/${kindId}` },
        { label: provider?.name || providerId, image: getProviderIconSrc(providerId) },
      ],
    };
  }

  // Media provider kind: /dashboard/media-providers/[kind]
  const mediaKindMatch = pathname.match(/\/media-providers\/([^/]+)$/);
  if (mediaKindMatch) {
    const kindId = mediaKindMatch[1];
    const kindConfig = MEDIA_PROVIDER_KINDS.find((k) => k.id === kindId);
    return {
      title: kindConfig?.label || kindId,
      description: `Manage your ${kindConfig?.label || kindId} providers`,
      icon: kindConfig?.icon || "perm_media",
      breadcrumbs: [],
    };
  }

  // Provider detail page: /dashboard/providers/[id]
  const providerMatch = pathname.match(/\/providers\/([^/]+)$/);
  if (providerMatch) {
    const providerId = providerMatch[1];
    const providerInfo =
      OAUTH_PROVIDERS[providerId] || APIKEY_PROVIDERS[providerId];
    if (providerInfo) {
      return {
        title: providerInfo.name,
        description: "",
        breadcrumbs: [
          { label: "Providers", href: "/dashboard/providers" },
          {
            label: providerInfo.name,
            image: getProviderIconSrc(providerInfo.id),
          },
        ],
      };
    }
  }

  if (pathname.includes("/providers") && !pathname.includes("/media-providers"))
    return {
      title: "Providers",
      description: "Manage your AI provider connections",
      icon: "dns",
      breadcrumbs: [],
    };
  if (pathname.includes("/combos"))
    return {
      title: "Combos",
      description: "Manage model fallback and routing groups",
      icon: "layers",
      breadcrumbs: [],
    };
  if (pathname.includes("/usage"))
    return {
      title: "Usage + Cache",
      description:
        "Monitor API usage, cache layers, token consumption, and request logs",
      icon: "bar_chart",
      breadcrumbs: [],
    };
  if (pathname.includes("/auth-files"))
    return {
      title: "Auth Files",
      description: "Map provider credentials stored in the local database",
      icon: "vpn_key",
      breadcrumbs: [],
    };
  if (pathname.includes("/quota"))
    return {
      title: "Quota Tracker",
      description: "Track and manage your API quota limits",
      icon: "data_usage",
      breadcrumbs: [],
    };
  if (pathname.includes("/mitm"))
    return {
      title: "MITM Proxy",
      description: "Intercept CLI tool traffic and route through MiawRouter",
      icon: "security",
      breadcrumbs: [],
    };
  if (pathname.includes("/token-saver"))
    return {
      title: "Token Saver",
      description: "Compress prompts and outputs to save tokens",
      icon: "savings",
      breadcrumbs: [],
    };
  if (pathname.includes("/cli-tools"))
    return {
      title: "CLI Tools",
      description: "Connect terminal coding tools to your router",
      icon: "terminal",
      breadcrumbs: [],
    };
  if (pathname.includes("/proxy-pools"))
    return {
      title: "Proxy Pools",
      description: "Manage your proxy pool configurations",
      icon: "lan",
      breadcrumbs: [],
    };
  if (pathname.includes("/skills"))
    return {
      title: "Agent Skills",
      description: "Copy a link and paste to your AI to use MiawRouter — no install needed",
      icon: "extension",
      breadcrumbs: [],
    };
  if (pathname.includes("/endpoint"))
    return {
      title: "Endpoint",
      description: "Manage endpoints, tunnel access, and API keys",
      icon: "api",
      breadcrumbs: [],
    };
  if (pathname.includes("/profile"))
    return {
      title: "Settings",
      description: "Manage your preferences",
      icon: "settings",
      breadcrumbs: [],
    };
  if (pathname.includes("/translator"))
    return {
      title: "Translator",
      description: "Debug translation flow between formats",
      icon: "translate",
      breadcrumbs: [],
    };
  if (pathname.includes("/console-log"))
    return {
      title: "Console Log",
      description: "Live server console output",
      icon: "monitor",
      breadcrumbs: [],
    };
  if (pathname === "/dashboard")
    return {
      title: "Overview",
      description: "Your providers, tools, and live routing activity",
      icon: "dashboard",
      breadcrumbs: [],
    };
  const routeMeta = {
    health: { title: "Health", description: "System diagnostics, uptime, and memory telemetry", icon: "ecg_heart" },
    runtime: { title: "Runtime", description: "Local runtime engines and model runner status", icon: "memory" },
    "provider-stats": { title: "Provider Stats", description: "Latency, throughput, and success metrics per provider", icon: "analytics" },
    activity: { title: "Activity", description: "Chronological request timeline and routing events", icon: "history" },
    logs: { title: "Logs", description: "Detailed gateway request and response audit logs", icon: "receipt_long" },
    costs: { title: "Costs", description: "Budget rules, spend tracking, and cost breakdowns", icon: "payments" },
    "free-tiers": { title: "Free Tiers", description: "Zero-cost AI models and community quota pools", icon: "redeem" },
    privacy: { title: "Privacy", description: "Data redaction, telemetry controls, and local storage policy", icon: "privacy_tip" },
    "feature-flags": { title: "Feature Flags", description: "Experimental router capabilities and runtime toggles", icon: "flag" },
    pricing: { title: "Pricing", description: "Custom token rate tables across models and providers", icon: "price_change" },
    cache: { title: "Cache", description: "Semantic and exact prompt cache hit performance", icon: "cached" },
    guardrails: { title: "Guardrails", description: "Input/output safety policies and content filters", icon: "verified_user" },
    pxpipe: { title: "PXPIPE", description: "Visual media pipeline and multimodal generation studio", icon: "image" },
    playground: { title: "Playground", description: "Interactive prompt testing and side-by-side model evaluation", icon: "science" },
    "basic-chat": { title: "Basic Chat", description: "Direct conversational interface through your active router", icon: "chat" },
    memory: { title: "Memory", description: "Persistent context and long-term agent memory store", icon: "psychology" },
    mcp: { title: "MCP", description: "Model Context Protocol servers and tool bindings", icon: "cable" },
    a2a: { title: "A2A", description: "Agent-to-Agent task delegation and protocol bridge", icon: "swap_horiz" },
    batch: { title: "Batch", description: "Asynchronous bulk inference jobs and queue processor", icon: "batch_prediction" },
    webhooks: { title: "Webhooks", description: "Outbound event subscriptions and alert delivery", icon: "webhook" },
    "api-endpoints": { title: "API Endpoints", description: "Custom upstream endpoints and compatible route mappings", icon: "api" },
    "cloud-agents": { title: "Agent Registry", description: "Registered autonomous agents and capability manifests", icon: "cloud" },
    "agent-skills": { title: "Agent Skills", description: "Reusable skill packages for autonomous coding agents", icon: "smart_toy" },
    discovery: { title: "Discovery", description: "Explore compatible models, providers, and ecosystem tools", icon: "explore" },
    "skill-discovery": { title: "Skill Discovery", description: "Browse and install community agent skills", icon: "rocket_launch" },
    "free-provider-rankings": { title: "Free Provider Rankings", description: "Live reliability and latency leaderboard for free providers", icon: "emoji_events" },
  };
  const route = pathname.split("/").filter(Boolean).at(-1);
  const matched = routeMeta[route];
  if (matched) {
    return { ...matched, breadcrumbs: [] };
  }
  return { title: "MiawRouter", description: "AI Routing Console", icon: "hub", breadcrumbs: [] };
};

export default function Header({ onMenuClick, showMenuButton = true }) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("");
  const [loginMethod, setLoginMethod] = useState("");

  // Memoize page info to prevent unnecessary recalculations
  const pageInfo = useMemo(() => getPageInfo(pathname), [pathname]);
  const { title, description, icon, breadcrumbs } = pageInfo;

  useEffect(() => {
    let cancelled = false;

    async function loadAuthStatus() {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setDisplayName(data?.displayName || data?.oidcName || data?.oidcEmail || "");
          setLoginMethod(data?.loginMethod || "");
        }
      } catch {
        if (!cancelled) {
          setDisplayName("");
          setLoginMethod("");
        }
      }
    }

    loadAuthStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.assign("/login");
      }
    } catch (err) {
      console.error("Failed to logout:", err);
    }
  };

  return (
    <header className="dashboard-header sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 lg:px-6">
      {/* Mobile menu button */}
      <div className="flex items-center gap-3 lg:hidden shrink-0">
        {showMenuButton && (
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onMenuClick}
            className="flex size-9 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-text-muted transition-colors hover:text-text-main"
          >
            <Icon name="menu" className="text-[18px]" />
          </button>
        )}
      </div>

      {/* Page title with breadcrumbs */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {breadcrumbs.length > 0 ? (
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <div className="icon-box icon-box-sm text-primary">
                <Icon name={icon} weight="duotone" className="shrink-0 text-[16px]" />
              </div>
            )}
            {breadcrumbs.map((crumb, index) => (
              <div
                key={`${crumb.label}-${crumb.href || "current"}`}
                className="flex items-center gap-2 min-w-0"
              >
                {index > 0 && (
                  <Icon name={"chevron_right"} className="text-text-subtle text-[13px] shrink-0" />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="text-sm font-medium text-text-muted hover:text-primary transition-colors truncate"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    {crumb.image && (
                      <ProviderIcon
                        src={crumb.image}
                        alt={crumb.label}
                        size={26}
                        className="object-contain rounded-md max-w-[26px] max-h-[26px]"
                        fallbackText={crumb.label.slice(0, 2).toUpperCase()}
                      />
                    )}
                    <h1 className="truncate text-lg font-bold tracking-tight text-text-main">
                      {translate(crumb.label)}
                    </h1>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : title ? (
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div className="icon-box text-primary hidden sm:inline-flex">
                <Icon name={icon} weight="duotone" className="text-[19px]" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {icon && (
                  <Icon name={icon} weight="duotone" className="text-primary text-[18px] sm:hidden shrink-0" />
                )}
                <h1 className="truncate text-[18px] font-bold tracking-tight text-text-main leading-tight">
                  {translate(title)}
                </h1>
              </div>
              {description && (
                <p className="hidden md:block text-xs text-text-muted truncate mt-0.5">
                  {translate(description)}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Right actions */}
      <div className="dashboard-header-actions flex items-center gap-1.5 shrink-0">
        <Link
          href="/dashboard/health"
          className="hidden xl:inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-text-muted hover:border-primary/40 hover:text-text-main transition-colors mr-1"
          title="View router health"
        >
          <span className="status-dot status-dot-live" />
          <span>Router Online</span>
        </Link>
        {displayName && loginMethod === "OIDC" && (
          <div className="hidden max-w-[220px] items-center truncate rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs text-text-muted sm:flex">
            <Icon name="person" className="mr-1.5 text-[14px] text-primary" />
            <span className="truncate">{displayName}</span>
            <span className="ml-2 shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              OIDC
            </span>
          </div>
        )}
        <HeaderSearch />
        <ThemeToggle />
        <HeaderLanguage />
        <HeaderMenu onLogout={handleLogout} />
      </div>
    </header>
  );
}

function HeaderSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const placeholder = useHeaderSearchStore((s) => s.placeholder);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);

  if (!visible) return null;

  return (
    <div className="relative w-[120px] sm:w-[220px]">
      <Icon name={"search"} className=" absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[16px] pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-border bg-surface-2 pl-7 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-primary/35 transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 rounded"
          aria-label="Clear search"
        >
          <Icon name={"close"} className=" text-[16px]" />
        </button>
      )}
    </div>
  );
}

Header.propTypes = {
  onMenuClick: PropTypes.func,
  showMenuButton: PropTypes.bool,
};
