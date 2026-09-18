import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("sidebar Router Console", () => {
  const sidebar = read("src/shared/components/Sidebar.js");
  const layout = read("src/shared/components/layouts/DashboardLayout.js");
  const css = read("src/app/globals.css");

  it("exposes current route and disclosure state", () => {
    expect(sidebar).toContain('aria-current={active ? "page" : undefined}');
    expect(sidebar).toContain("aria-expanded={expanded}");
    expect(sidebar).toContain("aria-expanded={mediaOpen}");
    expect(sidebar).toContain('aria-controls="sidebar-media-provider-links"');
  });

  it("closes the mobile drawer with Escape", () => {
    expect(layout).toContain('event.key === "Escape"');
    expect(layout).toContain('aria-label="Dashboard navigation"');
  });

  it("does not use the legacy active left stripe or brand gradient", () => {
    const sidebarCss = css.slice(css.indexOf(".nav-item"), css.indexOf("/* Topology:"));
    expect(sidebarCss).not.toContain("border-left");
    expect(sidebarCss).not.toContain("linear-gradient");
  });
});
