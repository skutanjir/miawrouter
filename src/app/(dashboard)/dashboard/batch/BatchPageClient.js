"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  ConfirmModal,
  Drawer,
  Modal,
  Select,
} from "@/shared/components";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/Icon";

const BATCH_API = "/api/batches";

const STATUS_VARIANT = {
  queued: "warning",
  running: "primary",
  completed: "success",
  failed: "danger",
  canceled: "default",
};

const STATUS_ICON = {
  queued: "schedule",
  running: "progress_activity",
  completed: "check_circle",
  failed: "error",
  canceled: "cancel",
};

const EXAMPLE_JSONL = [
  '{"custom_id":"req-1","method":"POST","url":"/v1/chat/completions","body":{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}}',
  '{"custom_id":"req-2","method":"POST","url":"/v1/chat/completions","body":{"model":"gpt-4o-mini","messages":[{"role":"user","content":"World"}]}}',
].join("\n");

function timeAgo(ts) {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function NewBatchModal({ isOpen, onClose, onSubmit, registeredProviders }) {
  const [provider, setProvider] = useState("");
  const [inputFile, setInputFile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevOpen.current) {
      setProvider(registeredProviders[0] || "");
      setInputFile("");
      setError("");
      setSubmitting(false);
    }
    prevOpen.current = isOpen;
  }, [isOpen, registeredProviders]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".jsonl") && !file.name.endsWith(".json")) {
      setError("Please upload a .jsonl file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInputFile(ev.target?.result || "");
      setError("");
    };
    reader.readAsText(file);
  }, []);

  const lineCount = inputFile.trim()
    ? inputFile.trim().split("\n").filter(Boolean).length
    : 0;

  const handleSubmit = async () => {
    if (!provider) {
      setError("Select a provider");
      return;
    }
    if (!inputFile.trim()) {
      setError("Provide JSONL input data (one request per line)");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ provider, input: inputFile });
    } catch (err) {
      setError(err.message || "Failed to create batch job");
    } finally {
      setSubmitting(false);
    }
  };

  const noProviders = registeredProviders.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Batch Job"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            disabled={noProviders}
            icon="send"
          >
            Submit Batch Job
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-xs font-sans">
        <div className="flex items-start gap-2.5 p-3 rounded-md bg-warning/10 border border-warning/20">
          <Icon name="info" className="text-[16px] text-warning mt-0.5 shrink-0" />
          <div className="text-text-muted space-y-1">
            <p>
              <strong className="text-text-main">JSON Lines execution:</strong> submit requests to process concurrently via your chosen provider backend.
            </p>
            {noProviders ? (
              <p className="text-warning font-medium">
                No batch-capable providers are currently connected.
              </p>
            ) : (
              <p>
                Target provider: <strong className="text-text-main font-mono">{provider || "Select below"}</strong>
              </p>
            )}
          </div>
        </div>

        <Select
          label="Provider"
          options={registeredProviders.map((p) => ({ value: p, label: p }))}
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          placeholder={noProviders ? "No batch providers available" : "Select a provider"}
          disabled={noProviders}
          required
        />

        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-main">
            Input Data (JSONL) <span className="text-danger ml-0.5">*</span>
          </label>
          <p className="text-[11px] text-text-muted">
            One JSON request per line. Each record must have a <code className="bg-surface-2 px-1 py-0.5 rounded font-mono">custom_id</code> field.
          </p>

          <div className="flex gap-2 items-center">
            <Button
              variant="secondary"
              size="sm"
              icon="upload_file"
              onClick={() => fileRef.current?.click()}
            >
              Upload .jsonl
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".jsonl,.json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost"
              size="sm"
              icon="content_paste"
              onClick={() => {
                setInputFile(EXAMPLE_JSONL);
                setError("");
              }}
            >
              Load Example
            </Button>
            {lineCount > 0 && (
              <Badge variant="success" size="sm">
                {lineCount} record{lineCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          <textarea
            value={inputFile}
            onChange={(e) => {
              setInputFile(e.target.value);
              setError("");
            }}
            placeholder={EXAMPLE_JSONL}
            rows={6}
            className="w-full p-2.5 text-xs font-mono text-text-main bg-surface-2 rounded-md border border-border placeholder:text-text-muted outline-none focus:border-primary transition-colors resize-y min-h-[140px] custom-scrollbar"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/20 text-danger">
            <Icon name="error" className="text-[16px] shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function BatchPageClient() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [detailBatch, setDetailBatch] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [registeredProviders, setRegisteredProviders] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Artifact states for Drawer
  const [activeTab, setActiveTab] = useState("overview");
  const [resultData, setResultData] = useState(null);
  const [errorData, setErrorData] = useState(null);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(BATCH_API, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      setBatches(data.batches || []);
      setRegisteredProviders(Array.isArray(data.providers) ? data.providers : []);
    } catch (err) {
      setError(err.message || "Failed to load batch jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll for active jobs
  useEffect(() => {
    const hasActive = batches.some((b) => b.status === "queued" || b.status === "running");
    if (!hasActive) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, [batches, load]);

  const loadArtifact = useCallback(async (batch, type) => {
    if (!batch) return;
    setLoadingArtifacts(true);
    try {
      const res = await fetch(`${BATCH_API}/${batch.id}/${type}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to load ${type}`);
      }
      const text = await res.text();
      if (type === "results") setResultData(text);
      else setErrorData(text);
    } catch (err) {
      if (type === "results") setResultData(`Error: ${err.message}`);
      else setErrorData(`Error: ${err.message}`);
    } finally {
      setLoadingArtifacts(false);
    }
  }, []);

  useEffect(() => {
    if (detailBatch && activeTab === "results" && !resultData) {
      loadArtifact(detailBatch, "results");
    } else if (detailBatch && activeTab === "errors" && !errorData) {
      loadArtifact(detailBatch, "errors");
    }
  }, [detailBatch, activeTab, resultData, errorData, loadArtifact]);

  const handleOpenDetail = (batch) => {
    setDetailBatch(batch);
    setActiveTab("overview");
    setResultData(null);
    setErrorData(null);
  };

  const handleCreateBatch = async ({ provider, input }) => {
    const res = await fetch(BATCH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, input }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed (${res.status})`);
    }
    setShowNewBatch(false);
    await load();
  };

  const handleCancel = async (batch) => {
    try {
      const res = await fetch(`${BATCH_API}/${batch.id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      setConfirmAction(null);
      await load();
    } catch (err) {
      setError(err.message || "Failed to cancel batch");
    }
  };

  const handleRetry = async (batch) => {
    try {
      const res = await fetch(`${BATCH_API}/${batch.id}/retry`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err.message || "Failed to retry batch");
    }
  };

  const handleDelete = async (batch) => {
    try {
      const res = await fetch(`${BATCH_API}/${batch.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      setConfirmAction(null);
      if (detailBatch?.id === batch.id) setDetailBatch(null);
      await load();
    } catch (err) {
      setError(err.message || "Failed to delete batch");
    }
  };

  const counts = { queued: 0, running: 0, completed: 0, failed: 0, canceled: 0 };
  let totalRecords = 0;
  for (const b of batches) {
    counts[b.status] = (counts[b.status] || 0) + 1;
    totalRecords += b.recordCount || b.totalRequests || 0;
  }

  const filtered = batches.filter((b) => {
    const matchesFilter = filter === "all" || b.status === filter;
    const matchesSearch =
      !search.trim() ||
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      (b.provider && b.provider.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="batch_prediction" className="text-primary text-[24px]" />
            Batch Jobs
          </h1>
          <p className="text-sm text-text-muted mt-0.5">
            Submit and track bulk prompt workloads routed through configured model providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            icon="refresh"
          >
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowNewBatch(true)}
            icon="add"
            disabled={registeredProviders.length === 0}
          >
            New Batch Job
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/30 text-xs text-danger" padding="sm">
          {error}
        </Card>
      )}

      {/* ── Stats ────────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="batch_prediction" className="text-[16px]" />
            <span>Total Jobs</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : batches.length}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">{totalRecords.toLocaleString()} records processed</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="progress_activity" className="text-[16px]" />
            <span>Active Jobs</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main">
            {loading ? "—" : counts.queued + counts.running}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {loading ? "" : `${counts.running} running · ${counts.queued} queued`}
          </p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="check_circle" className="text-[16px]" />
            <span>Completed</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main text-success">
            {loading ? "—" : counts.completed}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">ready for download</p>
        </div>

        <div className="p-3 rounded-[10px] border border-border bg-surface">
          <div className="flex items-center gap-2 text-text-muted mb-1 text-[11px]">
            <Icon name="error" className="text-[16px]" />
            <span>Failed / Canceled</span>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-text-main text-danger">
            {loading ? "—" : counts.failed + counts.canceled}
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            {loading ? "" : `${counts.failed} failed · ${counts.canceled} canceled`}
          </p>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-xs">
            <Icon name="search" className="text-text-muted text-[16px] shrink-0" />
            <input
              type="text"
              placeholder="Search by job ID or provider…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-text-main outline-none placeholder:text-text-muted text-xs font-sans"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-text-muted hover:text-text-main cursor-pointer">
                <Icon name="close" className="text-[14px]" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded-md bg-surface-2 border border-border overflow-x-auto">
          {["all", "running", "queued", "completed", "failed", "canceled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer capitalize whitespace-nowrap ${
                filter === s
                  ? "bg-surface text-text-main font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {s}
              {s !== "all" && counts[s] !== undefined && (
                <span className="ml-1 font-mono text-[10px]">({counts[s]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Dense Table ─────────────────────────────────────────── */}
      {loading ? (
        <CardSkeleton />
      ) : batches.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Icon name="batch_prediction" className="text-[32px] text-text-muted mb-2" />
            <p className="text-sm font-semibold text-text-main">No batch jobs yet</p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Submit JSONL prompts to process large request batches offline with automatic result artifacts.
            </p>
            <Button
              variant="primary"
              size="sm"
              icon="add"
              className="mt-4"
              onClick={() => setShowNewBatch(true)}
              disabled={registeredProviders.length === 0}
            >
              New Batch Job
            </Button>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card padding="md">
          <div className="py-8 text-center text-xs text-text-muted">
            No batch jobs found matching filter &quot;{filter}&quot;.
          </div>
        </Card>
      ) : (
        <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
                  <th className="py-2.5 px-4 font-semibold text-text-main">Batch ID</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Provider</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden sm:table-cell">Records</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main hidden md:table-cell">Size</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main">Submitted</th>
                  <th className="py-2.5 px-4 font-semibold text-text-main text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map((batch) => {
                  const isTerminal = ["completed", "failed", "canceled"].includes(batch.status);
                  const canCancel = batch.status === "queued" || batch.status === "running";
                  const canRetry = batch.status === "failed";

                  return (
                    <tr
                      key={batch.id}
                      onClick={() => handleOpenDetail(batch)}
                      className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-4 font-mono font-semibold text-text-main max-w-[200px] truncate">
                        {batch.id.slice(0, 18)}…
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <Badge variant={STATUS_VARIANT[batch.status] || "default"} size="sm" dot>
                          {batch.status}
                        </Badge>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-text-muted">
                        {batch.provider}
                      </td>

                      <td className="py-2.5 px-4 hidden sm:table-cell font-mono tabular-nums text-text-muted">
                        {batch.recordCount ?? batch.totalRequests ?? 0}
                      </td>

                      <td className="py-2.5 px-4 hidden md:table-cell font-mono tabular-nums text-[11px] text-text-muted">
                        {formatBytes(batch.inputBytes)}
                      </td>

                      <td className="py-2.5 px-4 font-mono text-[11px] text-text-muted whitespace-nowrap">
                        {timeAgo(batch.createdAt)}
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="visibility"
                            onClick={() => handleOpenDetail(batch)}
                            title="View details"
                            aria-label={`View batch ${batch.id}`}
                          />
                          {canCancel && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="cancel"
                              onClick={() => setConfirmAction({ type: "cancel", batch })}
                              title="Cancel batch"
                              aria-label="Cancel batch"
                              className="text-warning hover:text-warning"
                            />
                          )}
                          {canRetry && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="replay"
                              onClick={() => handleRetry(batch)}
                              title="Retry batch"
                              aria-label="Retry batch"
                              className="text-primary hover:text-primary"
                            />
                          )}
                          {isTerminal && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="delete"
                              onClick={() => setConfirmAction({ type: "delete", batch })}
                              title="Delete batch"
                              aria-label="Delete batch"
                              className="text-text-muted hover:text-danger hover:bg-danger/10"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ────────────────────────────────────────── */}
      <Drawer
        isOpen={!!detailBatch}
        onClose={() => setDetailBatch(null)}
        title={detailBatch ? `Batch ${detailBatch.id.slice(0, 16)}…` : "Batch Details"}
        width="lg"
      >
        {detailBatch && (
          <div className="space-y-5 text-xs text-text-main font-sans">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-2">
              {["overview", "results", "errors"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize cursor-pointer transition-colors ${
                    activeTab === tab
                      ? "bg-surface-2 text-primary font-semibold"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                    <span className="text-[11px] text-text-muted block">Status</span>
                    <div className="mt-1">
                      <Badge variant={STATUS_VARIANT[detailBatch.status] || "default"} size="sm" dot>
                        {detailBatch.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                    <span className="text-[11px] text-text-muted block">Provider</span>
                    <p className="mt-1 font-mono font-semibold text-text-main">{detailBatch.provider}</p>
                  </div>
                  <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                    <span className="text-[11px] text-text-muted block">Records</span>
                    <p className="mt-1 font-mono tabular-nums font-semibold text-text-main">
                      {detailBatch.recordCount ?? detailBatch.totalRequests ?? 0}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-surface-2 border border-border-subtle">
                    <span className="text-[11px] text-text-muted block">Input Size</span>
                    <p className="mt-1 font-mono tabular-nums font-semibold text-text-main">
                      {formatBytes(detailBatch.inputBytes)}
                    </p>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Batch ID</span>
                  <code className="block mt-1 p-2 rounded bg-surface-2 font-mono text-[11px] select-all">
                    {detailBatch.id}
                  </code>
                </div>

                {detailBatch.error && (
                  <div className="p-3 rounded-md bg-danger/10 border border-danger/20 text-danger">
                    <span className="font-semibold block mb-0.5">Error details</span>
                    <p className="font-mono text-[11px] leading-relaxed">{detailBatch.error}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Output JSONL
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="download"
                    onClick={() => window.open(`${BATCH_API}/${detailBatch.id}/results`, "_blank")}
                  >
                    Download
                  </Button>
                </div>
                {loadingArtifacts ? (
                  <div className="p-6 text-center text-text-muted">Loading results…</div>
                ) : resultData ? (
                  <pre className="p-3 bg-surface-2 rounded-md border border-border-subtle font-mono text-[11px] text-text-main overflow-x-auto max-h-[420px] custom-scrollbar whitespace-pre-wrap break-all">
                    {resultData}
                  </pre>
                ) : (
                  <p className="text-text-muted py-4">No results available yet.</p>
                )}
              </div>
            )}

            {activeTab === "errors" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Error Log
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="download"
                    onClick={() => window.open(`${BATCH_API}/${detailBatch.id}/errors`, "_blank")}
                  >
                    Download
                  </Button>
                </div>
                {loadingArtifacts ? (
                  <div className="p-6 text-center text-text-muted">Loading error log…</div>
                ) : errorData ? (
                  <pre className="p-3 bg-surface-2 rounded-md border border-border-subtle font-mono text-[11px] text-danger overflow-x-auto max-h-[420px] custom-scrollbar whitespace-pre-wrap break-all">
                    {errorData}
                  </pre>
                ) : (
                  <p className="text-text-muted py-4">No errors recorded for this batch.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <NewBatchModal
        isOpen={showNewBatch}
        onClose={() => setShowNewBatch(false)}
        onSubmit={handleCreateBatch}
        registeredProviders={registeredProviders}
      />

      <ConfirmModal
        isOpen={confirmAction?.type === "cancel"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleCancel(confirmAction?.batch)}
        title="Cancel Batch Job"
        message={`Cancel batch ${confirmAction?.batch?.id?.slice(0, 16) || ""}…? Active records will stop processing.`}
        confirmText="Cancel Batch"
        variant="warning"
      />

      <ConfirmModal
        isOpen={confirmAction?.type === "delete"}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => handleDelete(confirmAction?.batch)}
        title="Delete Batch Job"
        message={`Permanently delete batch ${confirmAction?.batch?.id?.slice(0, 16) || ""}…? This removes all stored artifacts.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
