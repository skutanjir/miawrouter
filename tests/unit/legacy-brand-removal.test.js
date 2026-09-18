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
