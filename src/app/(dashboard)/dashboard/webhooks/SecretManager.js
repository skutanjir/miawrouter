"use client";

import { useState } from "react";
import { Modal, Button, Badge } from "@/shared/components";
import { useNotificationStore } from "@/store/notificationStore";

import { Icon } from "@/shared/components/Icon";

export default function SecretManager({ webhook, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState(webhook.oneTimeSecret || "");
  const notify = useNotificationStore((s) => s);

  const hasSecret = webhook.secretConfigured;
  const secretPreview = webhook.secretPreview;

  const copySecret = async () => {
    await navigator.clipboard.writeText(oneTimeSecret);
    notify.success("Signing secret copied");
  };

  const handleRotate = async () => {
    setLoading(true);
    try {
      // Generate a random 64-char hex string (within 16-256 chars).
      // The backend stores and uses this for HMAC signing; only a masked
      // preview is returned on subsequent GETs.
      const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const res = await fetch(`/api/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: raw }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to set secret");
      }
      setOneTimeSecret(raw);
      notify.success("Signing secret rotated");
      onUpdate?.();
      setConfirmRotate(false);
    } catch (err) {
      notify.error(err.message || "Failed to update secret");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Signing secret" size="md">
      <div className="flex flex-col gap-4">
        {oneTimeSecret && (
          <div className="rounded-md border border-success/30 bg-success/10 p-3.5">
            <p className="text-sm font-medium text-text-main">Copy this secret now</p>
            <p className="mt-0.5 text-[13px] text-text-muted">
              The full signing secret is never shown again after this dialog closes.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-surface px-3 py-2 font-mono text-xs text-text-main">
                {oneTimeSecret}
              </code>
              <Button variant="secondary" size="sm" icon="content_copy" onClick={copySecret}>
                Copy
              </Button>
            </div>
          </div>
        )}

        {/* Current state */}
        <div className="rounded-md border border-border-subtle bg-surface-2/40 p-3.5">
          <h3 className="text-[13px] font-medium text-text-main">Current status</h3>
          <div className="mt-2 flex items-center gap-2">
            {hasSecret ? (
              <>
                <Badge variant="success" size="sm" dot>
                  Active
                </Badge>
                {secretPreview && (
                  <span className="font-mono text-xs text-text-muted">{secretPreview}</span>
                )}
              </>
            ) : (
              <>
                <Badge variant="default" size="sm">
                  No secret
                </Badge>
                <span className="text-xs text-text-muted">Payloads are not signed</span>
              </>
            )}
          </div>
        </div>

        {/* How verification works */}
        <div className="flex flex-col gap-2 text-[13px] text-text-muted">
          <p>
            <strong className="font-medium text-text-main">How it works:</strong> every delivery
            includes an <code className="font-mono text-xs">x-miaw-signature</code> header holding the
            HMAC-SHA256 digest of <code className="font-mono text-xs">timestamp.body</code>, keyed with
            your secret.
          </p>
          <pre className="overflow-x-auto rounded-md border border-border-subtle bg-surface-2/40 p-3 font-mono text-[11px] leading-relaxed text-text-main">
{`signature = HMAC-SHA256(secret, timestamp + "." + body)
x-miaw-signature: sha256={hex_digest}
x-miaw-timestamp: {unix_seconds}`}
          </pre>
          <p>
            Verify by computing the same HMAC and comparing with timing-safe equality. Reject
            deliveries with timestamps older than 5 minutes to prevent replays.
          </p>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          <Icon name="warning" className="mt-0.5 text-[16px] text-warning" />
          <p className="text-xs leading-relaxed text-text-muted">
            The full secret is returned only at creation and stays stored server-side; later reads
            return a masked preview. Rotation replaces the current secret immediately, so update the
            receiving endpoint as soon as you copy the new value.
          </p>
        </div>

        {/* Actions */}
        <div className="border-t border-border-subtle pt-4">
          {!confirmRotate ? (
            <Button
              variant="primary"
              size="sm"
              icon="key"
              loading={loading}
              onClick={() => setConfirmRotate(true)}
              fullWidth
            >
              Rotate secret
            </Button>
          ) : (
            <div className="rounded-md border border-warning/30 bg-warning/10 p-3.5">
              <p className="text-[13px] leading-relaxed text-text-muted">
                This immediately replaces the current signing secret. The new secret is shown once
                after rotation — copy it and update the receiving endpoint promptly.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmRotate(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" loading={loading} onClick={handleRotate}>
                  Confirm rotation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
