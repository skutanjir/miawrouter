import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("legacy brand removal", () => {
  it("does not expose the obsolete CLI migration command", () => {
    const help = execFileSync(process.execPath, ["cli/cli.js", "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(help).not.toMatch(/\bmigrate\b/i);
  });

  it("does not retain old brand tokens in tracked source", () => {
    const files = execFileSync("git", ["ls-files", "-z"], {
      cwd: process.cwd(),
      encoding: "buffer",
    }).toString().split("\0").filter(Boolean);
    const forbidden = /9router|nine_router|ninerouter|decolua|x-9r-|9r-cli-auth/i;
    // This file names the forbidden tokens in order to forbid them.
    const selfPath = "tests/unit/legacy-brand-removal.test.js";
    const matches = files.filter((file) => {
      if (file === selfPath) return false;
      try {
        return forbidden.test(readFileSync(file, "utf8"));
      } catch {
        return false;
      }
    });

    expect(matches).toEqual([]);
  });
});

// The rebrand was applied with scripted string replacement. Two classes of
// damage it produced are silent — no syntax error, no failing import — but
// disable whole features:
//
//   1. A declaration swallowed into a trailing comment, so `require` never
//      runs and the identifier becomes a ReferenceError at call time
//      (sqliteRuntime.js shipped this: `ensureTrayRuntime` could never
//      install systray, so the tray icon never appeared).
//   2. A brace merged with the next declaration, so a function definition
//      disappears (`}function enableMacOS(...)`).
describe("rebrand merge artefacts", () => {
  const SCANNED = /\.(js|mjs|cjs|jsx)$/;
  const SKIP = /^(node_modules|cli\/app)\//;
  const SELF = "tests/unit/legacy-brand-removal.test.js";
  const files = execFileSync("git", ["ls-files", "-z"], {
    cwd: process.cwd(),
    encoding: "buffer",
  }).toString().split("\0").filter((f) => SCANNED.test(f) && !SKIP.test(f) && f !== SELF);

  // The damage is `// ...prose.const x = require(...)` — a sentence terminator
  // jammed straight into a declaration. Prose that merely contains the word
  // ("refresh; return cache") has a space, so requiring adjacency separates
  // the two without a grammar.
  const swallowedDeclaration =
    /^[ \t]*\/\/.*[.;)}\]](const|let|var|function|class|module\.exports|import)\b/;
  const mergedDeclaration = /^\}[ \t]*(function|const|let|var|class|module\.exports)\b/;

  it("no declaration is swallowed by a trailing comment", () => {
    const hits = files.filter((file) => {
      const lines = readFileSync(file, "utf8").split("\n");
      return lines.some((line) => swallowedDeclaration.test(line));
    });
    expect(hits).toEqual([]);
  });

  it("no closing brace is merged with the next declaration", () => {
    const hits = files.filter((file) => {
      const lines = readFileSync(file, "utf8").split("\n");
      return lines.some((line) => mergedDeclaration.test(line));
    });
    expect(hits).toEqual([]);
  });
});
