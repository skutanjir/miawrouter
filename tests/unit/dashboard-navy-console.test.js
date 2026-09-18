import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("dashboard Navy Console foundation", () => {
  const css = read("src/app/globals.css");
  const card = read("src/shared/components/Card.js");

  it("defines the shared visual contract for both themes", () => {
    for (const token of [
      "--color-bg",
      "--color-surface",
      "--color-border",
      "--color-text-main",
      "--color-primary",
      "--shadow-focus",
      "--radius-brand",
    ]) {
      expect(css).toContain(token);
    }
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css.match(/\.dark\s*\{/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("supports semantic card roles without removing the existing API", () => {
    expect(card).toContain('variant = "default"');
    expect(card).toMatch(/metric:/);
    expect(card).toMatch(/section:/);
    expect(card).toMatch(/interactive:/);
    expect(card).toMatch(/danger:/);
    expect(card).toContain("title");
    expect(card).toContain("action");
  });
});
