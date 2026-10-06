"use client";

import { useState } from "react";
import { Card, Button, Modal } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { ANTIGRAVITY_FIXER, ANTIGRAVITY_RECOVERY_EXAMPLES, getAntigravityFixerCommands, classifyAntigravityRecoveryError } from "@/shared/constants/antigravityRecovery";

export default function AntigravityRecovery({ connections, onReconnect, onRefresh, onOnboard, onboardingConnectionId }) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [issue, setIssue] = useState("auto");
  const [cleanupAcknowledged, setCleanupAcknowledged] = useState(false);
  const { copy, copied } = useCopyToClipboard();
  const connection = connections.find((item) => item.id === selectedId) || connections[0];
  const visibleResult = result?.connectionId === connection?.id ? result : null;
  const error = visibleResult ? visibleResult.error : connection?.lastError;
  const selectedExample = ANTIGRAVITY_RECOVERY_EXAMPLES.find((item) => item.id === issue);
  const recovery = classifyAntigravityRecoveryError(selectedExample?.error || error);
  const commands = getAntigravityFixerCommands();

  async function checkConnection() {
    if (!connection || checking) return;
    const connectionId = connection.id;
    setChecking(true);
    setResult(null);
    try {
      const response = await fetch(`/api/providers/${encodeURIComponent(connectionId)}/test`, { method: "POST" });
      const data = await response.json();
      const valid = response.ok && data.valid === true;
      setResult({ connectionId, valid, error: data.error || (valid ? "" : "Connection check failed.") });
      await onRefresh();
    } catch {
      setResult({ connectionId, valid: false, error: "Unable to check the connection. Please try again." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Antigravity Recovery</h2>
            <p className="text-sm text-text-muted">Understand eligibility errors, complete Google verification, and recover stale logins.</p>
          </div>
          <Button variant="secondary" icon="build" onClick={() => setOpen(true)}>Open Antigravity Fixer</Button>
        </div>
      </Card>
      <Modal isOpen={open} onClose={() => { setOpen(false); setCleanupAcknowledged(false); }} title="Antigravity Fixer" size="full">
        <div className="space-y-5">
          <p className="text-sm text-text-muted">
            Includes the recovery tool from <a className="text-primary underline" href={ANTIGRAVITY_FIXER.repositoryUrl} target="_blank" rel="noopener noreferrer">fulldiagnose/antigravity-fixer</a>.
            The fixer is bundled with MiawRouter. Run terminal commands on the computer where Antigravity is installed; Python 3.10+ is required.
          </p>
          <p className="text-sm">This tool helps identify account setup failures and recover stale local sessions. It cannot grant Google eligibility, bypass verification, or restore quota. Connection checks and verification links do not delete local data.</p>
          <section className="space-y-2">
            <h3 className="font-semibold">1. Identify the error</h3>
            {connections.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Antigravity account" className="rounded border border-border bg-surface-2 p-2 text-sm" value={connection?.id || ""} onChange={(event) => { setSelectedId(event.target.value); setCleanupAcknowledged(false); }} disabled={checking}>
                  {connections.map((item) => <option key={item.id} value={item.id}>{item.name || item.email || item.id}</option>)}
                </select>
                <Button variant="secondary" loading={checking} onClick={checkConnection}>Check connection</Button>
              </div>
            ) : <p className="text-sm text-text-muted">No account is connected. Select the error below for guidance, then reconnect through OAuth.</p>}
            {visibleResult?.valid ? <p role="status" className="text-sm text-green-600">Connection is valid. If a model still fails, check its availability and quota before changing your account.</p> : error ? (
              <div role="status" className="space-y-1 text-sm">
                <p className="break-words text-text-muted">{error}</p>
              </div>
            ) : null}
            <label className="block space-y-1 text-sm">
              <span>Which error are you seeing?</span>
              <select className="block w-full rounded border border-border bg-surface-2 p-2" value={issue} onChange={(event) => { setIssue(event.target.value); setCleanupAcknowledged(false); }}>
                <option value="auto">Detect from the selected connection</option>
                {ANTIGRAVITY_RECOVERY_EXAMPLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            {selectedExample && <pre className="whitespace-pre-wrap break-words rounded bg-surface-2 p-3 text-xs"><code>{selectedExample.error}</code></pre>}
            {(!visibleResult?.valid || selectedExample) && (
              <div className="space-y-2 rounded border border-border p-3 text-sm">
                <h4 className="font-semibold">{recovery.title}</h4>
                <p>{recovery.message}</p>
                <ol className="list-decimal space-y-1 pl-5">{recovery.steps.map((step) => <li key={step}>{step}</li>)}</ol>
                {recovery.action === "verify" && <a className="inline-block text-primary underline" href={ANTIGRAVITY_FIXER.ageVerificationUrl} target="_blank" rel="noopener noreferrer">Open Google verification</a>}
                {recovery.action === "eligibility" && <a className="inline-block text-primary underline" href={ANTIGRAVITY_FIXER.troubleshootingUrl} target="_blank" rel="noopener noreferrer">Read Google&apos;s sign-in troubleshooting</a>}
                {recovery.action === "reconnect" && <Button size="sm" onClick={() => { setOpen(false); setCleanupAcknowledged(false); onReconnect(); }}>Reconnect the affected account</Button>}
              </div>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <a className="text-primary underline" href={ANTIGRAVITY_FIXER.ageVerificationUrl} target="_blank" rel="noopener noreferrer">Google account verification</a>
              <a className="text-primary underline" href={ANTIGRAVITY_FIXER.permissionsUrl} target="_blank" rel="noopener noreferrer">Manage Google app permissions</a>
            </div>
            <p className="text-xs text-text-muted">Only revoke an old Antigravity permission if needed. Revocation signs out that connection; reconnect afterwards.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold">2. Set up the bundled terminal tool if needed</h3>
            <p className="text-xs text-text-muted">MiawRouter CLI installation prepares dependencies when Python is available and install scripts are allowed. If setup was skipped, run this command. No Git clone is needed. Setup does not clean data or sign in to Google.</p>
            <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs"><code>{commands.setup}</code></pre>
            <Button size="sm" variant="secondary" onClick={() => copy(commands.setup, "ag-setup")}>{copied === "ag-setup" ? "Copied" : "Copy setup command"}</Button>
          </section>
          <details className="space-y-2 rounded border border-border p-3">
            <summary className="cursor-pointer font-semibold">Advanced: optional local cleanup (deletes data)</summary>
            <p className="text-sm">Use this only for a stale local Antigravity login after trying the steps above. It does not fix Google-side eligibility or verification. Save work and back up first: the upstream cleaner stops Antigravity processes, removes matching Antigravity/Gemini credentials, and deletes CLI/IDE data, cache, settings, and extensions. Deleted credentials cannot be restored by MiawRouter.</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={cleanupAcknowledged} onChange={(event) => setCleanupAcknowledged(event.target.checked)} />
              <span>I have backed up what I need and understand that this command deletes local data.</span>
            </label>
            <pre className="overflow-x-auto rounded bg-surface-2 p-3 text-xs"><code>{commands.clean}</code></pre>
            <Button size="sm" variant="secondary" disabled={!cleanupAcknowledged} onClick={() => { if (cleanupAcknowledged) copy(commands.clean, "ag-clean"); }}>{copied === "ag-clean" ? "Copied" : "Copy cleanup command"}</Button>
            <p className="text-xs text-text-muted">Copying does not run cleanup. Execute it on your local computer only when intended; the CLI requires --confirm-clean. Installation never runs cleanup.</p>
          </details>
          <section className="space-y-2">
            <h3 className="font-semibold">3. Reconnect and test</h3>
            <p className="text-sm text-text-muted">Use the same account on Google OAuth. Select the reconnected account, check the connection, and retry onboarding if needed.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => { setOpen(false); setCleanupAcknowledged(false); onReconnect(); }}>Reconnect through OAuth</Button>
              {connection && <Button variant="secondary" disabled={checking || Boolean(onboardingConnectionId)} loading={onboardingConnectionId === connection.id} onClick={() => onOnboard(connection.id)}>Retry onboarding</Button>}
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}

