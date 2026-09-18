import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..");
const lockPath = join(ROOT, "package-lock.json");
const pkgPath = join(ROOT, "package.json");
const gitignorePath = join(ROOT, ".gitignore");

describe("lockfile policy", () => {
  it("root package-lock.json is tracked (exists in repo)", () => {
    expect(existsSync(lockPath)).toBe(true);
  });

  it("lockfile name matches package.json name", () => {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    expect(lock.name).toBe(pkg.name);
  });

  it("lockfile version matches package.json version", () => {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    expect(lock.version).toBe(pkg.version);
  });

  it(".gitignore does not ignore package-lock.json", () => {
    const lines = readFileSync(gitignorePath, "utf8").split("\n");
    const ignoring = lines.some((l) => l.trim() === "package-lock.json");
    expect(ignoring).toBe(false);
  });
});

describe("package version policy", () => {
  // The CLI update check compares the published tarball's version against the
  // npm `latest` tag, and the server reports its own version in the dashboard.
  // If the two package.json files drift apart, users see phantom updates.
  it("root and cli package.json versions match", () => {
    const root = JSON.parse(readFileSync(pkgPath, "utf8"));
    const cli = JSON.parse(readFileSync(join(ROOT, "cli", "package.json"), "utf8"));
    expect(cli.version).toBe(root.version);
  });

  it("cli bin entry is named after the package", () => {
    const cli = JSON.parse(readFileSync(join(ROOT, "cli", "package.json"), "utf8"));
    expect(Object.keys(cli.bin)).toEqual([cli.name]);
  });
});
