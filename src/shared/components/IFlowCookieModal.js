"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Modal, Button } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
const COOKIE_STEPS = [
  "Open platform.iflow.cn in your browser and sign in.",
  "Open DevTools (F12) and go to Application → Storage → Cookies.",
  "Select the platform.iflow.cn entry.",
  "Copy the whole cookie string — it must include BXAuth.",
  "Paste it below and authenticate.",
];

/**
 * iFlow Cookie Authentication Modal
 * User pastes browser cookie to get fresh API key
 */
export default function IFlowCookieModal({ isOpen, onSuccess, onClose }) {
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!cookie.trim()) {
      setError("No cookie pasted. Copy the cookie string from platform.iflow.cn first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/iflow/cookie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookie.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `The router rejected the cookie (HTTP ${res.status}).`);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCookie("");
    setError(null);
    setSuccess(false);
    onClose?.();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="iFlow Cookie Authentication">
      {success ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-md bg-success/10">
            <Icon name="check_circle" weight="fill" className="text-[24px] text-success" />
          </span>
          <p className="text-[15px] font-semibold text-text-main">Cookie accepted</p>
          <p className="text-sm text-text-muted">A fresh iFlow API key was stored. Closing…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-[10px] border border-border bg-surface-2 p-3.5">
            <p className="text-[13px] text-text-muted">
              iFlow rotates API keys per session. Paste the browser cookie once and MiawRouter mints a
              new key for it.
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {COOKIE_STEPS.map((line, index) => (
                <li key={line} className="flex gap-2.5 text-[13px] text-text-muted">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-surface text-xs font-semibold tabular-nums text-text-main">
                    {index + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
            <a
              href="https://platform.iflow.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover"
            >
              Open platform.iflow.cn
              <Icon name="open_in_new" className="text-[14px]" />
            </a>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="iflow-cookie" className="text-sm font-medium text-text-main">
              Cookie string
            </label>
            <textarea
              id="iflow-cookie"
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="BXAuth=...; other=...;"
              rows={4}
              disabled={loading}
              className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-text-main placeholder:text-text-subtle transition-colors duration-150 focus:outline-none focus:border-primary disabled:opacity-50"
            />
            <p className="text-xs text-text-muted">Stored server-side only; used to request the key.</p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
              <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-text-main">Authentication failed</p>
                <p className="mt-1 text-text-muted">{error}</p>
                <p className="mt-1 text-text-muted">
                  Sign in to platform.iflow.cn again and copy a fresh cookie, then retry.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button variant="ghost" onClick={handleClose} disabled={loading} fullWidth>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={loading} fullWidth>
              Authenticate
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

IFlowCookieModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func,
};
