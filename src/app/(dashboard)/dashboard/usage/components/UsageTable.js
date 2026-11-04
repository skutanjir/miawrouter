"use client";

import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import PropTypes from "prop-types";
import Card from "@/shared/components/Card";

import { Icon } from "@/shared/components/Icon";
const fmt = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(2)}`;

function fmtTime(iso) {
  if (!iso) return "Never";
  const diffMins = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function SortIcon({ field, currentSort, currentOrder }) {
  if (currentSort !== field) return <span className="ml-1 opacity-40">↕</span>;
  return <span className="ml-1 text-primary font-semibold">{currentOrder === "asc" ? "↑" : "↓"}</span>;
}

SortIcon.propTypes = {
  field: PropTypes.string.isRequired,
  currentSort: PropTypes.string.isRequired,
  currentOrder: PropTypes.string.isRequired,
};

/**
 * Render 4 token or cost cells based on viewMode
 */
function ValueCells({ item, viewMode, isSummary = false }) {
  if (viewMode === "tokens") {
    return (
      <>
        <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted min-w-[90px]">
          {isSummary && item.promptTokens === undefined ? "—" : fmt(item.promptTokens)}
        </td>
        <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums min-w-[90px]">
          {item.cachedTokens ? (
            <span className="text-primary font-medium">{fmt(item.cachedTokens)}</span>
          ) : (
            <span className="text-text-subtle">—</span>
          )}
        </td>
        <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted min-w-[90px]">
          {isSummary && item.completionTokens === undefined ? "—" : fmt(item.completionTokens)}
        </td>
        <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums font-semibold text-text-main min-w-[115px]">
          <span>{fmt(item.totalTokens)}</span>
        </td>
      </>
    );
  }
  return (
    <>
      <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted min-w-[90px]">
        {isSummary && item.inputCost === undefined ? "—" : fmtCost(item.inputCost)}
      </td>
      <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums min-w-[90px]">
        {item.cachedCost ? (
          <span className="text-primary font-medium">{fmtCost(item.cachedCost)}</span>
        ) : (
          <span className="text-text-subtle">—</span>
        )}
      </td>
      <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums text-text-muted min-w-[90px]">
        {isSummary && item.outputCost === undefined ? "—" : fmtCost(item.outputCost)}
      </td>
      <td className="px-3.5 py-2.5 text-right font-mono text-xs tabular-nums font-semibold text-text-main min-w-[115px]">
        <span>{fmtCost(item.totalCost || item.cost)}</span>
      </td>
    </>
  );
}

ValueCells.propTypes = {
  item: PropTypes.object.isRequired,
  viewMode: PropTypes.string.isRequired,
  isSummary: PropTypes.bool,
};

/**
 * Reusable sortable usage table with expandable group rows.
 */
export default function UsageTable({
  title,
  columns,
  groupedData,
  tableType,
  sortBy,
  sortOrder,
  onToggleSort,
  viewMode,
  storageKey,
  renderDetailCells,
  renderSummaryCells,
  emptyMessage,
}) {
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // ignore
    }
    return new Set();
  });

  // Save expanded state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...expanded]));
    } catch (e) {
      console.error(`Failed to save ${storageKey}:`, e);
    }
  }, [expanded, storageKey]);

  const toggleGroup = useCallback((groupKey) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(groupKey) ? next.delete(groupKey) : next.add(groupKey);
      return next;
    });
  }, []);

  const allExpanded = groupedData.length > 0 && groupedData.every((g) => expanded.has(g.groupKey));
  const toggleAllGroups = useCallback(() => {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(groupedData.map((g) => g.groupKey)));
    }
  }, [allExpanded, groupedData]);

  const valueColumns = useMemo(() => {
    if (viewMode === "tokens") {
      return [
        { field: "promptTokens", label: "Input Tokens" },
        { field: "cachedTokens", label: "Cached" },
        { field: "completionTokens", label: "Output Tokens" },
        { field: "totalTokens", label: "Total Tokens" },
      ];
    }
    return [
      { field: "promptTokens", label: "Input Cost" },
      { field: "cachedCost", label: "Cached Cost" },
      { field: "completionTokens", label: "Output Cost" },
      { field: "cost", label: "Total Cost" },
    ];
  }, [viewMode]);

  const totalColSpan = columns.length + valueColumns.length;

  return (
    <Card padding="none" className="overflow-hidden border border-border bg-surface">
      {(title || groupedData.length > 0) && (
        <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-2/60 px-4 py-2">
          <div className="flex items-center gap-2">
            {title && <h3 className="text-xs font-semibold text-text-main">{title}</h3>}
            <span className="font-mono text-[11px] text-text-muted">
              {groupedData.length} {groupedData.length === 1 ? "group" : "groups"}
            </span>
          </div>
          {groupedData.length > 0 && (
            <button
              type="button"
              onClick={toggleAllGroups}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-muted hover:text-text-main transition-colors"
            >
              <Icon name={allExpanded ? "expand_less" : "expand_more"} className="text-[12px]" />
              <span>{allExpanded ? "Collapse all" : "Expand all"}</span>
            </button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-20 border-b border-border-subtle bg-surface-2 text-xs text-text-muted select-none">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={col.field}
                  className={`px-3.5 py-2.5 font-semibold transition-colors hover:text-text-main hover:bg-surface ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${
                    idx === 0
                      ? "sticky left-0 z-20 bg-surface-2 max-w-[200px] sm:max-w-none border-r border-border-subtle"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggleSort(tableType, col.field)}
                    className={`inline-flex items-center gap-1 min-h-[44px] sm:min-h-[28px] w-full ${
                      col.align === "right" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span>{col.label}</span>
                    <SortIcon field={col.field} currentSort={sortBy} currentOrder={sortOrder} />
                  </button>
                </th>
              ))}
              {valueColumns.map((col) => (
                <th
                  key={col.field}
                  className="px-3.5 py-2.5 text-right font-semibold transition-colors hover:text-text-main hover:bg-surface min-w-[90px]"
                >
                  <button
                    type="button"
                    onClick={() => onToggleSort(tableType, col.field)}
                    className="inline-flex items-center justify-end gap-1 min-h-[44px] sm:min-h-[28px] w-full"
                  >
                    <span>{col.label}</span>
                    <SortIcon field={col.field} currentSort={sortBy} currentOrder={sortOrder} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {groupedData.map((group) => {
              return (
                <Fragment key={group.groupKey}>
                  {/* Group summary row */}
                  <tr
                    className="group-summary cursor-pointer bg-surface hover:bg-surface-2 transition-colors min-h-[44px]"
                    onClick={() => toggleGroup(group.groupKey)}
                  >
                    <td className="px-3.5 py-2.5 sticky left-0 z-10 bg-surface group-hover:bg-surface-2 border-r border-border-subtle">
                      <button
                        type="button"
                        aria-expanded={expanded.has(group.groupKey)}
                        className="flex items-center gap-2 text-left w-full min-h-[44px] sm:min-h-[28px]"
                      >
                        <Icon name={"chevron_right"} className={` text-[16px] text-text-muted transition-transform duration-150 shrink-0 ${expanded.has(group.groupKey) ? "rotate-90" : ""}`} />
                        <span className={`font-semibold text-xs transition-colors truncate ${group.summary.pending > 0 ? "text-primary" : "text-text-main"}`}>
                          {group.groupKey}
                        </span>
                        {group.items.length > 1 && (
                          <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                            {group.items.length}
                          </span>
                        )}
                      </button>
                    </td>
                    {renderSummaryCells(group)}
                    <ValueCells item={group.summary} viewMode={viewMode} isSummary />
                  </tr>
                  {/* Detail rows */}
                  {expanded.has(group.groupKey) && group.items.map((item) => (
                    <tr
                      key={`detail-${item.key}`}
                      className="group-detail bg-surface-2/35 hover:bg-surface-2/75 transition-colors min-h-[44px]"
                    >
                      {renderDetailCells(item)}
                      <ValueCells item={item} viewMode={viewMode} />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {groupedData.length === 0 && (
              <tr>
                <td colSpan={totalColSpan} className="px-4 py-10 text-center text-xs text-text-muted">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

UsageTable.propTypes = {
  title: PropTypes.string.isRequired,
  columns: PropTypes.arrayOf(PropTypes.shape({
    field: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    align: PropTypes.string,
  })).isRequired,
  groupedData: PropTypes.array.isRequired,
  tableType: PropTypes.string.isRequired,
  sortBy: PropTypes.string.isRequired,
  sortOrder: PropTypes.string.isRequired,
  onToggleSort: PropTypes.func.isRequired,
  viewMode: PropTypes.string.isRequired,
  storageKey: PropTypes.string.isRequired,
  renderDetailCells: PropTypes.func.isRequired,
  renderSummaryCells: PropTypes.func.isRequired,
  emptyMessage: PropTypes.string.isRequired,
};

// Re-export utilities for use in UsageStats orchestrator
export { fmt, fmtCost, fmtTime };
