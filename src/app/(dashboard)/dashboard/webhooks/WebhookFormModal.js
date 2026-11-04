"use client";

import { useState } from "react";
import { Modal, Button, Input } from "@/shared/components";
import { cn } from "@/shared/utils/cn";

import { Icon } from "@/shared/components/Icon";

export default function WebhookFormModal({
  isOpen,
  webhook,
  onClose,
  onSave,
  supportedEvents,
}) {
  const isEdit = !!webhook;
  const [name, setName] = useState(webhook?.name || "");
  const [url, setUrl] = useState(webhook?.url || "");
  const [events, setEvents] = useState(webhook?.events || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [urlError, setUrlError] = useState("");

  const validate = () => {
    let ok = true;
    if (!name.trim()) {
      setNameError("Name is required");
      ok = false;
    } else {
      setNameError("");
    }
    if (!url.trim()) {
      setUrlError("URL is required");
      ok = false;
    } else {
      try {
        new URL(url);
        setUrlError("");
      } catch {
        setUrlError("Enter a valid URL");
        ok = false;
      }
    }
    return ok;
  };

  const toggleEvent = (evt) => {
    setEvents((prev) =>
      prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
    );
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (events.length === 0) {
      setError("Select at least one event");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ name: name.trim(), url: url.trim(), events });
    } catch (err) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Group events by prefix (request.*, provider.*, quota.*)
  const groups = {};
  (supportedEvents.length ? supportedEvents : []).forEach((evt) => {
    const prefix = evt.split(".")[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(evt);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit webhook" : "Create webhook"}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!name.trim() || !url.trim() || events.length === 0}
          >
            {isEdit ? "Save changes" : "Create webhook"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            <Icon name="error" className="text-[15px]" />
            {error}
          </div>
        )}

        <Input
          label="Webhook name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError("");
          }}
          placeholder="e.g. Slack notifications"
          error={nameError}
          required
        />

        <Input
          label="Endpoint URL"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (urlError) setUrlError("");
          }}
          placeholder="https://example.com/webhook"
          error={urlError}
          hint="HTTP and HTTPS are supported. Private and reserved IPs are blocked."
          required
        />

        {/* Event selector */}
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <label className="text-[13px] font-medium text-text-main">
              Events <span className="text-danger">*</span>
            </label>
            <span className="text-xs text-text-muted tabular-nums">
              {events.length} selected
            </span>
          </div>

          {Object.keys(groups).length > 0 ? (
            <div className="flex flex-col gap-3">
              {Object.entries(groups).map(([prefix, evts]) => (
                <div key={prefix} className="rounded-md border border-border-subtle bg-surface-2/40 p-3">
                  <h4 className="mb-2 text-[13px] font-medium text-text-main">{prefix}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {evts.map((evt) => {
                      const selected = events.includes(evt);
                      return (
                        <button
                          key={evt}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleEvent(evt)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-xs transition-colors cursor-pointer",
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-surface text-text-muted hover:text-text-main"
                          )}
                        >
                          {selected && <Icon name="check" className="text-[12px]" />}
                          {evt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted">
              No event types reported by the router yet. Reload the page to retry.
            </p>
          )}

          {events.length === 0 && (
            <p className="mt-2 flex items-center gap-1 text-xs text-warning">
              <Icon name="warning" className="text-[14px]" />
              Select at least one event to save this webhook.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
