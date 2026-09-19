import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The rename mapped two different legacy tokens onto one new token. Where both
// landed in the same expression the second branch became unreachable: valid
// syntax, no failed import, no test failure — just a dead branch. Shipped:
//
//   cmd.includes("miawrouter") || cmd.includes("miawrouter")
//   e.name === "MiawRouter" || e.name === "MiawRouter"
//   status?.hasMiawRouter ?? status?.hasMiawRouter
//   { hasMiawRouter: x, hasMiawRouter: x }
//   delete auth["miawrouter"]; delete auth["miawrouter"];
//   out.replace(/\bmiawrouter\b(?!\.com)/gi, "miawrouter")
//
// A "brand token twice on a line" rule is worthless: the brand appears
// legitimately in copy, template literals, and different path forms
// ("miawrouter", "\\miawrouter", ".miawrouter"). The rule that works is
// narrower: split the line on the LOGICAL operators (`|| && ??`) and fail if
// two segments are the same expression. Genuine `a === X || a === Y` keeps
// differing segments, so it stays quiet.
const BRAND = /miawrouter/i;

const SCANNED = /\.(js|mjs|cjs|jsx)$/;
// Build output and vendored minified payloads: a minifier emits these shapes
// legitimately and they are not authored source.
const SKIP = /^(node_modules|cli\/app|\.next)/;
const SKIP_FILES = new Set([
  "open-sse/lib/deepseek-pow.js",
  "tests/unit/rebrand-collapse.test.js",
]);

const files = execFileSync("git", ["ls-files", "-z"], {
  cwd: process.cwd(),
  encoding: "buffer",
})
  .toString()
  .split("\0")
  .filter((f) => f && SCANNED.test(f) && !SKIP.test(f) && !SKIP_FILES.has(f));

