import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { ANTIGRAVITY_FIXER } from "../../src/shared/constants/antigravityRecovery.js";

const require = createRequire(import.meta.url);
const { findPython, parseFixerArgs } = require("../../cli/hooks/antigravityFixerRuntime.js");
const cliPath = fileURLToPath(new URL("../../cli/cli.js", import.meta.url));

describe("bundled Antigravity Fixer", () => {
  it("ships licensed source at the reviewed revision", () => {
    const metadata = require("../../cli/vendor/antigravity-fixer/UPSTREAM.json");
    expect(metadata.revision).toBe(ANTIGRAVITY_FIXER.revision);
    expect(readFileSync(new URL("../../cli/vendor/antigravity-fixer/LICENSE", import.meta.url), "utf8")).toContain("MIT License");
    expect(require("../../cli/package.json").files).toContain("vendor");
  });
  it.each(["clean", "interactive"])("refuses %s before setting up Python without explicit confirmation", (action) => {
    const result = spawnSync(process.execPath, [cliPath, "antigravity-fixer", action], { encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--confirm-clean");
    expect(result.stdout).toBe("");
  });
  it("shows help without starting the gateway or setting up Python", () => {
    const result = spawnSync(process.execPath, [cliPath, "antigravity-fixer", "--help"], { encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("antigravity-fixer setup");
    expect(result.stderr).toBe("");
  });
  it("rejects arbitrary options before forwarding arguments", () => {
    expect(() => parseFixerArgs(["clean", "--confirm-clean", "--uninstall"])).toThrow("Unknown option");
    expect(() => parseFixerArgs(["diagnose"])).toThrow("Use:");
    expect(parseFixerArgs(["clean", "--confirm-clean"]).pythonArgs).toEqual(["--clean-only", "--lang", "en"]);
    expect(parseFixerArgs(["interactive", "--confirm-clean"]).pythonArgs).toEqual(["--lang", "en"]);
  });
  it("skips old Python and falls back to a compatible interpreter on Windows", () => {
    const calls = [];
    const python = findPython({ platform: "win32", run: (command) => {
      calls.push(command);
      return { status: 0, stdout: command === "py" ? "False\n" : "True\n" };
    } });
    expect(calls).toEqual(["py", "python"]);
    expect(python).toEqual({ command: "python", prefix: [] });
  });
  it("provides a repair command when Python is unavailable", () => {
    expect(() => findPython({ platform: "linux", run: () => ({ status: 1 }) })).toThrow("antigravity-fixer setup");
  });
});
