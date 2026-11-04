/**
 * MemoryPageClient — main client component for the Memory dashboard page.
 * Switchboard redesign: header + toolbar (search/filter/create) + dense table, detail in drawer.
 */

"use client";

import { useCallback, useState } from "react";
import { Badge, Button, Card, CardSkeleton, Drawer, Input } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import { useMemoryApi } from "./useMemoryApi";
import MemoryTable from "./MemoryTable";
import AddMemoryModal from "./AddMemoryModal";
import { Icon } from "@/shared/components/Icon";

export default function MemoryPageClient() {
  const notify = useNotificationStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [selectedMemory, setSelectedMemory] = useState(null);

  const {
    memories,
    total,
    page,
    pageSize,
    query,
    listLoading,
    listError,
    fetchMemories,
    search,
    goToPage,
    // Health
    health,
    healthLoading,
    fetchHealth,
    // CRUD
    addMemory,
    adding,
    deleteMemory,
    deleting,
    // Reindex
    reindex,
    reindexing,
    reindexResult,
  } = useMemoryApi();

  const handleSearch = useCallback(
    (e) => {
      e?.preventDefault?.();
      search(searchInput);
    },
    [search, searchInput]
  );

  const handleAdd = useCallback(
    async ({ content, metadata }) => {
      const result = await addMemory({ content, metadata });
      if (result.ok) {
        notify.success("Memory added successfully");
      } else {
        notify.error(result.error || "Failed to add memory");
      }
      return result;
    },
    [addMemory, notify]
  );

  const handleDelete = useCallback(
    async (id) => {
      const result = await deleteMemory(id);
      if (result.ok) {
        notify.success("Memory deleted");
        if (selectedMemory?.id === id) setSelectedMemory(null);
      } else {
        notify.error(result.error || "Failed to delete memory");
      }
    },
    [deleteMemory, notify, selectedMemory]
  );

  const handleReindex = useCallback(async () => {
    const result = await reindex();
    if (result.ok) {
      notify.success(`Reindex complete — ${result.data?.indexed ?? 0} entries indexed`);
    } else {
      notify.error(result.error || "Reindex failed");
    }
  }, [reindex, notify]);

  const handleRefreshAll = useCallback(() => {
    fetchMemories();
    fetchHealth();
  }, [fetchMemories, fetchHealth]);

  const isHealthy = health?.ok === true;

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0 font-sans">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2.5 leading-tight text-text-main">
            <Icon name="psychology" className="text-primary text-[24px]" />
            Memory
          </h1>
          <p className="text-sm text-text-muted">
            Store and retrieve conversational memories powered by semantic vector and FTS5 search.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshAll}
            disabled={listLoading || healthLoading}
            icon="refresh"
          >
            Refresh
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReindex}
            loading={reindexing}
            icon="sync"
          >
            Reindex
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddModal(true)}
            icon="add"
          >
            Add Memory
          </Button>
        </div>
      </div>

      {/* ── Status Bar / Stats ───────────────────────────────────── */}
      {healthLoading && !health ? (
        <CardSkeleton />
      ) : health ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-[10px] border border-border bg-surface">
            <span className="text-[11px] text-text-muted">Status</span>
            <div className="mt-1 flex items-center gap-1.5">
              <Badge variant={isHealthy ? "success" : "error"} dot size="sm">
                {isHealthy ? "Healthy" : "Degraded"}
              </Badge>
            </div>
          </div>
          <div className="p-3 rounded-[10px] border border-border bg-surface">
            <span className="text-[11px] text-text-muted">Driver</span>
            <p className="mt-1 font-mono text-sm font-semibold text-text-main">{health.driver || "sqlite-fts5"}</p>
          </div>
          <div className="p-3 rounded-[10px] border border-border bg-surface">
            <span className="text-[11px] text-text-muted">Total Entries</span>
            <p className="mt-1 font-mono tabular-nums text-sm font-semibold text-text-main">{health.entries ?? total}</p>
          </div>
          <div className="p-3 rounded-[10px] border border-border bg-surface">
            <span className="text-[11px] text-text-muted">Indexed Entries</span>
            <p className="mt-1 font-mono tabular-nums text-sm font-semibold text-text-main">{health.indexed ?? "—"}</p>
          </div>
        </div>
      ) : null}

      {/* ── Reindex Feedback ────────────────────────────────────── */}
      {reindexResult && !reindexing && (
        <Card padding="sm" className="border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 text-xs text-text-main">
            <Icon name="check_circle" className="text-primary text-[16px]" />
            <span>
              Reindexed <strong>{reindexResult.indexed}</strong> entries into search index.
            </span>
          </div>
        </Card>
      )}

      {/* ── Toolbar (Search / Filters) ───────────────────────────── */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            icon="search"
            placeholder="Search memories by content or tag…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="md" type="submit" disabled={listLoading}>
          Search
        </Button>
        {query && (
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setSearchInput("");
              search("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* ── Dense Memory Table ───────────────────────────────────── */}
      <MemoryTable
        memories={memories}
        loading={listLoading}
        error={listError}
        deleting={deleting}
        onDelete={handleDelete}
        onSelectMemory={setSelectedMemory}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={goToPage}
        onRefresh={fetchMemories}
        isSearch={!!query}
      />

      {/* ── Detail Drawer ────────────────────────────────────────── */}
      <Drawer
        isOpen={!!selectedMemory}
        onClose={() => setSelectedMemory(null)}
        title="Memory Details"
        width="md"
      >
        {selectedMemory && (
          <div className="space-y-5 text-xs text-text-main">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Content</span>
              <div className="mt-1.5 p-3 rounded-md bg-surface-2 border border-border-subtle whitespace-pre-wrap break-words leading-relaxed select-text font-sans text-sm">
                {selectedMemory.content}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">ID</span>
                <code className="block mt-1 p-2 rounded bg-surface-2 font-mono text-[11px] text-text-muted truncate select-all">
                  {selectedMemory.id}
                </code>
              </div>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Created</span>
                <p className="mt-1 p-2 font-mono text-[11px] text-text-main">
                  {selectedMemory.createdAt ? new Date(selectedMemory.createdAt).toLocaleString() : "—"}
                </p>
              </div>
            </div>

            {selectedMemory.sessionId && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Session ID</span>
                <code className="block mt-1 p-2 rounded bg-surface-2 font-mono text-[11px] text-primary truncate select-all">
                  {selectedMemory.sessionId}
                </code>
              </div>
            )}

            {selectedMemory.score !== undefined && (
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Search Score</span>
                <p className="mt-1 font-mono text-sm font-semibold text-text-main">
                  {Math.abs(selectedMemory.score).toFixed(4)}
                </p>
              </div>
            )}

            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">Metadata</span>
              <pre className="mt-1 p-3 rounded-md bg-surface-2 border border-border-subtle font-mono text-[11px] overflow-x-auto max-h-48 custom-scrollbar">
                {JSON.stringify(selectedMemory.metadata || {}, null, 2)}
              </pre>
            </div>

            <div className="pt-4 border-t border-border flex justify-end gap-2">
              <Button
                variant="danger"
                size="sm"
                icon="delete"
                onClick={() => handleDelete(selectedMemory.id)}
                loading={deleting.has(selectedMemory.id)}
              >
                Delete Memory
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ── Add Memory Modal ────────────────────────────────────── */}
      <AddMemoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
        loading={adding}
      />
    </div>
  );
}
