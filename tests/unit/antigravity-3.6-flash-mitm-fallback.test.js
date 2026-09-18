import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const read = (file) => fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8");

describe("BUG 2B: Antigravity Gemini 3.6 Flash MITM Fallback Regex", () => {
  it("server.js fallback regex matches 3.8, 3.7, and 3.6 flash tiers", () => {
    const serverSource = read("src/mitm/server.js");
    expect(serverSource).toContain("/^gemini-3\\.(?:8|7|6)-flash-(high|medium|low)$/i");

    const regexMatch = serverSource.match(/\/\^gemini-3\\\.\(\?:[0-9|]+\)-flash-\(high\|medium\|low\)\$\/i/);
    expect(regexMatch).not.toBeNull();
    const regex = new RegExp(regexMatch[0].slice(1, -2), "i");

    for (const version of ["3.8", "3.7", "3.6"]) {
      for (const tier of ["high", "medium", "low"]) {
        expect(regex.test(`gemini-${version}-flash-${tier}`)).toBe(true);
      }
    }
    expect(regex.test("gemini-3.5-flash-high")).toBe(false);
  });
});
