"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, Badge, Button, CardSkeleton } from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

import { Icon } from "@/shared/components/Icon";
const API_URL = "/api/discovery/endpoints";

/* ── Auth badge helpers ────────────────────────────────────────────── */

const AUTH_VARIANT = {
  "public-api-key": "success",
  dashboard: "primary",
  "local-only": "warning",
  "experimental": "info",
};

const AUTH_ICON = {
  "public-api-key": "key",
  dashboard: "lock",
  "local-only": "vpn_lock",
  "experimental": "science",
};

const METHOD_COLORS = {
  GET: "text-success",
  POST: "text-primary",
  PUT: "text-warning",
  DELETE: "text-danger",
  PATCH: "text-text-muted",
};

/* ── Copy Button ───────────────────────────────────────────────────── */

function CopyButton({ value }) {
  const { copied, copy } = useCopyToClipboard(2000);
  return (
    <button
      onClick={() => copy(value)}
      className="p-1 rounded hover:bg-surface-2 transition-colors text-text-muted cursor-pointer"
      title="Copy cURL"
    >
      <Icon name={copied ? "check" : "content_copy"} className=" text-[16px]" />
    </button>
  );
}

/* ── Endpoint Card ─────────────────────────────────────────────────── */

function EndpointCard({ endpoint }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-border-subtle bg-surface px-3 py-3 transition-colors hover:bg-surface-2/60">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 sm:grid-cols-[5rem_minmax(0,2fr)_minmax(8rem,1fr)_auto] sm:items-center">
        <code className={cn("inline-flex w-fit items-center justify-center rounded-md border border-border-subtle bg-surface-2 px-2 py-1 text-[11px] font-semibold font-mono", METHOD_COLORS[endpoint.method] || "text-text-main")}>
          {endpoint.method}
        </code>
        <div className="min-w-0">
          <code className="block truncate text-xs font-mono font-medium text-text-main">{endpoint.path}</code>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{endpoint.description}</p>
          {endpoint.capability && <p className="mt-0.5 truncate text-[11px] font-mono text-text-subtle">{endpoint.capability}</p>}
        </div>
        <div className="hidden min-w-0 sm:block">
          <Badge variant={AUTH_VARIANT[endpoint.auth] || "default"} size="sm">
            <Icon name={AUTH_ICON[endpoint.auth] || "lock"} className="mr-0.5 text-[10px]" />
            {endpoint.auth}
          </Badge>
          {endpoint.category && <p className="mt-1 truncate text-xs text-text-muted">{endpoint.category}</p>}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <Icon name={"expand_more"} className="text-[18px] transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 sm:hidden">
        <Badge variant={AUTH_VARIANT[endpoint.auth] || "default"} size="sm">
          <Icon name={AUTH_ICON[endpoint.auth] || "lock"} className="mr-0.5 text-[10px]" />
          {endpoint.auth}
        </Badge>
        {endpoint.category && <span className="text-xs text-text-muted">{endpoint.category}</span>}
      </div>
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
          <div>
            <h4 className="mb-1.5 text-xs font-semibold text-text-muted">cURL example</h4>
            <div className="flex items-start gap-2">
              <pre className="flex-1 overflow-x-auto rounded-md border border-border-subtle bg-surface-2 p-3 text-[11px] font-mono text-text-main">{endpoint.curl}</pre>
              <CopyButton value={endpoint.curl} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-4">
            <div><span className="text-[10px] text-text-muted">ID</span><p className="mt-0.5 text-xs font-mono text-text-main">{endpoint.id}</p></div>
            <div><span className="text-[10px] text-text-muted">Auth</span><p className="mt-0.5 text-xs font-mono text-text-main">{endpoint.auth}</p></div>
            <div><span className="text-[10px] text-text-muted">Category</span><p className="mt-0.5 text-xs font-mono text-text-main">{endpoint.category}</p></div>
            <div><span className="text-[10px] text-text-muted">Status</span><p className="mt-0.5 text-xs font-mono text-text-main">{endpoint.status}</p></div>
          </div>
          {endpoint.auth === "local-only" && (
            <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/10 px-3 py-2 text-xs text-warning">
              <Icon name={"warning"} className="mt-0.5 shrink-0 text-[14px]" />
              <span>This endpoint is local-only and not accessible from external networks.</span>
            </div>
          )}
          {endpoint.auth === "experimental" && (
            <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-primary">
              <Icon name={"science"} className="mt-0.5 shrink-0 text-[14px]" />
              <span>This endpoint is experimental and may change or be removed.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page Header ───────────────────────────────────────────────────── */

function PageHeader({ loading, refresh }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-[22px] font-semibold text-text-main">API Endpoints</h1>
        <p className="text-sm text-text-muted">
          Browse routes by method, access level, and path.
        </p>
      </div>
      <Button variant="secondary" size="sm" onClick={refresh} disabled={loading} icon="refresh">
        {loading ? "Loading…" : "Refresh"}
      </Button>
    </div>
  );
}

/* ── Main Client Component ─────────────────────────────────────────── */

export default function ApiEndpointsPageClient() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [authFilter, setAuthFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_URL, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message || "Failed to load API endpoints");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = data?.items || [];
  const sources = data?.sources || [];
  const authValues = useMemo(
    () => [...new Set(items.map((e) => e.auth))].sort(),
    [items]
  );

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return items.filter((ep) => {
      if (authFilter !== "all" && ep.auth !== authFilter) return false;
      if (!needle) return true;
      return [ep.id, ep.path, ep.method, ep.capability, ep.description, ep.category].some((v) =>
        (v || "").toLowerCase().includes(needle)
      );
    });
  }, [items, search, authFilter]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-1 sm:px-0">
      <PageHeader loading={loading} refresh={load} />

      {error && (
        <Card className="border-danger/30 text-sm text-danger" padding="sm">{error}</Card>
      )}

      {/* Source statuses */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
                s.status === "available"
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-danger/20 bg-danger/10 text-danger"
              )}
            >
              <Icon name={s.status === "available" ? "check_circle" : "error"} className={cn("text-[14px]", s.status === "available" ? "text-success" : "text-danger")} />
              <span className="font-medium">{s.id}</span>
              {s.status === "available" ? (
                <span className="text-text-muted">{s.count} endpoint{s.count !== 1 ? "s" : ""}</span>
              ) : (
                <span>{s.error || "Unavailable"}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Search + auth filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name={"search"} className=" absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search endpoints by path, method, or capability…"
            className="w-full pl-10 pr-3 py-2 rounded-lg border border-border-subtle bg-surface text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border-subtle bg-surface-2 p-0.5">
          <button
            onClick={() => setAuthFilter("all")}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
              authFilter === "all" ? "bg-surface text-text-main" : "text-text-muted hover:text-text-main"
            )}
          >
            All ({items.length})
          </button>
          {authValues.map((auth) => (
            <button
              key={auth}
              onClick={() => setAuthFilter(auth)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
                authFilter === auth ? "bg-surface text-text-main" : "text-text-muted hover:text-text-main"
              )}
            >
              {auth} ({items.filter((e) => e.auth === auth).length})
            </button>
          ))}
        </div>
      </div>

      {/* Endpoint list */}
      {loading ? (
        <div className="space-y-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon name={"api"} className=" text-[40px] text-text-muted/40 mb-3" />
            <p className="text-sm text-text-muted">
              {items.length === 0 ? "No API endpoints were returned. Refresh to try again." : "No endpoints match this search or access filter. Adjust the filters to see more routes."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border-subtle bg-surface">
          <div className="hidden grid-cols-[5rem_minmax(0,2fr)_minmax(8rem,1fr)_auto] gap-3 border-b border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text-muted sm:grid">
            <span>Method</span><span>Endpoint</span><span>Access</span><span className="sr-only">Details</span>
          </div>
          {filtered.map((ep) => (
            <EndpointCard key={ep.id} endpoint={ep} />
          ))}
        </div>
      )}

      {/* Info footer */}
      <Card padding="sm" className="border-border-subtle/50">
        <div className="flex items-start gap-3">
          <Icon name={"info"} className=" text-[16px] text-text-muted mt-0.5" />
          <div className="text-xs text-text-muted space-y-1">
            <p>
              <strong className="text-text-main">cURL examples</strong> use placeholders
              like <code className="px-1 rounded bg-surface-2">$MIAWROUTER_BASE_URL</code> and{" "}
              <code className="px-1 rounded bg-surface-2">$MIAWROUTER_API_KEY</code>. Replace
              them with your actual gateway URL and key.
            </p>
            <p>
              <strong className="text-text-main">Local-only</strong> endpoints are accessible
              only from the machine running MiawRouter.{" "}
              <strong className="text-text-main">Experimental</strong> endpoints may change
              without notice.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
