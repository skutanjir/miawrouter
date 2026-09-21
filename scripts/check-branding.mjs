#!/usr/bin/env node
/**
 * scripts/check-branding.mjs — MiawRouter branding gate.
 *
 * Scans tracked source files for legacy brand tokens.
 * Usage: node scripts/check-branding.mjs
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: process.cwd(),
  encoding: "buffer",
}).toString().split("\0").filter(Boolean);

// Construct regex dynamically so this verification script does not match itself
const p1 = "9" + "router";
const p2 = "nine" + "_router";
const p3 = "nine" + "router";
const p4 = "deco" + "lua";
const p5 = "x-" + "9r-";
const p6 = "9r-" + "cli-auth";
const forbidden = new RegExp([p1, p2, p3, p4, p5, p6].join("|"), "i");

const selfPath = "scripts/check-branding.mjs";
const testPath = "tests/unit/legacy-brand-removal.test.js";

const matches = [];
for (const file of files) {
  if (file === selfPath || file === testPath) continue;
  try {
    const content = readFileSync(file, "utf8");
    if (forbidden.test(content)) {
      matches.push(file);
    }
  } catch {}
}

if (matches.length > 0) {
  console.error("FAIL: Forbidden brand tokens found in:", matches);
  process.exit(1);
}

console.log("PASS: No forbidden brand tokens found in tracked files.");
process.exit(0);
