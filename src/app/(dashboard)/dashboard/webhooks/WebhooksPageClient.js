"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, Button, Badge, Toggle, ConfirmModal, CardSkeleton } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";
import WebhookFormModal from "./WebhookFormModal";
import DeliveryPanel from "./DeliveryPanel";
import SecretManager from "./SecretManager";

import { Icon } from "@/shared/components/Icon";
/* ── Webhook row ──────────────────────────────────────────────────── */

function WebhookRow({
  webhook,
  busy,
  onEdit,
  onDelete,
  onToggle,
  onViewDeliveries,
  onManageSecret,
}) {
  return (
    <tr className="border-b border-border-subtle last:border-b-0 hover:bg-surface-2/50 transition-colors">
      {/* Name + endpoint */}
      <td className="px-3 py-3 align-top">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-text-main">{webhook.name}</span>
          <span className="truncate font-mono text-xs text-text-muted">{webhook.url}</span>
        </div>
      </td>

      {/* Events */}
      <td className="px-3 py-3 align-top">
        <div className="flex max-w-[22rem] flex-wrap gap-1">
          {webhook.events.map((evt) => (
            <span
              key={evt}
              className="inline-flex items-center rounded-md border border-border-subtle bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-text-muted"
            >
              {evt}
            </span>
          ))}
        </div>
      </td>

      {/* State */}
      <td className="px-3 py-3 align-top">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={webhook.isActive ? "success" : "default"} size="sm" dot>
            {webhook.isActive ? "Active" : "Disabled"}
          </Badge>
          {webhook.secretConfigured && (
            <Badge variant="info" size="sm" icon="key">
              Signed
            </Badge>
          )}
        </div>
      </td>

      {/* Enable/disable */}
      <td className="px-3 py-3 align-top">
        <Toggle
          checked={webhook.isActive}
          size="sm"
          disabled={busy}
          onChange={() => onToggle(webhook)}
          ariaLabel={`${webhook.isActive ? "Disable" : "Enable"} ${webhook.name}`}
        />
      </td>

      {/* Actions */}
      <td className="px-3 py-3 align-top">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDeliveries(webhook)}
            title="View delivery history"
            aria-label={`View deliveries for ${webhook.name}`}
          >
            <Icon name="history" className="text-[16px]" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onManageSecret(webhook)}
            title="Signing secret"
            aria-label={`Manage signing secret for ${webhook.name}`}
          >
            <Icon name="key" className="text-[16px]" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(webhook)}
            title="Edit webhook"
            aria-label={`Edit ${webhook.name}`}
          >
            <Icon name="edit" className="text-[16px]" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-text-muted hover:text-danger"
            onClick={() => onDelete(webhook)}
            title="Delete webhook"
            aria-label={`Delete ${webhook.name}`}
          >
            <Icon name="delete" className="text-[16px]" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

/* ── Main page component ──────────────────────────────────────────── */

