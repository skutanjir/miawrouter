#!/usr/bin/env node
/**
 * Generate the provider prompt-cache capability matrix.
 *
 * Prints a markdown table for every registered provider: how its request format
 * maps to a cache mode, whether the router may inject breakpoint markers, which
 * upstream usage fields report cache traffic, and the evidence behind each row.
 *
 * The matrix is DERIVED from open-sse/providers/cacheCapabilities.js and the live
 * registry, so it can never drift from what the router actually does.
 *
 *   node scripts/provider-cache-matrix.mjs            # markdown to stdout
 *   node scripts/provider-cache-matrix.mjs --json     # machine-readable
 *   node scripts/provider-cache-matrix.mjs --summary  # mode counts only
 */

import { PROVIDERS } from "../open-sse/providers/index.js";
import { resolveCacheCapability, listCacheModes } from "../open-sse/providers/cacheCapabilities.js";

const args = new Set(process.argv.slice(2));

function formatOf(def) {
  return def?.format || def?.transport?.format || "unknown";
}

const rows = Object.keys(PROVIDERS)
  .sort()
  .map((id) => {
    const format = formatOf(PROVIDERS[id]);
    const cap = resolveCacheCapability(id, format);
    return {
      provider: id,
      format,
      mode: cap.mode,
      marker: cap.marker || "—",
      injects: cap.supportsCacheMarkers ? "yes" : "no",
      usageRead: (cap.usage?.read || []).join(", ") || "—",
      usageWrite: (cap.usage?.write || []).join(", ") || "—",
      evidence: cap.evidence,
      note: cap.note,
    };
  });

if (args.has("--json")) {
  console.log(JSON.stringify({ generatedFor: "miawrouter provider cache matrix", rows }, null, 2));
  process.exit(0);
}

const counts = rows.reduce((acc, r) => ({ ...acc, [r.mode]: (acc[r.mode] || 0) + 1 }), {});

if (args.has("--summary")) {
  console.log(`providers: ${rows.length}`);
  for (const [mode, n] of Object.entries(counts).sort()) console.log(`  ${mode}: ${n}`);
  process.exit(0);
}

console.log("# Provider prompt-cache capability matrix\n");
console.log(`Generated from the live registry + \`open-sse/providers/cacheCapabilities.js\`. ${rows.length} providers.\n`);
console.log("| mode | providers |");
console.log("| --- | --- |");
for (const [mode, n] of Object.entries(counts).sort()) console.log(`| ${mode} | ${n} |`);
console.log("");
console.log("| provider | format | cache mode | marker | injects markers | upstream cache-read fields | upstream cache-write fields | evidence |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  console.log(
    `| ${r.provider} | ${r.format} | ${r.mode} | ${r.marker} | ${r.injects} | ${r.usageRead} | ${r.usageWrite} | ${r.evidence} |`,
  );
}

console.log("\n## Recorded capability declarations\n");
console.log("| key | kind | mode | marker | evidence | note |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const rec of listCacheModes()) {
  console.log(`| ${rec.key} | ${rec.kind} | ${rec.mode} | ${rec.marker || "—"} | ${rec.evidence} | ${rec.note || "—"} |`);
}
