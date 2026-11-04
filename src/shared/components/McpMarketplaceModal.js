"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import Badge from "./Badge";
import SegmentedControl from "./SegmentedControl";

import { Icon } from "@/shared/components/Icon";
const REGISTRY_ENDPOINT = "/api/cli-tools/cowork-mcp-registry";
const TOOLS_ENDPOINT = "/api/cli-tools/cowork-mcp-tools";

export default function McpMarketplaceModal({ isOpen, onClose, onAdd, addedNames = [] }) {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState(null);
  const [expandedUrl, setExpandedUrl] = useState(null);
  const [toolsCache, setToolsCache] = useState({});
  const [toolsLoading, setToolsLoading] = useState({});
  const [toolSelection, setToolSelection] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    if (servers.length > 0) return;
    setLoading(true);
    fetch(REGISTRY_ENDPOINT)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setServers(d.servers || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const addedSet = useMemo(() => new Set(addedNames), [addedNames]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return servers.filter((s) => {
      if (filter === "authless" && s.oauth) return false;
      if (filter === "oauth" && !s.oauth) return false;
      if (!q) return true;
      return (
        (s.title || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.name || "").toLowerCase().includes(q)
      );
    });
  }, [servers, search, filter]);

  const fetchTools = async (server) => {
    if (toolsCache[server.url]) return;
    setToolsLoading((p) => ({ ...p, [server.url]: true }));
    try {
      const r = await fetch(TOOLS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: server.url }),
      });
      const d = await r.json();
      const tools = d.tools || [];
      const fallback = Array.isArray(server.toolNames) ? server.toolNames : [];
      const toolNames = tools.length > 0 ? tools.map((t) => t.name) : fallback;
      setToolsCache((p) => ({ ...p, [server.url]: { tools, requiresAuth: !!d.requiresAuth, error: d.error } }));
      // Default: all checked
      setToolSelection((p) => ({ ...p, [server.url]: Object.fromEntries(toolNames.map((t) => [t, true])) }));
    } catch (e) {
      setToolsCache((p) => ({ ...p, [server.url]: { tools: [], error: e.message } }));
    } finally {
      setToolsLoading((p) => ({ ...p, [server.url]: false }));
    }
  };

  const expandServer = (server) => {
    if (expandedUrl === server.url) {
      setExpandedUrl(null);
      return;
    }
    setExpandedUrl(server.url);
    fetchTools(server);
  };

  const toggleTool = (url, tool) => {
    setToolSelection((prev) => ({ ...prev, [url]: { ...prev[url], [tool]: !prev[url]?.[tool] } }));
  };

  const setAllTools = (url, value) => {
    const sel = toolSelection[url] || {};
    setToolSelection((prev) => ({ ...prev, [url]: Object.fromEntries(Object.keys(sel).map((t) => [t, value])) }));
  };

  const confirmAdd = (server) => {
    const sel = toolSelection[server.url] || {};
    const enabled = Object.keys(sel).filter((t) => sel[t]);
    onAdd?.({
      name: server.slug || server.name,
      title: server.title,
      description: server.description,
      url: server.url,
      transport: server.transport,
      oauth: server.oauth,
      toolNames: enabled,
    });
    setExpandedUrl(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Browse MCP Marketplace" size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="tool-directory-search">
            <Icon name="search" className="text-[16px] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search servers by name or description"
              aria-label="Search MCP servers"
            />
          </div>
          <SegmentedControl
            ariaLabel="Authentication filter"
            value={filter}
            onChange={setFilter}
            className="shrink-0"
            options={[
              { value: "all", label: "All" },
              { value: "authless", label: "Authless" },
              { value: "oauth", label: "OAuth" },
            ]}
          />
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
            <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-text-main">The MCP registry could not be loaded</p>
              <p className="mt-1 text-text-muted">{error}</p>
              <p className="mt-1 text-text-muted">
                Check the connection to the registry endpoint, then close and reopen this dialog.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2.5 py-6 text-sm text-text-muted">
            <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
            Loading the server list from the MCP registry…
          </div>
        )}

        {!loading && (
          <div className="flex max-h-[60vh] flex-col overflow-y-auto custom-scrollbar rounded-[10px] border border-border">
            {filtered.length === 0 && (
              <div className="flex flex-col items-start gap-1 p-4 text-sm">
                {servers.length === 0 ? (
                  <>
                    <p className="font-medium text-text-main">The registry returned no servers</p>
                    <p className="text-text-muted">
                      Nothing is published to the registry endpoint right now. Close this dialog and try
                      again later.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-text-main">No server matches this filter</p>
                    <p className="text-text-muted">
                      Clear the search box or switch the filter back to All to see the{" "}
                      <span className="tabular-nums">{servers.length}</span> servers in the registry.
                    </p>
                  </>
                )}
              </div>
            )}

            {filtered.map((s) => {
              const added = addedSet.has(s.slug || s.name);
              const expanded = expandedUrl === s.url;
              const cache = toolsCache[s.url];
              const isLoadingTools = toolsLoading[s.url];
              const sel = toolSelection[s.url] || {};
              const toolKeys = Object.keys(sel);
              const selectedCount = Object.values(sel).filter(Boolean).length;
              return (
                <div key={s.url} className="border-b border-border-subtle last:border-b-0">
                  <div className="flex items-start gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-surface-2">
                    {s.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.iconUrl}
                        alt=""
                        className="size-7 shrink-0 rounded-md object-contain"
                        onError={(e) => { e.target.style.display = "none"; }}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2">
                        <Icon name="extension" className="text-[16px] text-text-muted" />
                      </span>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-text-main">{s.title}</span>
                        <Badge variant={s.oauth ? "warning" : "success"}>
                          {s.oauth ? "OAuth" : "Authless"}
                        </Badge>
                        {s.toolCount > 0 && (
                          <span className="text-xs text-text-muted tabular-nums">{s.toolCount} tools</span>
                        )}
                      </div>
                      {s.description && (
                        <p className="line-clamp-2 text-[13px] leading-relaxed text-text-muted">{s.description}</p>
                      )}
                    </div>

                    <div className="shrink-0">
                      {added ? (
                        <Badge variant="primary" icon="check">
                          Added
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant={expanded ? "ghost" : "secondary"}
                          onClick={() => expandServer(s)}
                        >
                          {expanded ? "Cancel" : "Add"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="flex flex-col gap-2.5 border-t border-border-subtle bg-surface-2 px-3 py-3">
                      {isLoadingTools && (
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <Icon name="progress_activity" className="animate-spin text-[14px]" />
                          Asking the server which tools it exposes…
                        </div>
                      )}

                      {!isLoadingTools && cache?.requiresAuth && (
                        <div className="flex items-start gap-2 rounded-md border border-warning/20 bg-warning/10 p-2.5 text-xs text-text-muted">
                          <Icon name="warning" weight="fill" className="mt-0.5 text-[14px] text-warning shrink-0" />
                          <span>
                            This server requires OAuth. Add it now and authenticate after Apply — the tool
                            list is discovered on the first connect.
                          </span>
                        </div>
                      )}

                      {!isLoadingTools && cache?.error && !cache?.requiresAuth && (
                        <div className="flex items-start gap-2 rounded-md border border-danger/20 bg-danger/10 p-2.5 text-xs text-text-muted">
                          <Icon name="error" className="mt-0.5 text-[14px] text-danger shrink-0" />
                          <span>
                            The probe failed: {cache.error}. The server may be offline — add it anyway and
                            its tools are discovered on the first connect.
                          </span>
                        </div>
                      )}

                      {!isLoadingTools && toolKeys.length === 0 && !cache?.requiresAuth && !cache?.error && (
                        <p className="text-xs text-text-muted">
                          The server answered but advertises no tools, so none can be enabled.
                        </p>
                      )}

                      {!isLoadingTools && toolKeys.length > 0 && (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-text-muted tabular-nums">
                              {selectedCount} of {toolKeys.length} tools enabled
                            </span>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setAllTools(s.url, true)}>
                                Enable all
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setAllTools(s.url, false)}>
                                Disable all
                              </Button>
                            </div>
                          </div>
                          <div className="grid max-h-40 grid-cols-2 gap-x-3 gap-y-0.5 overflow-y-auto custom-scrollbar">
                            {toolKeys.map((t) => (
                              <label
                                key={t}
                                className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs text-text-main transition-colors duration-150 hover:bg-surface"
                              >
                                <input
                                  type="checkbox"
                                  checked={!!sel[t]}
                                  onChange={() => toggleTool(s.url, t)}
                                  className="size-3.5 shrink-0"
                                />
                                <span className="truncate font-mono">{t}</span>
                              </label>
                            ))}
                          </div>
                        </>
                      )}

                      <Button size="sm" onClick={() => confirmAdd(s)} className="self-end">
                        Add {toolKeys.length > 0 ? `${selectedCount} tools` : "server"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-xs text-text-muted tabular-nums">
          {filtered.length} of {servers.length} servers
        </div>
      </div>
    </Modal>
  );
}
