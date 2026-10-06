import { EventEmitter } from "node:events";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const mocks = vi.hoisted(() => ({ spawn: vi.fn(), exists: vi.fn(), python: vi.fn(), uv: vi.fn(), pip: vi.fn(), metadata: vi.fn() }));
vi.mock("fs", () => ({ default: { existsSync: mocks.exists, mkdirSync: vi.fn(), writeFileSync: vi.fn(), openSync: () => 12, closeSync: vi.fn() } }));
vi.mock("child_process", () => ({ spawn: mocks.spawn, execFileSync: () => "C:/Python/python.exe" }));
vi.mock("../../src/lib/headroom/detect.js", () => ({ findHeadroomBinary: () => "private/headroom", findPython310Spec: mocks.python, HEADROOM_COMPRESSION_EXTRAS: ["code", "ml"], EXTRA_MARKERS: { code: ["tree-sitter"], ml: ["torch"] }, getInstalledHeadroomExtras: mocks.metadata }));
vi.mock("../../src/lib/headroom/environment.js", async (original) => ({ ...(await original()), HEADROOM_DIR: "private", HEADROOM_VENV: "private/.venv", HEADROOM_PYTHON: "private/python", findUv: mocks.uv, hasPip: mocks.pip }));
import { installHeadroomExtras } from "../../src/lib/headroom/process.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exists.mockReturnValue(false);
  mocks.python.mockReturnValue({ command: "py", args: ["-3.12"] });
  mocks.uv.mockReturnValue("uv");
  mocks.pip.mockReturnValue(true);
  mocks.metadata.mockReturnValue({ installed: true, version: "test", extras: { code: false, ml: false } });
  mocks.spawn.mockImplementation(() => {
    const child = new EventEmitter();
    child.kill = vi.fn();
    queueMicrotask(() => child.emit("close", 0));
    return child;
  });
});
afterEach(() => vi.useRealTimers());

describe("private Headroom installation", () => {
  it("keeps slow setup alive after five minutes and only times out at 45 minutes", async () => {
    vi.useFakeTimers();
    const child = new EventEmitter();
    child.kill = vi.fn();
    mocks.spawn.mockReturnValueOnce(child);
    const setup = installHeadroomExtras([]);
    const failure = expect(setup).rejects.toThrow("45 minutes");
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(child.kill).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(39 * 60 * 1000);
    await failure;
    expect(child.kill).toHaveBeenCalledOnce();
  });
  it("creates a private environment and uses uv without a preinstalled Python", async () => {
    mocks.python.mockReturnValue(null);
    const result = await installHeadroomExtras([], { installer: "auto" });
    expect(result.installer).toBe("uv");
    expect(mocks.spawn.mock.calls.map(([cmd, args]) => [cmd, args])).toEqual([
      ["uv", ["venv", "--seed", "--python", "3.12", "private/.venv"]],
      ["uv", ["pip", "install", "--python", "private/python", "--upgrade", "headroom-ai[proxy]"]],
    ]);
  });
  it("uses the Windows Python launcher for venv and private pip for dependencies", async () => {
    await installHeadroomExtras(["code", "untrusted;command"], { installer: "pip" });
    expect(mocks.spawn.mock.calls.map(([cmd, args]) => [cmd, args])).toEqual([
      ["py", ["-3.12", "-m", "venv", "private/.venv"]],
      ["private/python", ["-m", "pip", "install", "--disable-pip-version-check", "--upgrade", "headroom-ai[proxy,code]"]],
    ]);
  });
  it("rejects a missing installer before starting any process", async () => {
    mocks.uv.mockReturnValue(null);
    mocks.pip.mockReturnValue(false);
    await expect(installHeadroomExtras([])).rejects.toMatchObject({ code: "NO_INSTALLER" });
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
  it("reports process failure and allows retry", async () => {
    mocks.spawn.mockImplementationOnce(() => { const child = new EventEmitter(); queueMicrotask(() => child.emit("error", new Error("cannot launch"))); return child; });
    await expect(installHeadroomExtras([])).rejects.toThrow("cannot launch");
    await expect(installHeadroomExtras([])).resolves.toMatchObject({ success: true });
  });
});
