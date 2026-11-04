"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FREE_PROVIDERS, AI_PROVIDERS } from "@/shared/constants/providers";

// Keep providers without serviceKinds (default LLM) or with "llm" in serviceKinds
function isLLMProvider(id) {
  const p = AI_PROVIDERS[id];
  if (!p?.serviceKinds) return true;
  return p.serviceKinds.includes("llm");
}
import Badge from "./Badge";
import Card from "./Card";
import OverviewCards from "@/app/(dashboard)/dashboard/usage/components/OverviewCards";
import UsageTable, { fmt, fmtTime } from "@/app/(dashboard)/dashboard/usage/components/UsageTable";
import ProviderTopology from "@/app/(dashboard)/dashboard/usage/components/ProviderTopology";
import UsageChart from "@/app/(dashboard)/dashboard/usage/components/UsageChart";

import { Icon } from "@/shared/components/Icon";
function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Auto-update time display every second without re-rendering parent
function TimeAgo({ timestamp }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) setTick((t) => t + 1); }, 1000);
    return () => clearInterval(timer);
  }, []);

  return <>{timeAgo(timestamp)}</>;
}

function fmtCompactTokens(n) {
  const val = Number(n) || 0;
  if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
  if (val >= 10000) return `${(val / 1000).toFixed(1)}k`;
  return fmt(val);
}

