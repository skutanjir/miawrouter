import { describe, it, expect, vi } from "vitest";
import { chooseInstaller, findUv, hasPip } from "../../src/lib/headroom/environment.js";

describe("Headroom environment setup", () => {
  it("prefers uv and falls back to pip in automatic mode", () => {
    expect(chooseInstaller("auto", { uv: "uv", pip: true })).toBe("uv");
    expect(chooseInstaller("auto", { uv: null, pip: true })).toBe("pip");
    expect(chooseInstaller("auto", { uv: "uv", pip: false })).toBe("uv");
  });
  it("honors explicit installer choices and rejects unavailable or invalid ones", () => {
    expect(chooseInstaller("pip", { uv: "uv", pip: true })).toBe("pip");
    expect(() => chooseInstaller("uv", { uv: null, pip: true })).toThrow("uv was not found");
    expect(() => chooseInstaller("auto", { uv: null, pip: false })).toThrow("No supported installer");
    expect(() => chooseInstaller("arbitrary command", { uv: "uv", pip: true })).toThrow("Installer must");
  });
  it("probes pip through the selected Windows launcher interpreter", () => {
    const run = vi.fn();
    expect(hasPip({ command: "py", args: ["-3.12"] }, { run })).toBe(true);
    expect(run).toHaveBeenCalledWith("py", ["-3.12", "-m", "pip", "--version"], expect.objectContaining({ windowsHide: true }));
    expect(hasPip(null, { run })).toBe(false);
  });
  it("detects uv without shell interpolation and tolerates missing installations", () => {
    const run = vi.fn();
    expect(findUv({ run })).toBe("uv");
    expect(run).toHaveBeenCalledWith("uv", ["--version"], expect.any(Object));
    expect(findUv({ run: () => { throw new Error("missing"); } })).toBeNull();
  });
});
