"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { Modal, Button, Input } from "@/shared/components";

import { Icon } from "@/shared/components/Icon";
/**
 * Cursor Auth Modal
 * Auto-detect and import token from Cursor IDE's local SQLite database
 */
export default function CursorAuthModal({ isOpen, onSuccess, onClose }) {
  const [accessToken, setAccessToken] = useState("");
  const [machineId, setMachineId] = useState("");
  const [error, setError] = useState(null);
  const [autoDetectError, setAutoDetectError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [autoDetecting, setAutoDetecting] = useState(false);
  const [autoDetected, setAutoDetected] = useState(false);
  const [windowsManual, setWindowsManual] = useState(false);

  const runAutoDetect = async () => {
    setAutoDetecting(true);
    setAutoDetectError(null);
    setAutoDetected(false);
    setWindowsManual(false);

    try {
      const res = await fetch("/api/oauth/cursor/auto-import");
      const data = await res.json();

      if (data.found) {
        setAccessToken(data.accessToken);
        setMachineId(data.machineId);
        setAutoDetected(true);
      } else if (data.windowsManual) {
        setWindowsManual(true);
      } else {
        setAutoDetectError(data.error || "Could not auto-detect tokens");
      }
    } catch (err) {
      setAutoDetectError("Failed to auto-detect tokens");
    } finally {
      setAutoDetecting(false);
    }
  };

  // Auto-detect tokens when modal opens
  useEffect(() => {
    if (!isOpen) return;
    runAutoDetect();
  }, [isOpen]);

  const handleImportToken = async () => {
    if (!accessToken.trim()) {
      setError("No access token. Paste the token from Cursor's storage, or run Retry to auto-detect.");
      return;
    }

    if (!machineId.trim()) {
      setError("No machine ID. Paste the machine ID from Cursor's storage, or run Retry to auto-detect.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/oauth/cursor/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          machineId: machineId.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Import failed (HTTP ${res.status}).`);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} title="Connect Cursor IDE" onClose={onClose}>
      {autoDetecting ? (
        <div className="flex flex-col gap-3 py-6">
          <div className="flex items-center gap-2.5 text-sm text-text-muted">
            <Icon name="progress_activity" className="animate-spin text-[18px] text-primary" />
            Reading the token database from the Cursor IDE installation…
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {autoDetected && (
            <div className="flex items-start gap-2.5 rounded-[10px] border border-success/20 bg-success/10 p-3">
              <Icon name="check_circle" weight="fill" className="mt-0.5 text-[18px] text-success shrink-0" />
              <p className="text-sm text-text-main">
                Access token and machine ID were read from the local Cursor installation. Import to store
                them.
              </p>
            </div>
          )}

          {windowsManual && (
            <div className="flex flex-col gap-3 rounded-[10px] border border-warning/20 bg-warning/10 p-3">
              <div className="flex items-start gap-2.5">
                <Icon name="warning" weight="fill" className="mt-0.5 text-[18px] text-warning shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-text-main">
                    Cursor&apos;s database could not be read on this machine
                  </p>
                  <p className="mt-1 text-text-muted">
                    Open Cursor IDE at least once so its storage exists, then run Retry. If it still fails,
                    paste the two values manually below.
                  </p>
                </div>
              </div>
              <Button onClick={runAutoDetect} variant="outline" size="sm" icon="refresh" className="self-start">
                Retry auto-detect
              </Button>
            </div>
          )}

          {!autoDetected && !windowsManual && !autoDetectError && (
            <div className="flex items-start gap-2.5 rounded-[10px] border border-border bg-surface-2 p-3">
              <Icon name="info" className="mt-0.5 text-[18px] text-text-muted shrink-0" />
              <p className="text-sm text-text-muted">
                No Cursor installation was found. Paste the access token and machine ID manually, or run
                Retry after opening Cursor once.
              </p>
            </div>
          )}

          {autoDetectError && (
            <div className="flex flex-col gap-3 rounded-[10px] border border-warning/20 bg-warning/10 p-3">
              <div className="flex items-start gap-2.5">
                <Icon name="warning" weight="fill" className="mt-0.5 text-[18px] text-warning shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-text-main">Auto-detect didn&apos;t find tokens</p>
                  <p className="mt-1 text-text-muted">{autoDetectError}</p>
                  <p className="mt-1 text-text-muted">
                    Open Cursor IDE once, then run Retry — or paste the values manually below.
                  </p>
                </div>
              </div>
              <Button onClick={runAutoDetect} variant="outline" size="sm" icon="refresh" className="self-start">
                Retry auto-detect
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="cursor-access-token" className="text-sm font-medium text-text-main">
              Access token
              <span className="ml-1 text-danger">*</span>
            </label>
            <textarea
              id="cursor-access-token"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="JWT copied from Cursor's storage"
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-[13px] text-text-main placeholder:text-text-subtle transition-colors duration-150 focus:outline-none focus:border-primary"
            />
          </div>

          <Input
            label="Machine ID"
            required
            value={machineId}
            onChange={(e) => setMachineId(e.target.value)}
            placeholder="Machine ID from Cursor's storage"
            inputClassName="font-mono text-[13px]"
          />

          {error && (
            <div className="flex items-start gap-2.5 rounded-[10px] border border-danger/20 bg-danger/10 p-3">
              <Icon name="error" className="mt-0.5 text-[18px] text-danger shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-text-main">Import failed</p>
                <p className="mt-1 text-text-muted">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </Button>
            <Button
              onClick={handleImportToken}
              fullWidth
              loading={importing}
              disabled={!accessToken.trim() || !machineId.trim()}
            >
              Import token
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

CursorAuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onSuccess: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};