function RecentRequests({ requests = [] }) {
  // One-shot restrained highlight tracking only on real new items
  const latestTimestamp = requests[0]?.timestamp;
  const prevLatestRef = useRef(latestTimestamp);
  const [highlightLatest, setHighlightLatest] = useState(false);

  useEffect(() => {
    if (prevLatestRef.current && latestTimestamp && latestTimestamp !== prevLatestRef.current) {
      setHighlightLatest(true);
      const timer = setTimeout(() => setHighlightLatest(false), 1400);
      prevLatestRef.current = latestTimestamp;
      return () => clearTimeout(timer);
    }
    prevLatestRef.current = latestTimestamp;
  }, [latestTimestamp]);

  return (
    <Card
      className="dispatch-ledger flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-5"
      padding="none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-3.5 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="icon-box icon-box-sm text-primary">
            <Icon name="receipt_long" className="text-[15px]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14.5px] font-semibold text-text-main">Dispatch Ledger</h2>
            <p className="text-xs text-text-muted truncate">Latest routes, tokens &amp; status</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-text-muted">
          {requests.length} recent
        </span>
      </div>

      {!requests.length ? (
        <div className="flex flex-1 min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-subtle bg-surface-2/40 px-4 py-8 text-center text-xs text-text-muted">
          <div className="icon-box icon-box-sm text-text-muted">
            <Icon name="history" className="text-[14px]" />
          </div>
          <p className="font-semibold text-text-main">No requests recorded yet</p>
          <p className="max-w-[24ch] text-[11.5px]">Send a chat completion to see the route, tokens, and status here.</p>
        </div>
      ) : (
        <div className="max-h-[420px] min-w-0 flex-1 overflow-auto rounded-lg border border-border-subtle bg-surface-2/25">
          <div className="dispatch-ledger-header sticky top-0 z-10 border-b border-border-subtle bg-surface-2 text-[10.5px] font-mono uppercase tracking-wider text-text-muted" aria-hidden="true">
            <span>State</span>
            <span>Route</span>
            <span className="text-right">In / out</span>
            <span className="text-right">Age</span>
          </div>
          <ul className="min-w-0 divide-y divide-border-subtle" aria-label="Recent dispatches">
            {requests.map((r, i) => {
              const ok = !r.status || r.status === "ok" || r.status === "success";
              const isNewest = i === 0 && highlightLatest;
              return (
                <li
                  key={r.id || `${r.timestamp}-${r.model}-${i}`}
                  className={`dispatch-ledger-row hover:bg-surface-2/70 transition-colors ${isNewest ? "bg-surface-2" : ""}`}
                >
                  <div className="dispatch-ledger-state font-mono text-[10px] font-semibold">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 ${
                        ok
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-danger/30 bg-danger/10 text-danger"
                      }`}
                    >
                      {ok ? "OK" : "ERR"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-semibold text-text-main" title={r.model}>{r.model}</p>
                    {r.provider && (
                      <p className="truncate text-[11px] text-text-muted">{r.provider}</p>
                    )}
                  </div>
                  <p
                    className="whitespace-nowrap text-right font-mono text-[11px] tabular-nums text-text-main"
                    title={`${fmt(r.promptTokens)} prompt / ${fmt(r.completionTokens)} completion`}
                  >
                    {fmtCompactTokens(r.promptTokens)}
                    <span className="text-text-muted"> / </span>
                    {fmtCompactTokens(r.completionTokens)}
                  </p>
                  <p className="whitespace-nowrap text-right font-mono text-[10.5px] text-text-muted">
                    <TimeAgo timestamp={r.timestamp} />
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function sortData(dataMap, pendingMap = {}, sortBy, sortOrder) {
  return Object.entries(dataMap || {})
    .map(([key, data]) => {
      const totalTokens = (data.promptTokens || 0) + (data.completionTokens || 0);
      const totalCost = data.cost || 0;
      // ponytail: cost split is a token-share allocation of the (rate-accurate)
      // server total, not a per-rate recompute. cached is a subset of prompt, so
      // peel it out of the input share. Upgrade to a stored per-component cost
      // breakdown if exact cached-rate cost display is needed.
      const cachedTokens = data.cachedTokens || 0;
      const nonCachedInput = Math.max(0, (data.promptTokens || 0) - cachedTokens);
      const inputCost = totalTokens > 0 ? nonCachedInput * (totalCost / totalTokens) : 0;
      const cachedCost = totalTokens > 0 ? cachedTokens * (totalCost / totalTokens) : 0;
      const outputCost = totalTokens > 0 ? (data.completionTokens || 0) * (totalCost / totalTokens) : 0;
      return { ...data, key, totalTokens, totalCost, inputCost, cachedCost, outputCost, pending: pendingMap[key] || 0 };
    })
    .sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
}

function getGroupKey(item, keyField) {
  switch (keyField) {
    case "rawModel": return item.rawModel || "Unknown Model";
    case "accountName": return item.accountName || `Account ${item.connectionId?.slice(0, 8)}...` || "Unknown Account";
    case "keyName": return item.keyName || "Unknown Key";
    case "endpoint": return item.endpoint || "Unknown Endpoint";
    default: return item[keyField] || "Unknown";
  }
}

function groupDataByKey(data, keyField) {
  if (!Array.isArray(data)) return [];
  const groups = {};
  data.forEach((item) => {
    const gk = getGroupKey(item, keyField);
    if (!groups[gk]) {
      groups[gk] = {
        groupKey: gk,
        summary: { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0, cost: 0, inputCost: 0, cachedCost: 0, outputCost: 0, lastUsed: null, pending: 0 },
        items: [],
      };
    }
    const s = groups[gk].summary;
    s.requests += item.requests || 0;
    s.promptTokens += item.promptTokens || 0;
    s.completionTokens += item.completionTokens || 0;
    s.cachedTokens += item.cachedTokens || 0;
    s.totalTokens += item.totalTokens || 0;
    s.cost += item.cost || 0;
    s.inputCost += item.inputCost || 0;
    s.cachedCost += item.cachedCost || 0;
    s.outputCost += item.outputCost || 0;
    s.pending += item.pending || 0;
    if (item.lastUsed && (!s.lastUsed || new Date(item.lastUsed) > new Date(s.lastUsed))) {
      s.lastUsed = item.lastUsed;
    }
    groups[gk].items.push(item);
  });
  return Object.values(groups);
}

const MODEL_COLUMNS = [
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const ACCOUNT_COLUMNS = [
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "accountName", label: "Account" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const API_KEY_COLUMNS = [
  { field: "keyName", label: "API Key Name" },
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const ENDPOINT_COLUMNS = [
  { field: "endpoint", label: "Endpoint" },
  { field: "rawModel", label: "Model" },
  { field: "provider", label: "Provider" },
  { field: "requests", label: "Requests", align: "right" },
  { field: "lastUsed", label: "Last Used", align: "right" },
];

const TABLE_OPTIONS = [
  { value: "model", label: "Usage by Model" },
  { value: "account", label: "Usage by Account" },
  { value: "apiKey", label: "Usage by API Key" },
  { value: "endpoint", label: "Usage by Endpoint" },
];

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

export default function UsageStats({
  period: periodProp,
  setPeriod: setPeriodProp,
  hidePeriodSelector = false,
  pipelineSlot = null,
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const sortBy = searchParams.get("sortBy") || "rawModel";
  const sortOrder = searchParams.get("sortOrder") || "asc";

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [tableView, setTableView] = useState("model");
  const [viewMode, setViewMode] = useState("costs");
  const [providers, setProviders] = useState([]);
  const [periodLocal, setPeriodLocal] = useState("today");
  const isInitialLoad = useRef(true);
  const hasLoadedStats = useRef(false);
  const period = periodProp ?? periodLocal;
  const setPeriod = setPeriodProp ?? setPeriodLocal;

  // Fetch connected providers once, deduplicate by provider type
  // Always include noAuth free providers (e.g. opencode) regardless of connections
  useEffect(() => {
    Promise.all([
      fetch("/api/providers").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/provider-nodes").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([d, nodesData]) => {
        // Build node name lookup for custom providers
        const nodeNameMap = {};
        for (const node of nodesData?.nodes || []) {
          nodeNameMap[node.id] = node.name;
        }
        const seen = new Set();
        const unique = (d?.connections || [])
          .filter((c) => {
            if (c.isActive === false) return false;
            if (!isLLMProvider(c.provider)) return false;
            if (seen.has(c.provider)) return false;
            seen.add(c.provider);
            return true;
          })
          .map((c) => ({
            ...c,
            nodeName: nodeNameMap[c.provider] || null,
          }));
        const noAuthProviders = Object.values(FREE_PROVIDERS)
          .filter((p) => p.noAuth && !p.hidden && !seen.has(p.id) && isLLMProvider(p.id))
          .map((p) => ({ provider: p.id, name: p.name }));
        setProviders([...unique, ...noAuthProviders]);
      })
      .catch(() => {});
  }, []);

  // Fetch filtered stats via REST when period changes
  useEffect(() => {
    // First load: show full spinner; subsequent: show subtle fetching indicator
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      setLoading(true);
    } else {
      setFetching(true);
    }

    fetch(`/api/usage/stats?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          hasLoadedStats.current = true;
          setStats((prev) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, [period]);

  // SSE connection - real-time full stats for the selected period
  useEffect(() => {
    const es = new EventSource(`/api/usage/stream?period=${encodeURIComponent(period)}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        // Full payload: replace stats wholesale so totals, topology, recent requests and tables stay in sync
        if (data && typeof data === "object") {
          hasLoadedStats.current = true;
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("[SSE CLIENT] parse error:", err);
      }
    };

    es.onerror = () => setLoading(false);

    return () => es.close();
  }, [period]);

  const toggleSort = useCallback(
    (tableType, field) => {
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("sortBy") === field) {
        params.set("sortOrder", params.get("sortOrder") === "asc" ? "desc" : "asc");
      } else {
        params.set("sortBy", field);
        params.set("sortOrder", "asc");
      }
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Compute active table data
  const activeTableConfig = useMemo(() => {
    if (!stats) return null;
    switch (tableView) {
      case "model": {
        const pendingMap = stats.pending?.byModel || {};
        return {
          columns: MODEL_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byModel, pendingMap, sortBy, sortOrder), "rawModel"),
          storageKey: "usage-stats:expanded-models",
          emptyMessage: "No usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-3.5 py-2.5 text-text-muted min-w-[120px]">-</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(group.summary.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className="px-3.5 py-2.5 sticky left-0 z-10 border-r border-border bg-surface-2">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-text-subtle font-mono text-xs select-none">└</span>
                  <span className={`font-medium text-xs transition-colors truncate ${item.pending > 0 ? "text-primary" : "text-text-main"}`}>
                    {item.rawModel}
                  </span>
                </div>
              </td>
              <td className="px-3.5 py-2.5 min-w-[120px]">
                <Badge variant={item.pending > 0 ? "primary" : "neutral"} size="xs">{item.provider}</Badge>
              </td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(item.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
      case "account": {
        const pendingMap = {};
        if (stats?.pending?.byAccount) {
          Object.entries(stats.byAccount || {}).forEach(([accountKey, data]) => {
            const connPending = stats.pending.byAccount[data.connectionId];
            if (connPending) {
              const modelKey = data.provider ? `${data.rawModel} (${data.provider})` : data.rawModel;
              pendingMap[accountKey] = connPending[modelKey] || 0;
            }
          });
        }
        return {
          columns: ACCOUNT_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byAccount, pendingMap, sortBy, sortOrder), "accountName"),
          storageKey: "usage-stats:expanded-accounts",
          emptyMessage: "No account-specific usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-3.5 py-2.5 text-text-muted">-</td>
              <td className="px-3.5 py-2.5 text-text-muted">-</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(group.summary.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className="px-3.5 py-2.5 sticky left-0 z-10 border-r border-border bg-surface-2">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-text-subtle font-mono text-xs select-none">└</span>
                  <span className={`font-medium text-xs transition-colors truncate ${item.pending > 0 ? "text-primary" : "text-text-main"}`}>
                    {item.accountName || `Account ${item.connectionId?.slice(0, 8)}...`}
                  </span>
                </div>
              </td>
              <td className={`px-3.5 py-2.5 font-medium transition-colors ${item.pending > 0 ? "text-primary" : "text-text-main"}`}>{item.rawModel}</td>
              <td className="px-3.5 py-2.5"><Badge variant={item.pending > 0 ? "primary" : "neutral"} size="xs">{item.provider}</Badge></td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(item.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
      case "apiKey": {
        return {
          columns: API_KEY_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byApiKey, {}, sortBy, sortOrder), "keyName"),
          storageKey: "usage-stats:expanded-apikeys",
          emptyMessage: "No API key usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-3.5 py-2.5 text-text-muted">-</td>
              <td className="px-3.5 py-2.5 text-text-muted">-</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(group.summary.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className="px-3.5 py-2.5 sticky left-0 z-10 border-r border-border bg-surface-2">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-text-subtle font-mono text-xs select-none">└</span>
                  <span className="font-medium text-xs text-text-main truncate">{item.keyName}</span>
                </div>
              </td>
              <td className="px-3.5 py-2.5 text-text-main">{item.rawModel}</td>
              <td className="px-3.5 py-2.5"><Badge variant="neutral" size="xs">{item.provider}</Badge></td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(item.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
      case "endpoint":
      default: {
        return {
          columns: ENDPOINT_COLUMNS,
          groupedData: groupDataByKey(sortData(stats.byEndpoint, {}, sortBy, sortOrder), "endpoint"),
          storageKey: "usage-stats:expanded-endpoints",
          emptyMessage: "No endpoint usage recorded yet.",
          renderSummaryCells: (group) => (
            <>
              <td className="px-3.5 py-2.5 text-text-muted">-</td>
              <td className="px-3.5 py-2.5 text-text-muted">-</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(group.summary.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(group.summary.lastUsed)}</td>
            </>
          ),
          renderDetailCells: (item) => (
            <>
              <td className="px-3.5 py-2.5 sticky left-0 z-10 border-r border-border bg-surface-2">
                <div className="flex items-center gap-2 pl-4">
                  <span className="text-text-subtle font-mono text-xs select-none">└</span>
                  <span className="font-medium font-mono text-xs text-text-main truncate">{item.endpoint}</span>
                </div>
              </td>
              <td className="px-3.5 py-2.5 text-text-main">{item.rawModel}</td>
              <td className="px-3.5 py-2.5"><Badge variant="neutral" size="xs">{item.provider}</Badge></td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-text-muted">{fmt(item.requests)}</td>
              <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-[11px] text-text-muted whitespace-nowrap">{fmtTime(item.lastUsed)}</td>
            </>
          ),
        };
      }
    }
  }, [stats, tableView, sortBy, sortOrder]);

  if (!stats && !loading) return <div className="text-danger">Failed to load usage statistics.</div>;

  const spinner = (
    <div className="flex items-center justify-center py-12 text-text-muted">
      <Icon name="progress_activity" className="animate-spin text-[32px] text-primary" />
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Period selector (hidden when controlled by parent) */}
      {!hidePeriodSelector && (
        <div className="flex w-full items-center gap-2 sm:w-auto sm:self-end">
          <div className="grid flex-1 grid-cols-5 items-center gap-1 rounded-md border border-border bg-surface-2 p-1 sm:flex sm:flex-none">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                disabled={fetching}
                className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 ${
                  period === p.value ? "bg-surface text-text-main border border-border-subtle" : "text-text-muted hover:bg-surface hover:text-text-main"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {fetching && (
            <Icon name="progress_activity" className="animate-spin text-[16px] text-text-muted" />
          )}
        </div>
      )}

      {/* Overview Chassis Bar */}
      {loading ? spinner : <OverviewCards stats={stats} />}

      {/* Provider Switchboard Channel Bay + Dispatch Ledger */}
      {loading ? (
        spinner
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(21rem,1fr)]">
          <div className="ui-card min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
            <ProviderTopology
              providers={providers}
              activeRequests={stats?.activeRequests || []}
              recentRequests={stats?.recentRequests || []}
              lastProvider={stats?.recentRequests?.[0]?.provider || ""}
              errorProvider={stats?.errorProvider || ""}
            />
          </div>
          <div className="ui-card rounded-xl border border-border bg-surface overflow-hidden"><RecentRequests requests={stats?.recentRequests || []} /></div>
        </div>
      )}

      {/* Cache & Token Saver Pipeline Telemetry Deck */}
      {pipelineSlot}

      {/* Token / Cost chart - sync period */}
      {loading ? spinner : <UsageChart period={period} />}

      {/* Table with segmented pill selector */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="icon-box icon-box-sm text-primary">
              <Icon name="analytics" className="text-[14px]" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-semibold text-text-main">Usage Breakdown</h3>
              <p className="text-[11.5px] text-text-muted">Group token and cost metrics by dimension</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap items-center rounded-lg border border-border bg-surface-2 p-1 gap-0.5">
              {TABLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTableView(opt.value)}
                  className={`min-h-[28px] rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    tableView === opt.value
                      ? "bg-surface text-text-main border border-border-subtle font-semibold shadow-2xs"
                      : "text-text-muted hover:text-text-main hover:bg-surface/60"
                  }`}
                >
                  {opt.label.replace("Usage by ", "")}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center rounded-lg border border-border bg-surface-2 p-1 gap-0.5">
              <button
                type="button"
                onClick={() => setViewMode("costs")}
                className={`min-h-[28px] rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  viewMode === "costs"
                    ? "bg-surface text-text-main border border-border-subtle font-semibold shadow-2xs"
                    : "text-text-muted hover:text-text-main hover:bg-surface/60"
                }`}
              >
                Costs
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tokens")}
                className={`min-h-[28px] rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  viewMode === "tokens"
                    ? "bg-surface text-text-main border border-border-subtle font-semibold shadow-2xs"
                    : "text-text-muted hover:text-text-main hover:bg-surface/60"
                }`}
              >
                Tokens
              </button>
            </div>
          </div>
        </div>
        {loading
          ? spinner
          : activeTableConfig && (
              <UsageTable
                title=""
                columns={activeTableConfig.columns}
                groupedData={activeTableConfig.groupedData}
                tableType={tableView}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onToggleSort={toggleSort}
                viewMode={viewMode}
                storageKey={activeTableConfig.storageKey}
                renderSummaryCells={activeTableConfig.renderSummaryCells}
                renderDetailCells={activeTableConfig.renderDetailCells}
                emptyMessage={activeTableConfig.emptyMessage}
              />
            )}
      </div>
    </div>
  );
}
