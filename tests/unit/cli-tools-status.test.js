import { describe, it, expect } from "vitest";

// Re-implement the status logic tested in ToolSummaryCard
function getStatus(status, tool) {
  if (tool?.configType === "guide" && !tool?.autoConfig) {
    return { label: "Guide", state: "guide", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
  if (!status) return { label: "Unknown", state: "unknown", cls: "bg-surface-2 text-text-muted border-border-subtle" };
  if (!status.installed) return { label: "Not installed", state: "missing", cls: "bg-surface-2 text-text-muted border-border-subtle" };
  if (status.hasMiawRouter || status.has9Router || status.configured) {
    return { label: "Connected", state: "connected", cls: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" };
  }
  return { label: "Not configured", state: "unconfigured", cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20" };
}

describe("CLI Tools status derivation", () => {
  it("derives Guide status for manual/guide tools without status getter", () => {
    const tool = { configType: "guide" };
    expect(getStatus(undefined, tool)).toEqual({
      label: "Guide",
      state: "guide",
      cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    });
  });

  it("derives Connected when hasMiawRouter is true", () => {
    const status = { installed: true, hasMiawRouter: true };
    expect(getStatus(status, { configType: "custom" }).label).toBe("Connected");
  });

  it("derives Connected when configured is true", () => {
    const status = { installed: true, configured: true };
    expect(getStatus(status, { configType: "custom" }).label).toBe("Connected");
  });

  it("derives Connected when legacy has9Router is true", () => {
    const status = { installed: true, has9Router: true };
    expect(getStatus(status, { configType: "custom" }).label).toBe("Connected");
  });

  it("derives Not configured when installed but not configured", () => {
    const status = { installed: true, hasMiawRouter: false, has9Router: false };
    expect(getStatus(status, { configType: "custom" }).label).toBe("Not configured");
  });

  it("derives Not installed when installed is false", () => {
    const status = { installed: false };
    expect(getStatus(status, { configType: "custom" }).label).toBe("Not installed");
  });
});
