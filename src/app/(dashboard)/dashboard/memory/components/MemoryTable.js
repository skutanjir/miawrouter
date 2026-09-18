/**
 * MemoryTable — renders the list of memory entries with actions.
 *
 * Uses Card.ListItem pattern from the project's Card component.
 * Memory entries use `content` (not `text`) to match the backend.
 */

"use client";

import { Badge, Button, Card } from "@/shared/components";

function MemoryRow({ memory, onDelete, isDeleting }) {
  const createdDate = memory.createdAt
    ? new Date(memory.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const tags = memory.metadata?.tags || [];
  const sessionId = memory.sessionId || memory.metadata?.sessionId;

  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 group">
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        <p className="text-xs sm:text-sm text-text-main leading-relaxed select-text break-words">
          {memory.content}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {sessionId && (
            <span
              className="inline-flex items-center gap-1 font-mono text-[10px] text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20"
              title={`Session ID: ${sessionId}`}
            >
              <span className="material-symbols-outlined text-[12px]">terminal</span>
              <span className="truncate max-w-[140px]">{sessionId}</span>
            </span>
          )}
          {tags.map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              {tag}
            </Badge>
          ))}
          {memory.score !== undefined && (
            <Badge variant="info" size="sm" icon="search">
              Score: {Math.abs(memory.score).toFixed(1)}
            </Badge>
          )}
          <span className="text-[11px] font-mono text-text-muted">{createdDate}</span>
        </div>
      </div>
      <div className="shrink-0 flex items-center pt-0.5">
        <Button
          variant="ghost"
          size="sm"
          icon="delete"
          onClick={() => onDelete(memory.id)}
          loading={isDeleting}
          disabled={isDeleting}
          className="text-text-muted hover:text-red-500 hover:bg-red-500/10"
          aria-label={`Delete memory ${memory.id}`}
        />
      </div>
    </div>
  );
}

export default function MemoryTable({
  memories,
  loading,
  error,
  deleting,
  onDelete,
  total,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  isSearch,
}) {
  // Error state
  if (error && !loading) {
    return (
      <Card
        title="Memories"
        icon="psychology"
        action={
          <Button variant="secondary" size="sm" onClick={onRefresh} icon="refresh">
            Retry
          </Button>
        }
      >
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="flex items-center justify-center size-12 rounded-full bg-red-500/10 text-red-500">
            <span className="material-symbols-outlined text-[24px]">error</span>
          </div>
          <p className="text-sm text-red-500 font-medium">{error}</p>
          <p className="text-xs text-text-muted">Check that the memory backend is running.</p>
        </div>
      </Card>
    );
  }

  // Loading state
  if (loading && memories.length === 0) {
    return (
      <Card title="Memories" icon="psychology">
        <div className="flex flex-col gap-3 py-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-3/4" />
              <div className="h-3 bg-surface-2 rounded w-1/3" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Empty state
  if (!loading && memories.length === 0) {
    return (
      <Card title="Memories" icon="psychology">
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="flex items-center justify-center size-12 rounded-full bg-bg text-text-muted">
            <span className="material-symbols-outlined text-[24px]">psychology</span>
          </div>
          <p className="text-sm text-text-muted font-medium">
            {isSearch ? "No matching memories" : "No memories found"}
          </p>
          <p className="text-xs text-text-muted">
            {isSearch ? "Try a different search query." : "Add your first memory to get started."}
          </p>
        </div>
      </Card>
    );
  }

  // Content
  const totalPages = Math.ceil(total / pageSize);
  const startItem = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItem = Math.min(page * pageSize, total);

  return (
    <Card
      title="Memories"
      subtitle={isSearch ? `${memories.length} results` : undefined}
      icon="psychology"
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          loading={loading}
          icon="refresh"
        >
          Refresh
        </Button>
      }
    >
      <div className="divide-y divide-border-subtle">
        {memories.map((memory) => (
          <MemoryRow
            key={memory.id}
            memory={memory}
            onDelete={onDelete}
            isDeleting={deleting.has(memory.id)}
          />
        ))}
      </div>

      {/* Pagination footer — only for list view, not search */}
      {!isSearch && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border-subtle">
          <span className="text-xs text-text-muted">
            Page <span className="font-medium text-text-main">{page}</span>
            {total > pageSize && (
              <> of ~<span className="font-medium text-text-main">{totalPages}</span></>
            )}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="w-8 px-0"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </Button>
            <span className="text-xs text-text-muted px-2">{page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={memories.length < pageSize}
              className="w-8 px-0"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
