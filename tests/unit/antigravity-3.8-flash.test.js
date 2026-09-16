import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.resolve(import.meta.dirname, "../..", file), "utf8");

describe("Antigravity Gemini 3.8 Flash", () => {
  it("registers all Flash tiers and maps them through MITM", () => {
    const registry = read("open-sse/providers/registry/antigravity.js");
    const cliTools = read("src/shared/constants/cliTools.js");
    const mitmConfig = read("src/mitm/config.js");
    const mitmServer = read("src/mitm/server.js");

    for (const tier of ["high", "medium", "low"]) {
      expect(registry).toContain(`id: "gemini-3.8-flash-${tier}"`);
      expect(cliTools).toContain(`id: "gemini-3.8-flash-${tier}"`);
      expect(mitmConfig).toContain(`"gemini-3.8-flash-${tier}": "gemini-3.8-flash-${tier}"`);
    }
    expect(mitmConfig).toContain('"gemini-3.8-flash": "gemini-3.8-flash-high"');
    expect(mitmServer).toContain("/^gemini-3\\.(?:8|7)-flash-(high|medium|low)$/i");
  });
});
