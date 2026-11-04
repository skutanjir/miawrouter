"use client";

import { Badge, Button, Card } from "@/shared/components";
import { Icon } from "@/shared/components/Icon";

export default function MemoryTable({
  memories,
  loading,
  error,
  deleting,
  onDelete,
  onSelectMemory,
  total,
  page,
  pageSize,
  onPageChange,
  onRefresh,
  isSearch,
}) {
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
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="flex items-center justify-center size-10 rounded-full bg-danger/10 text-danger">
            <Icon name="error" className="text-[20px]" />
          </div>
          <p className="text-xs text-danger font-medium">{error}</p>
          <p className="text-xs text-text-muted">Ensure the memory store or SQLite backend is reachable.</p>
        </div>
      </Card>
    );
  }

  if (loading && memories.length === 0) {
    return (
      <Card title="Memories" icon="psychology">
        <div className="divide-y divide-border-subtle py-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="py-3 flex items-center justify-between gap-4 animate-pulse">
              <div className="space-y-1.5 flex-1">
                <div className="h-3.5 bg-surface-2 rounded w-3/4" />
                <div className="h-2.5 bg-surface-2 rounded w-1/4" />
              </div>
              <div className="h-6 w-12 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!loading && memories.length === 0) {
    return (
      <Card title="Memories" icon="psychology">
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <div className="flex items-center justify-center size-10 rounded-full bg-surface-2 text-text-muted mb-1">
            <Icon name="psychology" className="text-[20px]" />
          </div>
          <p className="text-sm font-semibold text-text-main">
            {isSearch ? "No matching memories" : "No memories stored"}
          </p>
          <p className="text-xs text-text-muted max-w-sm">
            {isSearch
              ? "Try adjusting your search terms or clearing the query filter."
              : "Store semantic memories or context snippets for agent retrieval."}
          </p>
        </div>
      </Card>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="rounded-[10px] border border-border bg-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-2/60 text-text-muted font-medium">
              <th className="py-2.5 px-4 font-semibold text-text-main">Content</th>
              <th className="py-2.5 px-4 font-semibold text-text-main hidden sm:table-cell">Metadata & Session</th>
              <th className="py-2.5 px-4 font-semibold text-text-main hidden md:table-cell">Score</th>
              <th className="py-2.5 px-4 font-semibold text-text-main">Created</th>
              <th className="py-2.5 px-4 font-semibold text-text-main text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle font-sans">
            {memories.map((memory) => {
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
              const isDeleting = deleting.has(memory.id);

              return (
                <tr
                  key={memory.id}
                  onClick={() => onSelectMemory?.(memory)}
                  className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                >
                  <td className="py-2.5 px-4 max-w-[280px] sm:max-w-md">
                    <p className="truncate text-xs font-medium text-text-main leading-snug">
                      {memory.content}
                    </p>
                    {sessionId && (
                      <span className="sm:hidden inline-flex items-center gap-1 font-mono text-[10px] text-primary mt-1">
                        <Icon name="terminal" className="text-[11px]" />
                        <span className="truncate max-w-[120px]">{sessionId}</span>
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 hidden sm:table-cell">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sessionId && (
                        <span
                          className="inline-flex items-center gap-1 font-mono text-[10px] text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20"
                          title={`Session ID: ${sessionId}`}
                        >
                          <Icon name="terminal" className="text-[11px]" />
                          <span className="truncate max-w-[120px]">{sessionId}</span>
                        </span>
                      )}
                      {tags.map((tag) => (
                        <Badge key={tag} variant="default" size="sm">
                          {tag}
                        </Badge>
                      ))}
                      {!sessionId && tags.length === 0 && (
                        <span className="text-[11px] text-text-muted font-mono">—</span>
                      )}
                    </div>
                  </td>

                  <td className="py-2.5 px-4 hidden md:table-cell font-mono tabular-nums text-text-muted">
                    {memory.score !== undefined ? (
                      <Badge variant="info" size="sm">
                        {Math.abs(memory.score).toFixed(2)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="py-2.5 px-4 font-mono text-[11px] text-text-muted whitespace-nowrap">
                    {createdDate}
                  </td>

                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="visibility"
                        onClick={() => onSelectMemory?.(memory)}
                        title="View details"
                        aria-label="View memory details"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="delete"
                        onClick={() => onDelete(memory.id)}
                        loading={isDeleting}
                        disabled={isDeleting}
                        className="text-text-muted hover:text-danger hover:bg-danger/10"
                        title="Delete memory"
                        aria-label={`Delete memory ${memory.id}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isSearch && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-2/40 text-xs text-text-muted">
          <span>
            Page <strong className="text-text-main font-mono">{page}</strong> of{" "}
            <strong className="text-text-main font-mono">{totalPages}</strong>
            <span className="ml-2 font-mono tabular-nums text-[11px]">({total} entries)</span>
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              icon="chevron_left"
              aria-label="Previous page"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={memories.length < pageSize}
              icon="chevron_right"
              aria-label="Next page"
            />
          </div>
        </div>
      )}
    </div>
  );
}
