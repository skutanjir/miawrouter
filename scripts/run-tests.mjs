#!/usr/bin/env node
/**
 * CI test gate.
 *
 * Runs the full vitest suite from the repo root minus the documented
 * pre-existing failures in tests/known-failing.json. A green run therefore means
 * "this change broke nothing", which is the property a merge gate needs.
 *
 * The excluded suites are not deleted or skipped silently: CI runs them in a
 * separate non-blocking backlog job so the debt stays visible, and any suite
 * that starts passing should be removed from the exclusion list.
 *
 *   node scripts/run-tests.mjs                       # gated (blocking) run
 *   node scripts/run-tests.mjs --all                 # everything, incl. backlog
 *   node scripts/run-tests.mjs tests/unit/foo.test.js  # explicit paths
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const runAll = argv.includes("--all");
const explicit = argv.filter((a) => !a.startsWith("--"));

// vitest lives in the tests workspace, not at the repo root.
const candidates = [
  resolve(ROOT, "tests/node_modules/.bin/vitest"),
  resolve(ROOT, "node_modules/.bin/vitest"),
];
const vitest = candidates.find((p) => existsSync(p));
if (!vitest) {
  console.error("vitest not found. Run `npm --prefix tests ci` first.");
  process.exit(1);
}

// CLI --exclude REPLACES the config exclude list, so the config's own entries
// have to be re-stated here or node_modules gets scanned.
const excludes = ["**/node_modules/**", "**/.claude/**", "**/dist/**"];

if (!runAll && explicit.length === 0) {
  const knownPath = resolve(ROOT, "tests/known-failing.json");
  if (existsSync(knownPath)) {
    const known = JSON.parse(readFileSync(knownPath, "utf8"));
    for (const file of known.files || []) excludes.push(file);
    const n = (known.files || []).length;
    console.log(`[test-gate] excluding ${n} documented pre-existing failure(s); see tests/known-failing.json`);
  }
}

const args = ["run", "--config", "tests/vitest.config.js", "--root", "."];

if (explicit.length > 0) {
  args.push(...explicit);
} else if (!runAll) {
  for (const e of excludes) args.push("--exclude", e);
}

const res = spawnSync(vitest, args, {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

process.exit(res.status ?? 1);