export default function WebhooksPageClient() {
  const [webhooks, setWebhooks] = useState([]);
  const [supportedEvents, setSupportedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // Modal state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  // Panels
  const [deliveryWebhook, setDeliveryWebhook] = useState(null);
  const [secretWebhook, setSecretWebhook] = useState(null);

  const notify = useNotificationStore((s) => s);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/webhooks", { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const data = await res.json();
      setWebhooks(data.webhooks || []);
      setSupportedEvents(data.supportedEvents || []);
    } catch (err) {
      setError(err.message || "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (data) => {
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to create webhook");
    }
    const { webhook } = await res.json();
    const { secret, ...safeWebhook } = webhook;
    notify.success("Webhook created");
    await load();
    setShowFormModal(false);
    setSecretWebhook({ ...safeWebhook, oneTimeSecret: secret });
  };

  const handleUpdate = async (id, data) => {
    const res = await fetch(`/api/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to update webhook");
    }
    notify.success("Webhook updated");
    await load();
    setEditingWebhook(null);
  };

  const handleToggle = async (webhook) => {
    setBusyId(webhook.id);
    const res = await fetch(`/api/webhooks/${webhook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !webhook.isActive }),
    });
    if (res.ok) {
      notify.info(webhook.isActive ? "Webhook disabled" : "Webhook enabled");
      await load();
    } else {
      notify.error("Failed to update webhook");
    }
    setBusyId(null);
  };

  const handleDelete = (webhook) => {
    setConfirmState({
      title: "Delete Webhook",
      message: `Delete "${webhook.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmState(null);
        const res = await fetch(`/api/webhooks/${webhook.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          notify.success("Webhook deleted");
          await load();
        } else {
          notify.error("Failed to delete webhook");
        }
      },
    });
  };

  const activeCount = webhooks.filter((w) => w.isActive).length;
  const signedCount = webhooks.filter((w) => w.secretConfigured).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="workspace-heading">
        <div>
          <h1>Webhooks</h1>
          <p>Push router events to external services. Each delivery carries a signed payload and retries on failure.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={load} disabled={loading} icon="refresh">
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button icon="add" size="sm" onClick={() => setShowFormModal(true)}>
            Create webhook
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-danger/35" padding="sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-2 text-sm text-danger">
              <Icon name="error" className="mt-0.5 text-[16px]" />
              <span>Could not load webhooks — {error}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : webhooks.length === 0 ? (
        <Card padding="lg">
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Icon name="webhook" weight="duotone" className="text-[28px] text-text-muted" />
            <p className="text-sm font-medium text-text-main">No webhooks configured</p>
            <p className="max-w-md text-[13px] text-text-muted">
              Create one to get notified about request failures, provider outages, and quota events.
            </p>
            <Button icon="add" size="sm" className="mt-2" onClick={() => setShowFormModal(true)}>
              Create webhook
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <p className="text-[13px] text-text-muted tabular-nums">
              {webhooks.length} webhook{webhooks.length === 1 ? "" : "s"} · {activeCount} active · {signedCount} signed
            </p>
            <p className="text-[13px] text-text-muted tabular-nums">
              {supportedEvents.length} event types available
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left" aria-label="Configured webhooks">
              <thead>
                <tr className="border-b border-border text-[13px] text-text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">Webhook</th>
                  <th scope="col" className="px-3 py-2 font-medium">Events</th>
                  <th scope="col" className="px-3 py-2 font-medium">State</th>
                  <th scope="col" className="px-3 py-2 font-medium">Enabled</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <WebhookRow
                    key={wh.id}
                    webhook={wh}
                    busy={busyId === wh.id}
                    onEdit={() => setEditingWebhook(wh)}
                    onDelete={() => handleDelete(wh)}
                    onToggle={() => handleToggle(wh)}
                    onViewDeliveries={() => setDeliveryWebhook(wh)}
                    onManageSecret={() => setSecretWebhook(wh)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card padding="sm">
        <div className="flex items-start gap-3">
          <Icon name="info" className="mt-0.5 text-[16px] text-text-muted" />
          <div className="space-y-1 text-[13px] text-text-muted">
            <p>
              <strong className="font-medium text-text-main">Signing secrets</strong> let the receiving
              endpoint verify a delivery came from this router. Each request carries an{" "}
              <code className="font-mono text-xs">x-miaw-signature</code> header with the HMAC-SHA256 digest.
            </p>
            <p>
              <strong className="font-medium text-text-main">Retries</strong> run up to 3 times with
              exponential backoff for server errors and timeouts.
            </p>
            <p>
              <strong className="font-medium text-text-main">URL validation</strong> allows HTTP and HTTPS and
              blocks private/reserved IP ranges to prevent SSRF.
            </p>
          </div>
        </div>
      </Card>

      {/* Modals & panels */}
      {showFormModal && (
        <WebhookFormModal
          key="create"
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          onSave={handleCreate}
          supportedEvents={supportedEvents}
        />
      )}

      {editingWebhook && (
        <WebhookFormModal
          key={editingWebhook.id}
          isOpen={!!editingWebhook}
          webhook={editingWebhook}
          onClose={() => setEditingWebhook(null)}
          onSave={(data) => handleUpdate(editingWebhook.id, data)}
          supportedEvents={supportedEvents}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />

      {deliveryWebhook && (
        <DeliveryPanel
          webhook={deliveryWebhook}
          onClose={() => setDeliveryWebhook(null)}
        />
      )}

      {secretWebhook && (
        <SecretManager
          webhook={secretWebhook}
          onClose={() => setSecretWebhook(null)}
          onUpdate={load}
        />
      )}
    </div>
  );
}
