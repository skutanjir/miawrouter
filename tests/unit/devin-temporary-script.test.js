import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureClientToolsScript } from "../../open-sse/executors/devin-cli.js";

describe("Devin client-tools temporary script", () => {
  it("uses a unique temporary directory and reuses the script for this process", () => {
    const script = ensureClientToolsScript();
    const dir = path.dirname(script);
    expect(path.dirname(dir)).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(dir)).toMatch(/^miawrouter-devin-/);
    expect(path.basename(script)).toBe("client-tools.mjs");
    expect(ensureClientToolsScript()).toBe(script);
    fs.unlinkSync(script);
    fs.rmdirSync(dir);
  });
});
