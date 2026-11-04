"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import { Modal, Badge, Button, Skeleton } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

import { Icon } from "@/shared/components/Icon";

/* ── Helpers ──────────────────────────────────────────────────────── */

function timeAgo(ts) {
  if (!ts) return "—";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function toMillis(ts) {
  if (!ts) return null;
  return typeof ts === "string" ? new Date(ts).getTime() : ts;
}

function statusBadge(status) {
  switch (status) {
    case "delivered":
      return (
        <Badge variant="success" size="sm" dot>
          Delivered
        </Badge>
      );
    case "delivering":
      return (
        <Badge variant="info" size="sm" dot>
          Delivering
        </Badge>
      );
    case "retrying":
      return (
        <Badge variant="warning" size="sm" dot>
          Retrying
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="default" size="sm" dot>
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="error" size="sm" dot>
          Failed
        </Badge>
      );
    case "duplicate":
      return (
        <Badge variant="default" size="sm">
          Duplicate
        </Badge>
      );
    case "queue_full":
      return (
        <Badge variant="error" size="sm">
          Queue full
        </Badge>
      );
    default:
      return <Badge variant="default" size="sm">{status}</Badge>;
  }
}

/* ── Delivery detail ──────────────────────────────────────────────── */

function DeliveryDetail({ delivery }) {
  const facts = [
    { label: "Event", value: delivery.event, mono: true },
    { label: "Created", value: formatTimestamp(delivery.createdAt) },
    delivery.responseStatus > 0
      ? { label: "Response", value: `HTTP ${delivery.responseStatus}`, mono: true }
      : null,
    delivery.attempts > 0 ? { label: "Attempts", value: String(delivery.attempts), mono: true } : null,
    delivery.error ? { label: "Error", value: delivery.error, danger: true } : null,
  ].filter(Boolean);

  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs text-text-muted">{fact.label}</dt>
          <dd
            className={cn(
              "mt-0.5 break-all text-[13px]",
              fact.mono && "font-mono",
              fact.danger ? "text-danger" : "text-text-main"
            )}
          >
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Main delivery panel ──────────────────────────────────────────── */

export default function DeliveryPanel({ webhook, onClose }) {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // The [id] GET route returns { webhook, deliveries } in one call
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setDeliveries(data.deliveries || []);
    } catch (err) {
      setError(err.message || "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }, [webhook.id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Deliveries — ${webhook.name}`}
      size="full"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-mono text-xs text-text-muted">{webhook.url}</p>
            <p className="text-[13px] text-text-muted tabular-nums">
              {loading ? "Loading delivery log…" : `${deliveries.length} delivery record${deliveries.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} disabled={loading} icon="refresh">
            Refresh
          </Button>
        </div>

        {error && (
          <div className="flex items-start justify-between gap-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2">
            <p className="text-[13px] text-danger">
              Could not load deliveries — {error}
            </p>
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-border-subtle bg-surface-2/40 px-4 py-10 text-center">
            <Icon name="send" className="text-[24px] text-text-muted" />
            <p className="text-sm font-medium text-text-main">No deliveries recorded</p>
            <p className="max-w-sm text-[13px] text-text-muted">
              Records appear here once this webhook&apos;s events fire and a delivery is attempted.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border border-border-subtle">
            <table className="w-full border-collapse text-left" aria-label="Webhook deliveries">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-border text-[13px] text-text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Time</th>
                  <th scope="col" className="px-3 py-2 font-medium">Event</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 font-medium">HTTP</th>
                  <th scope="col" className="px-3 py-2 font-medium">Attempts</th>
                  <th scope="col" className="w-8 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {deliveries.map((dlv, idx) => {
                  const id = dlv.id || `dlv-${idx}`;
                  const isExpanded = selected === id;
                  return (
                    <Fragment key={id}>
                      <tr
                        className={cn(
                          "border-b border-border-subtle transition-colors",
                          isExpanded ? "bg-surface-2" : "hover:bg-surface-2/50"
                        )}
                      >
                        <td className="px-3 py-2.5 text-[13px] text-text-muted tabular-nums">
                          {dlv.createdAt ? timeAgo(toMillis(dlv.createdAt)) : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <code className="font-mono text-xs text-text-main">{dlv.event || "—"}</code>
                        </td>
                        <td className="px-3 py-2.5">{statusBadge(dlv.status)}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
                          {dlv.responseStatus > 0 ? dlv.responseStatus : "—"}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-text-muted">
                          {dlv.attempts > 0 ? dlv.attempts : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() => setSelected(isExpanded ? null : id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Hide delivery details" : "Show delivery details"}
                            className="rounded-md p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
                          >
                            <Icon
                              name="expand_more"
                              className="text-[16px] transition-transform duration-150"
                              style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
                            />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-border-subtle bg-surface-2/60">
                          <td colSpan={6} className="px-3 py-3">
                            <DeliveryDetail delivery={dlv} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
