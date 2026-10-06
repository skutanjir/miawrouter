"use client";

import { useState } from "react";
import { Button } from "@/shared/components";

export default function ProviderModelDiscovery({ providerId, connections, customModels, providerStorageAlias, onRefreshCustomModels }) {
  const [connectionId, setConnectionId] = useState("");
  const [models, setModels] = useState([]);
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState(null);
  const [query, setQuery] = useState("");
  const active = connections.filter((connection) => connection.isActive !== false);
  const chosenId = connectionId || active[0]?.id;
  const saved = new Set(customModels.filter((model) => model.providerAlias === providerStorageAlias).map((model) => model.id));

  const getModels = async () => {
    setBusy(true);
    setMessage("");
    setModels([]);
    setSelected([]);
    try {
      const url = chosenId ? `/api/providers/${chosenId}/models` : `/api/providers/suggested-models?provider=${encodeURIComponent(providerId)}`;
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not get models");
      const rows = data.models || data.data || [];
      setModels(rows);
      setSource(data.source || "live");
      setMessage(data.warning || (rows.length ? `Found ${rows.length} models. Select models and save them to MiawRouter.` : data.authRequired ? "Connect an active account or API key to get models." : "No live catalog is available. This provider may require an active connection or use its bundled catalog."));
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const saveModels = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/providers/${chosenId}/models`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modelIds: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save models");
      await onRefreshCustomModels();
      setMessage(`Saved ${data.saved} models (${data.added} added, ${data.updated} updated). Supported reasoning efforts were detected automatically.`);
      setSelected([]);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const visible = models.filter((model) => `${model.id} ${model.name}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-border p-3" aria-busy={busy}>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" icon="refresh" onClick={getModels} disabled={busy}>{busy ? "Working…" : "Get New Models"}</Button>
        {active.length > 1 && <select aria-label="Model catalog account" value={chosenId || ""} onChange={(event) => { setConnectionId(event.target.value); setModels([]); setSelected([]); setMessage(""); }} disabled={busy} className="rounded border border-border bg-background p-1 text-xs">{active.map((connection) => <option key={connection.id} value={connection.id}>{connection.name || connection.email || connection.id}</option>)}</select>}
        {!!selected.length && <Button size="sm" icon="save" onClick={saveModels} disabled={busy || !chosenId || source === "static"}>Save Selected ({selected.length})</Button>}
      </div>
      <p className="text-xs text-text-muted">Fetch the current catalog, then save selected models locally. Effort options use upstream metadata when available and model capability rules otherwise. Auto keeps the provider default.</p>
      {!!message && <p role="status" className="text-xs text-text-muted">{message}</p>}
      {!!models.length && <>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input aria-label="Search discovered models" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models" className="rounded border border-border bg-background p-2" />
          <button onClick={() => setSelected([...new Set(visible.map((model) => model.id))])} disabled={busy || source === "static"} className="text-primary disabled:opacity-40">Select visible</button>
          <button onClick={() => setSelected([])} disabled={busy} className="text-text-muted">Clear selection</button>
          <span>{source === "static" ? "Bundled fallback" : "Upstream catalog"} · {models.length} models</span>
        </div>
        {!chosenId && <p className="text-xs text-warning">Add an active connection to save and validate these models against your account.</p>}
        <div className="max-h-72 space-y-1 overflow-auto">
          {visible.map((model) => <label key={`${model.id}|${model.type || "llm"}`} className="flex items-start gap-2 rounded px-2 py-1 text-xs hover:bg-surface-2">
            <input type="checkbox" checked={selected.includes(model.id)} disabled={busy || source === "static"} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, model.id])] : current.filter((id) => id !== model.id))} />
            <span className="break-all">{model.name || model.id} <span className="text-text-muted">· {model.id}{saved.has(model.id) ? " · Saved" : ""}{model.reasoningLevels?.length ? ` · Effort: ${model.reasoningLevels.join(", ")}` : ""}</span></span>
          </label>)}
        </div>
      </>}
    </div>
  );
}
