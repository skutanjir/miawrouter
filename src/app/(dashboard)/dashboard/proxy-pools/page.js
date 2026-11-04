"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Badge, Button, Card, CardSkeleton, Input, Modal, Toggle, ConfirmModal } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

import { Icon } from "@/shared/components/Icon";

function getStatusVariant(status) {
  if (status === "active") return "success";
  if (status === "error") return "error";
  return "default";
}

function formatDateTime(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

function normalizeFormData(data = {}) {
  return {
    name: data.name || "",
    proxyUrl: data.proxyUrl || "",
    noProxy: data.noProxy || "",
    isActive: data.isActive !== false,
    strictProxy: data.strictProxy === true,
  };
}

const RELAY_LABELS = { vercel: "Vercel relay", cloudflare: "Cloudflare relay", deno: "Deno relay" };

export default function ProxyPoolsPage() {
  const [proxyPools, setProxyPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);
  const [showCloudflareModal, setShowCloudflareModal] = useState(false);
  const [showDenoModal, setShowDenoModal] = useState(false);
  const [showRelayMenu, setShowRelayMenu] = useState(false);
  const [editingProxyPool, setEditingProxyPool] = useState(null);
  const [formData, setFormData] = useState(normalizeFormData());
  const [batchImportText, setBatchImportText] = useState("");
  const [vercelForm, setVercelForm] = useState({ vercelToken: "", projectName: "vercel-relay" });
  const [cloudflareForm, setCloudflareForm] = useState({ accountId: "", apiToken: "", projectName: "cloudflare-relay" });
  const [denoForm, setDenoForm] = useState({ denoToken: "", orgDomain: "", projectName: "" });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthProgress, setHealthProgress] = useState({ current: 0, total: 0 });
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const relayMenuRef = useRef(null);
  const notify = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (relayMenuRef.current && !relayMenuRef.current.contains(e.target)) {
        setShowRelayMenu(false);
      }
    };
    if (showRelayMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showRelayMenu]);

  const fetchProxyPools = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy-pools?includeUsage=true", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setProxyPools(data.proxyPools || []);
      }
    } catch (error) {
      console.log("Error fetching proxy pools:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProxyPools();
  }, [fetchProxyPools]);

  const resetForm = () => {
    setEditingProxyPool(null);
    setFormData(normalizeFormData());
  };

  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (proxyPool) => {
    setEditingProxyPool(proxyPool);
    setFormData(normalizeFormData(proxyPool));
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  const handleSave = async () => {
    const payload = {
      name: formData.name.trim(),
      proxyUrl: formData.proxyUrl.trim(),
      noProxy: formData.noProxy.trim(),
      isActive: formData.isActive === true,
      strictProxy: formData.strictProxy === true,
    };

    if (!payload.name || !payload.proxyUrl) return;

    setSaving(true);
    try {
      const isEdit = !!editingProxyPool;
      const res = await fetch(isEdit ? `/api/proxy-pools/${editingProxyPool.id}` : "/api/proxy-pools", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchProxyPools();
        closeFormModal();
        notify.success(editingProxyPool ? "Proxy pool updated" : "Proxy pool created");
      } else {
        const data = await res.json();
        notify.error(data.error || "Failed to save proxy pool");
      }
    } catch (error) {
      console.log("Error saving proxy pool:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (proxyPool) => {
    setConfirmState({
      title: "Delete Proxy Pool",
      message: `Delete proxy pool "${proxyPool.name}"?`,
      onConfirm: async () => {
        setConfirmState(null);
        try {
          const res = await fetch(`/api/proxy-pools/${proxyPool.id}`, { method: "DELETE" });
          if (res.ok) {
            setProxyPools((prev) => prev.filter((item) => item.id !== proxyPool.id));
            notify.success("Proxy pool deleted");
            return;
          }

          const data = await res.json();
          if (res.status === 409) {
            notify.warning(`Cannot delete: ${data.boundConnectionCount || 0} connection(s) are still using this pool.`);
          } else {
            notify.error(data.error || "Failed to delete proxy pool");
          }
        } catch (error) {
          console.log("Error deleting proxy pool:", error);
          notify.error("Failed to delete proxy pool");
        }
      }
    });
  };

  const handleTest = async (proxyPoolId) => {
    setTestingId(proxyPoolId);
    try {
      const res = await fetch(`/api/proxy-pools/${proxyPoolId}/test`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        notify.error(data.error || "Failed to test proxy");
        return;
      }

      await fetchProxyPools();
      notify.success(data.ok ? "Proxy test passed" : "Proxy test failed");
    } catch (error) {
      console.log("Error testing proxy pool:", error);
      notify.error("Failed to test proxy");
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (pool) => {
    const next = !pool.isActive;
    setProxyPools((prev) => prev.map((p) => p.id === pool.id ? { ...p, isActive: next } : p));
    try {
      const res = await fetch(`/api/proxy-pools/${pool.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) {
        setProxyPools((prev) => prev.map((p) => p.id === pool.id ? { ...p, isActive: pool.isActive } : p));
        notify.error("Failed to update active state");
      }
    } catch (error) {
      console.log("Error toggling active:", error);
      setProxyPools((prev) => prev.map((p) => p.id === pool.id ? { ...p, isActive: pool.isActive } : p));
    }
  };

  const allSelected = proxyPools.length > 0 && selectedIds.length === proxyPools.length;
  const toggleSelect = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : proxyPools.map((p) => p.id));
  const clearSelection = () => setSelectedIds([]);

  const bulkSetActive = async (isActive) => {
    const targets = selectedIds.length > 0 ? selectedIds : proxyPools.map((p) => p.id);
    if (targets.length === 0) return;
    setBulkBusy(true);
    try {
      let ok = 0; let failed = 0;
      for (const id of targets) {
        try {
          const res = await fetch(`/api/proxy-pools/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive }),
          });
          if (res.ok) ok += 1; else failed += 1;
        } catch { failed += 1; }
      }
      await fetchProxyPools();
      notify.success(`${isActive ? "Activated" : "Deactivated"} ${ok}${failed ? `, failed ${failed}` : ""}`);
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setConfirmState({
      title: "Delete Proxy Pools",
      message: `Delete ${selectedIds.length} proxy pool(s)?`,
      onConfirm: async () => {
        setConfirmState(null);
        setBulkBusy(true);
        try {
          let ok = 0; let blocked = 0; let failed = 0;
          for (const id of selectedIds) {
            try {
              const res = await fetch(`/api/proxy-pools/${id}`, { method: "DELETE" });
              if (res.ok) ok += 1;
              else if (res.status === 409) blocked += 1;
              else failed += 1;
            } catch { failed += 1; }
          }
          await fetchProxyPools();
          clearSelection();
          notify.success(`Deleted ${ok}${blocked ? `, ${blocked} bound` : ""}${failed ? `, ${failed} failed` : ""}`);
        } finally {
          setBulkBusy(false);
        }
      }
    });
  };

  const handleHealthCheck = async () => {
    const targets = selectedIds.length > 0
      ? proxyPools.filter((p) => selectedIds.includes(p.id))
      : proxyPools;
    if (targets.length === 0) return;
    setHealthChecking(true);
    setHealthProgress({ current: 0, total: targets.length });
    let alive = 0; const deadIds = [];
    let done = 0;
    const CONCURRENCY = 10;
    const queue = [...targets];

    const worker = async () => {
      while (queue.length > 0) {
        const pool = queue.shift();
        if (!pool) break;
        try {
          const res = await fetch(`/api/proxy-pools/${pool.id}/test`, { method: "POST" });
          const data = await res.json();
          if (res.ok && data.ok) alive += 1; else deadIds.push(pool.id);
        } catch {
          deadIds.push(pool.id);
        } finally {
          done += 1;
          setHealthProgress({ current: done, total: targets.length });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
    await fetchProxyPools();
    setHealthChecking(false);
    setHealthProgress({ current: 0, total: 0 });

    if (deadIds.length > 0) {
      setConfirmState({
        title: "Disable Dead Proxies",
        message: `Alive: ${alive}, Dead: ${deadIds.length}.\n\nDisable ${deadIds.length} dead proxies?`,
        onConfirm: async () => {
          setConfirmState(null);
          setBulkBusy(true);
          try {
            for (const id of deadIds) {
              try {
                await fetch(`/api/proxy-pools/${id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ isActive: false }),
                });
              } catch {}
            }
            await fetchProxyPools();
            notify.success(`Disabled ${deadIds.length} dead proxies`);
          } finally {
            setBulkBusy(false);
          }
        }
      });
    } else {
      notify.success(`Health check done. Alive: ${alive}, Dead: ${deadIds.length}`);
    }
  };

  // Cleanup selectedIds when pools change
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => proxyPools.some((p) => p.id === id)));
  }, [proxyPools]);

  const openBatchImportModal = () => {
    setBatchImportText("");
    setShowBatchImportModal(true);
  };

  const closeBatchImportModal = () => {
    if (importing) return;
    setShowBatchImportModal(false);
  };

  const openVercelModal = () => {
    setVercelForm({ vercelToken: "", projectName: "vercel-relay" });
    setShowVercelModal(true);
  };

  const closeVercelModal = () => {
    if (deploying) return;
    setShowVercelModal(false);
  };

  const openCloudflareModal = () => {
    setCloudflareForm({ accountId: "", apiToken: "", projectName: "cloudflare-relay" });
    setShowCloudflareModal(true);
  };

  const closeCloudflareModal = () => {
    if (deploying) return;
    setShowCloudflareModal(false);
  };

  const openDenoModal = () => {
    setDenoForm({ denoToken: "", orgDomain: "", projectName: "" });
    setShowDenoModal(true);
  };

  const closeDenoModal = () => {
    if (deploying) return;
    setShowDenoModal(false);
  };

  const handleVercelDeploy = async () => {
    if (!vercelForm.vercelToken.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/proxy-pools/vercel-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vercelForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        closeVercelModal();
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log("Error deploying Vercel relay:", error);
      notify.error("Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleCloudflareDeploy = async () => {
    if (!cloudflareForm.accountId.trim() || !cloudflareForm.apiToken.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/proxy-pools/cloudflare-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cloudflareForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        closeCloudflareModal();
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log("Error deploying Cloudflare relay:", error);
      notify.error("Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleDenoDeploy = async () => {
    if (!denoForm.denoToken.trim()) return;
    setDeploying(true);
    try {
      const res = await fetch("/api/proxy-pools/deno-deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(denoForm),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchProxyPools();
        closeDenoModal();
        notify.success(`Deployed: ${data.deployUrl}`);
      } else {
        notify.error(data.error || "Deploy failed");
      }
    } catch (error) {
      console.log("Error deploying Deno relay:", error);
      notify.error("Deploy failed");
    } finally {
      setDeploying(false);
    }
  };

  const parseProxyLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return null;

    if (trimmed.includes("://")) {
      const parsed = new URL(trimmed);
      const hostLabel = parsed.port ? `${parsed.hostname}:${parsed.port}` : parsed.hostname;
      return {
        proxyUrl: parsed.toString(),
        name: `Imported ${hostLabel}`,
      };
    }

    const parts = trimmed.split(":");
    if (parts.length === 4) {
      const [host, port, username, password] = parts;
      if (!host || !port || !username || !password) {
        throw new Error("Invalid host:port:user:pass format");
      }

      const proxyUrl = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
      const parsed = new URL(proxyUrl);
      return {
        proxyUrl: parsed.toString(),
        name: `Imported ${host}:${port}`,
      };
    }

    throw new Error("Unsupported format");
  };

  const handleBatchImport = async () => {
    const lines = batchImportText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      notify.warning("Please paste at least one proxy line.");
      return;
    }

    const parsedEntries = [];
    const invalidLines = [];

    lines.forEach((line, index) => {
      try {
        const parsed = parseProxyLine(line);
        if (parsed) {
          parsedEntries.push({
            ...parsed,
            lineNumber: index + 1,
          });
        }
      } catch (error) {
        invalidLines.push(`Line ${index + 1}: ${error.message}`);
      }
    });

    if (invalidLines.length > 0) {
      notify.error(`Invalid proxy format:\n${invalidLines.join("\n")}`);
      return;
    }

    setImporting(true);
    try {
      const existingKeys = new Set(
        proxyPools.map((pool) => `${(pool.proxyUrl || "").trim()}|||${(pool.noProxy || "").trim()}`)
      );

      let created = 0;
      let skipped = 0;
      let failed = 0;

      for (const entry of parsedEntries) {
        const dedupeKey = `${entry.proxyUrl}|||`;
        if (existingKeys.has(dedupeKey)) {
          skipped += 1;
          continue;
        }

        const res = await fetch("/api/proxy-pools", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: entry.name,
            proxyUrl: entry.proxyUrl,
            noProxy: "",
            isActive: true,
          }),
        });

        if (res.ok) {
          created += 1;
          existingKeys.add(dedupeKey);
        } else {
          failed += 1;
        }
      }

      await fetchProxyPools();
      setShowBatchImportModal(false);
      notify.success(`Batch import completed: Created ${created}, Skipped ${skipped}, Failed ${failed}`);
    } catch (error) {
      console.log("Error batch importing proxies:", error);
      notify.error("Batch import failed");
    } finally {
      setImporting(false);
    }
  };

  const activeCount = useMemo(
    () => proxyPools.filter((pool) => pool.isActive === true).length,
    [proxyPools]
  );

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
          <h1>Proxy pools</h1>
          <p>
            Outbound proxies the router can send provider traffic through. Assign a pool to a
            connection, then test it here to see whether it still answers.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative" ref={relayMenuRef}>
            <Button
              size="sm"
              variant="secondary"
              icon="rocket_launch"
              onClick={() => setShowRelayMenu(!showRelayMenu)}
            >
              Deploy relay
              <Icon name={showRelayMenu ? "expand_less" : "expand_more"} className="ml-1 text-[16px]" />
            </Button>

            {showRelayMenu && (
              <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-[10px] border border-border bg-surface p-1 shadow-elevated sm:left-auto sm:right-0">
                {[
                  { label: "Cloudflare relay", icon: "cloud", action: openCloudflareModal },
                  { label: "Vercel relay", icon: "cloud_upload", action: openVercelModal },
                  { label: "Deno relay", icon: "terminal", action: openDenoModal },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      item.action();
                      setShowRelayMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-text-main transition-colors hover:bg-surface-2"
                  >
                    <Icon name={item.icon} className="text-[18px] text-text-muted" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button size="sm" variant="secondary" icon="upload" onClick={openBatchImportModal}>
            Batch import
          </Button>
          <Button size="sm" icon="add" onClick={openCreateModal}>
            Add proxy pool
          </Button>
        </div>
      </div>

      {(selectedIds.length > 0 || healthChecking) && (
        <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-primary/30 bg-primary/10 px-3 py-2">
          <Icon name="checklist" className="text-[18px] text-primary" />
          <span className="text-[13px] font-medium text-primary tabular-nums">
            {healthChecking
              ? `Health check ${healthProgress.current}/${healthProgress.total}`
              : `${selectedIds.length} selected`}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={healthChecking ? "progress_activity" : "health_and_safety"}
              onClick={handleHealthCheck}
              disabled={healthChecking || bulkBusy || proxyPools.length === 0}
            >
              {healthChecking ? "Checking…" : "Health check"}
            </Button>
            {selectedIds.length > 0 && (
              <>
                <Button size="sm" variant="secondary" icon="toggle_on" onClick={() => bulkSetActive(true)} disabled={bulkBusy || healthChecking}>
                  Activate
                </Button>
                <Button size="sm" variant="secondary" icon="toggle_off" onClick={() => bulkSetActive(false)} disabled={bulkBusy || healthChecking}>
                  Deactivate
                </Button>
                <Button size="sm" variant="secondary" icon="delete" onClick={bulkDelete} disabled={bulkBusy || healthChecking}>
                  Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection} disabled={bulkBusy || healthChecking}>
                  Clear
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {proxyPools.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Icon name="pool" weight="duotone" className="text-[28px] text-text-muted" />
            <p className="text-sm font-medium text-text-main">No proxy pools configured</p>
            <p className="max-w-md text-[13px] text-text-muted">
              Add one to route provider traffic through a proxy, then assign it to a connection in
              Providers. Requests without an assigned pool go out directly.
            </p>
            <Button icon="add" size="sm" className="mt-2" onClick={openCreateModal}>
              Add proxy pool
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-muted">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="size-4 rounded border-border accent-primary"
              />
              {allSelected ? "Clear selection" : "Select all"}
            </label>
            <p className="text-[13px] text-text-muted tabular-nums">
              {proxyPools.length} pool{proxyPools.length === 1 ? "" : "s"} · {activeCount} active
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] border-collapse text-left" aria-label="Proxy pools">
              <thead>
                <tr className="border-b border-border text-[13px] text-text-muted">
                  <th scope="col" className="w-10 px-4 py-2" />
                  <th scope="col" className="px-3 py-2 font-medium">Pool</th>
                  <th scope="col" className="px-3 py-2 font-medium">Type</th>
                  <th scope="col" className="px-3 py-2 font-medium">Health</th>
                  <th scope="col" className="px-3 py-2 font-medium">Bound</th>
                  <th scope="col" className="px-3 py-2 font-medium">Enabled</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proxyPools.map((pool) => (
                  <tr
                    key={pool.id}
                    className={`border-b border-border-subtle last:border-b-0 transition-colors hover:bg-surface-2/50 ${!pool.isActive ? "text-text-muted" : ""}`}
                  >
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(pool.id)}
                        onChange={() => toggleSelect(pool.id)}
                        aria-label={`Select ${pool.name}`}
                        className="mt-0.5 size-4 rounded border-border accent-primary"
                      />
                    </td>

                    {/* Pool */}
                    <td className="min-w-0 px-3 py-3 align-top">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-sm font-medium text-text-main">{pool.name}</span>
                        <span className="truncate font-mono text-xs text-text-muted">{pool.proxyUrl}</span>
                        {pool.noProxy ? (
                          <span className="truncate text-xs text-text-muted">Bypass: {pool.noProxy}</span>
                        ) : null}
                      </div>
                    </td>

                    {/* Type */}
                    <td className="px-3 py-3 align-top text-[13px] text-text-muted">
                      {RELAY_LABELS[pool.type] || "Direct"}
                    </td>

                    {/* Health: last test result + when */}
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(pool.testStatus)} size="sm" dot>
                            {pool.testStatus || "untested"}
                          </Badge>
                          {pool.isActive ? (
                            <span className="text-xs text-success">Enabled</span>
                          ) : (
                            <span className="text-xs text-text-muted">Disabled</span>
                          )}
                        </div>
                        <span className="text-xs text-text-muted">
                          Last tested {formatDateTime(pool.lastTestedAt)}
                        </span>
                        {pool.lastError ? (
                          <span className="max-w-[20rem] truncate text-xs text-danger" title={pool.lastError}>
                            {pool.lastError}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Bound connections */}
                    <td className="px-3 py-3 align-top text-[13px] tabular-nums text-text-muted">
                      {pool.boundConnectionCount || 0}
                    </td>

                    {/* Enable/disable */}
                    <td className="px-3 py-3 align-top">
                      <Toggle
                        size="sm"
                        checked={pool.isActive === true}
                        onChange={() => handleToggleActive(pool)}
                        ariaLabel={`${pool.isActive ? "Disable" : "Enable"} ${pool.name}`}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTest(pool.id)}
                          disabled={testingId === pool.id}
                          title="Test this proxy now"
                        >
                          {testingId === pool.id ? (
                            <Icon name="progress_activity" className="animate-spin text-[16px]" />
                          ) : (
                            <Icon name="science" className="text-[16px]" />
                          )}
                          {testingId === pool.id ? "Testing…" : "Test"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(pool)}
                          title="Edit pool"
                          aria-label={`Edit ${pool.name}`}
                        >
                          <Icon name="edit" className="text-[16px]" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-text-muted hover:text-danger"
                          onClick={() => handleDelete(pool)}
                          title="Delete pool"
                          aria-label={`Delete ${pool.name}`}
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        isOpen={showBatchImportModal}
        title="Batch import proxies"
        onClose={closeBatchImportModal}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="batch-import-textarea" className="mb-1 block text-[13px] font-medium text-text-main">
              One proxy per line
            </label>
            <textarea
              id="batch-import-textarea"
              value={batchImportText}
              onChange={(e) => setBatchImportText(e.target.value)}
              placeholder={"http://user:pass@127.0.0.1:7897\n127.0.0.1:7897:user:pass"}
              className="min-h-[180px] w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-[13px] text-text-main transition-colors placeholder:text-text-subtle focus:border-primary focus:outline-none"
            />
            <p className="mt-1 text-xs text-text-muted">
              Accepted formats: <code className="font-mono">protocol://user:pass@host:port</code> and{" "}
              <code className="font-mono">host:port:user:pass</code>. Existing pools are skipped.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeBatchImportModal} disabled={importing}>
              Cancel
            </Button>
            <Button onClick={handleBatchImport} disabled={!batchImportText.trim() || importing} loading={importing}>
              Import
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showVercelModal}
        title="Deploy Vercel relay"
        onClose={closeVercelModal}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface-2/40 p-3.5">
            <p className="text-[13px] font-medium text-text-main">What this does</p>
            <p className="text-[13px] leading-relaxed text-text-muted">
              Deploys an edge relay function to Vercel. Provider requests go out through Vercel&apos;s
              edge network instead of this machine&apos;s IP address.
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-text-muted">
              <li>Requests originate from Vercel edge IPs across 20+ regions</li>
              <li>Free tier: 100 GB bandwidth and 500K edge invocations per month</li>
              <li>Deploy several relays on different accounts for more IP diversity</li>
            </ul>
          </div>
          <Input
            label="Vercel API token"
            value={vercelForm.vercelToken}
            onChange={(e) => setVercelForm((prev) => ({ ...prev, vercelToken: e.target.value }))}
            placeholder="your-vercel-api-token"
            hint={<>Used once for deployment and not stored. <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get a token →</a></>}
            type="password"
          />
          <Input
            label="Project name"
            value={vercelForm.projectName}
            onChange={(e) => setVercelForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="my-relay"
            hint="Unique Vercel project name. Leave empty to let Vercel generate one."
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeVercelModal} disabled={deploying}>
              Cancel
            </Button>
            <Button
              onClick={handleVercelDeploy}
              disabled={!vercelForm.vercelToken.trim() || deploying}
              loading={deploying}
            >
              {deploying ? "Deploying (about a minute)…" : "Deploy"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showCloudflareModal}
        title="Deploy Cloudflare relay"
        onClose={closeCloudflareModal}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface-2/40 p-3.5">
            <p className="text-[13px] font-medium text-text-main">What this does</p>
            <p className="text-[13px] leading-relaxed text-text-muted">
              Deploys a Cloudflare Worker that forwards provider requests through Cloudflare&apos;s
              global edge network.
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-text-muted">
              <li>Global routing and IP masking via Workers</li>
              <li>Free tier: 100,000 requests per day</li>
              <li>Needs an Account ID and a Workers API token with Edit permission</li>
            </ul>
            <div className="mt-2 border-t border-border-subtle pt-2 text-[13px] text-text-muted">
              <p className="mb-1 font-medium text-text-main">Create the API token</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Open My Profile → API Tokens → Create Token</li>
                <li>Scroll to Custom Token and click Get started</li>
                <li>Permissions: Account | Workers Scripts | Edit</li>
                <li>Account Resources: Include | Account | your account</li>
                <li>Continue to summary → Create Token</li>
              </ol>
            </div>
          </div>
          <Input
            label="Account ID"
            value={cloudflareForm.accountId}
            onChange={(e) => setCloudflareForm((prev) => ({ ...prev, accountId: e.target.value }))}
            placeholder="your-cloudflare-account-id"
            hint="Shown on the right side of the Cloudflare dashboard overview."
          />
          <Input
            label="API token"
            value={cloudflareForm.apiToken}
            onChange={(e) => setCloudflareForm((prev) => ({ ...prev, apiToken: e.target.value }))}
            placeholder="your-cloudflare-api-token"
            hint={<>Needs the &quot;Workers Scripts: Edit&quot; permission. <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Get a token →</a></>}
            type="password"
          />
          <Input
            label="Worker name"
            value={cloudflareForm.projectName}
            onChange={(e) => setCloudflareForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="my-relay"
            hint="Unique Worker name. Leave empty to let Cloudflare generate one."
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeCloudflareModal} disabled={deploying}>
              Cancel
            </Button>
            <Button
              onClick={handleCloudflareDeploy}
              disabled={!cloudflareForm.accountId.trim() || !cloudflareForm.apiToken.trim() || deploying}
              loading={deploying}
            >
              {deploying ? "Deploying…" : "Deploy worker"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDenoModal}
        title="Deploy Deno relay"
        onClose={closeDenoModal}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-surface-2/40 p-3.5">
            <p className="text-[13px] font-medium text-text-main">What this does</p>
            <p className="text-[13px] leading-relaxed text-text-muted">
              Deploys a relay worker to Deno Deploy, forwarding provider requests through its edge
              network instead of this machine&apos;s IP address.
            </p>
            <ul className="list-disc space-y-0.5 pl-4 text-[13px] text-text-muted">
              <li>Deno Deploy v2 runs on a global edge network</li>
              <li>Free tier: 1M requests and 100 GiB outbound traffic per month</li>
              <li>No per-request CPU time limit, unlike Vercel or Cloudflare</li>
              <li>Supports up to 20 active apps and 50 custom domains</li>
            </ul>
            <div className="mt-2 border-t border-border-subtle pt-2 text-[13px] text-text-muted">
              <p className="mb-1 font-medium text-text-main">Create the API token</p>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>Open console.deno.com</li>
                <li>Select your Organization → Settings → Organization Tokens</li>
                <li>Create an Organization Token (prefix ddo_)</li>
              </ol>
            </div>
          </div>
          <Input
            label="Deno Deploy API token"
            value={denoForm.denoToken}
            onChange={(e) => setDenoForm((prev) => ({ ...prev, denoToken: e.target.value }))}
            placeholder="ddo_xxxxxxxxxxxxxxxx"
            hint="Used once for deployment and not stored."
            type="password"
          />
          <Input
            label="Organization domain"
            value={denoForm.orgDomain}
            onChange={(e) => setDenoForm((prev) => ({ ...prev, orgDomain: e.target.value }))}
            placeholder="your-org.deno.net"
            hint="Your relay URL becomes https://<app-name>.<org-domain>"
          />
          <Input
            label="App name"
            value={denoForm.projectName}
            onChange={(e) => setDenoForm((prev) => ({ ...prev, projectName: e.target.value }))}
            placeholder="deno-relay"
            hint="Unique app name. Leave empty to let Deno generate one."
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeDenoModal} disabled={deploying}>
              Cancel
            </Button>
            <Button
              onClick={handleDenoDeploy}
              disabled={!denoForm.denoToken.trim() || !denoForm.orgDomain.trim() || deploying}
              loading={deploying}
            >
              {deploying ? "Deploying…" : "Deploy relay"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showFormModal}
        title={editingProxyPool ? "Edit proxy pool" : "Add proxy pool"}
        onClose={closeFormModal}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Office proxy"
          />
          <Input
            label="Proxy URL"
            value={formData.proxyUrl}
            onChange={(e) => setFormData((prev) => ({ ...prev, proxyUrl: e.target.value }))}
            placeholder="http://127.0.0.1:7897"
          />
          <Input
            label="No proxy"
            value={formData.noProxy}
            onChange={(e) => setFormData((prev) => ({ ...prev, noProxy: e.target.value }))}
            placeholder="localhost,127.0.0.1,.internal"
            hint="Comma-separated hosts and domains that bypass the proxy."
          />

          <div className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-surface-2/40 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-main">Enabled</p>
              <p className="text-[13px] text-text-muted">Disabled pools are ignored when the router resolves a connection&apos;s proxy.</p>
            </div>
            <Toggle
              checked={formData.isActive === true}
              onChange={() => setFormData((prev) => ({ ...prev, isActive: !prev.isActive }))}
              disabled={saving}
              ariaLabel="Pool enabled"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border border-border-subtle bg-surface-2/40 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-main">Strict proxy</p>
              <p className="text-[13px] text-text-muted">Fail the request when the proxy is unreachable instead of falling back to a direct connection.</p>
            </div>
            <Toggle
              checked={formData.strictProxy === true}
              onChange={() => setFormData((prev) => ({ ...prev, strictProxy: !prev.strictProxy }))}
              disabled={saving}
              ariaLabel="Strict proxy"
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={closeFormModal} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || !formData.proxyUrl.trim() || saving}
              loading={saving}
            >
              {editingProxyPool ? "Save changes" : "Add pool"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </div>
  );
}