// Trailing `;`, `)`, `{`, and a leading assignment/return/if-keyword wrapper
// are statement furniture, not part of the compared expression.
const FURNITURE_HEAD = /^(?:(?:const|let|var)\s+[\w$.[\]]+\s*=\s*|return\s+|if\s*\(\s*|else\s+if\s*\(\s*|\w+\s*=\s*)+/;
const FURNITURE_TAIL = /[\s;{}()]+$/;

function normalize(segment) {
  const bare = segment.replace(/\?\./g, ".").replace(/\s+/g, " ").trim();
  const head = bare.replace(FURNITURE_HEAD, "");
  return (head || bare).replace(FURNITURE_TAIL, "").trim();
}

const LOGICAL = /\s*(?:\|\||&&|\?\?)\s*/g;

// Compare whole expressions, tolerating a statement wrapper on either side:
//   `const x = a?.b`  vs  `a?.b;`   -> same expression
//   `...find((e) => e.name === "X"`  vs  `e.name === "X")`  -> same expression
function sameExpression(a, b) {
  if (a === b) return true;
  return a.endsWith(b) || b.endsWith(a);
}

function duplicatedSegments(line) {
  const segments = line.split(LOGICAL);
  if (segments.length < 2) return [];
  const out = [];
  for (let i = 0; i < segments.length; i += 1) {
    const raw = segments[i];
    if (!BRAND.test(raw)) continue;
    const key = normalize(raw);
    if (!key) continue;
    for (let j = 0; j < i; j += 1) {
      if (!BRAND.test(segments[j])) continue;
      const prior = normalize(segments[j]);
      if (prior && sameExpression(prior, key)) {
        out.push(`duplicated expression \`${key}\` (segments ${j + 1} and ${i + 1})`);
      }
    }
  }
  return out;
}

// Repeats that are statements rather than a logical chain.
function repeatedStatements(line) {
  const out = [];
  // delete auth["miawrouter"]; delete auth["miawrouter"];
  // Groups: 1 = `auth[`, 2 = quote, 3 = key. `\2` closes the quote.
  const deletes = [...line.matchAll(/delete\s+([\w$.?[\]]*\[)\s*(["'])([^"'\n]*)\2\s*\]/gi)];
  if (deletes.length >= 2) {
    const target = (m) => `${m[1]}${m[3]}`.replace(/\?\./g, ".").replace(/\s+/g, "");
    for (let i = 1; i < deletes.length; i += 1) {
      if (target(deletes[i - 1]) === target(deletes[i]) && BRAND.test(deletes[i][3])) {
        out.push(`delete ${deletes[i][1]}${deletes[i][3]}]`);
      }
    }
  }
  // { hasMiawRouter: x, hasMiawRouter: x }
  const keys = [...line.matchAll(/\b([A-Za-z_$][\w$]*)\s*:/g)].map((m) => m[1]).filter((k) => BRAND.test(k));
  for (let i = 1; i < keys.length; i += 1) {
    if (keys[i - 1] === keys[i]) out.push(`key ${keys[i]}`);
  }
  return out;
}

// replace(/\bmiawrouter\b/gi, "miawrouter") — a no-op rewrite.
function selfReplace(line) {
  const m = /\.replace(?:All)?\(\s*\/([^/\n]*)\/[a-z]*\s*,\s*(["'])([^"'\n]*)\2/i.exec(line);
  if (!m) return null;
  const [, pattern, , replacement] = m;
  if (!BRAND.test(pattern) || !BRAND.test(replacement)) return null;
  try {
    return new RegExp(pattern.replace(/\\b/g, ""), "i").test(replacement) ? pattern : null;
  } catch {
    return null;
  }
}

function inspect(line) {
  const findings = duplicatedSegments(line);
  findings.push(...repeatedStatements(line));
  const sr = selfReplace(line);
  if (sr) findings.push(`self replace /${sr}/`);
  return findings;
}

describe("rebrand value collapse", () => {
  it("has no dead brand branches left by the rename", () => {
    const findings = [];
    for (const file of files) {
      let source;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      if (!BRAND.test(source)) continue;
      source.split("\n").forEach((line, index) => {
        // Comment prose describes the damage; only code is scanned.
        const code = line.trim();
        if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) return;
        for (const hit of inspect(code)) {
          findings.push(`${file}:${index + 1} ${hit}: ${code.slice(0, 120)}`);
        }
      });
    }
    expect(findings).toEqual([]);
  });

  // The scan only earns its place if it fails on the damage it exists for.
  it("flags every collapse shape that has shipped", () => {
    const damage = [
      `cmd.includes("miawrouter") || cmd.includes("miawrouter")`,
      `const entry = status.config.find((e) => e.name === "MiawRouter" || e.name === "MiawRouter");`,
      `const configured = autoConfigStatus?.hasMiawRouter ?? autoConfigStatus?.hasMiawRouter;`,
      `hasMiawRouter: hasMiawRouterConfig(settings), hasMiawRouter: hasMiawRouterConfig(settings),`,
      `delete auth["miawrouter"]; delete auth["miawrouter"];`,
      String.raw`out = out.replace(/\bmiawrouter\b(?!\.com)/gi, "miawrouter");`,
    ];
    const missed = damage.filter((line) => inspect(line).length === 0);
    expect(missed).toEqual([]);
  });

  it("leaves intended brand usage alone", () => {
    const fine = [
      String.raw`cmd.includes("cli.js") || cmd.includes("\\miawrouter") || cmd.includes("/miawrouter")`,
      `if (n === "system") return "system";`,
      'name = "MiawRouter" + "Routed via MiawRouter gateway";',
      `process.stderr.write("[miawrouter] " + (err && err.message ? err.message : err));`,
      `return id === MIAWROUTER_TARGET || id === "cli" || id === "both";`,
      `const entry = auth["openai-compatible"];`,
      `const provider = settings?.models?.providers?.["miawrouter"];`,
      `if (mode === "single") return "single";`,
      `if (baseUrl.includes("miawrouter")) return true;`,
      `if (e.name === "MiawRouter") return true;`,
      `const configured = result.configured === true || result.hasMiawRouter === true;`,
      `const on = process.env.MIAW_PROXY_MANAGED === "1" || process.env.MIAWROUTER_PROXY_MANAGED === "1";`,
      `if (target === MIAWROUTER_TARGET || target === "both") {`,
    ];
    const flagged = fine.filter((line) => inspect(line).length > 0);
    expect(flagged).toEqual([]);
  });
});
