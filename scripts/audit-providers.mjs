import fs from "node:fs/promises";
import path from "node:path";
import REGISTRY from "../open-sse/providers/registry/index.js";
import { findRegistryModelSource, fetchRegistryModels } from "../src/lib/catalog/providerModelSources.js";

// Read-only catalog audit. Never invokes inference, refreshes tokens, or logs keys.
const live = process.argv.includes("--live");
const rows = REGISTRY.map((provider) => {
  const models = provider.models || [];
  const keys = models.map((model) => `${model.id}|${model.kind || "llm"}`);
  const errors = [];
  if (!provider.id) errors.push("Missing provider id");
  if (keys.length !== new Set(keys).size) errors.push("Duplicate model id within the same service kind");
  if (models.some((model) => !model.id || !model.name)) errors.push("Missing model id/name");
  const source = findRegistryModelSource(provider.id);
  return { provider: provider.id, bundledModels: models.length, errors, endpoint: source?.url || null, status: source ? "not_probed" : "bundled_or_specialized" };
});
if (live) {
  const queue = rows.filter((row) => row.endpoint);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const row = queue.shift();
      try {
        const result = await fetchRegistryModels(findRegistryModelSource(row.provider));
        Object.assign(row, { status: result.authRequired ? "credentials_required" : result.models.length ? "live" : "upstream_unavailable_or_unrecognized", httpStatus: result.status || 200, liveModels: result.models.length });
      } catch { row.status = "network_error_or_timeout"; }
    }
  }));
}
const totals = rows.reduce((totals, row) => { totals[row.status] = (totals[row.status] || 0) + 1; return totals; }, {});
const report = { auditedAt: new Date().toISOString(), live, providerCount: rows.length, bundledModels: rows.reduce((sum, row) => sum + row.bundledModels, 0), structuralErrors: rows.filter((row) => row.errors.length), totals, providers: rows };
const output = path.resolve("node_modules/.cache/provider-audit.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, providers: undefined, report: output }, null, 2));
if (report.structuralErrors.length) process.exitCode = 1;
