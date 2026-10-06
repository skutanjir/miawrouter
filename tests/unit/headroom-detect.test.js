import path from "node:path";
import { PACKAGE_METADATA_PROBE } from "../../src/lib/headroom/environment.js";
import { describe, it, expect, vi, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  execSync: vi.fn(() => { throw new Error("not found"); }),
  execFile: vi.fn(() => ({ toString: () => "[object Object]" })),
  execFileSync: vi.fn(() => Buffer.from(JSON.stringify([
    { name: "headroom-ai", version: "0.26.0" },
    { name: "tree-sitter", version: "0.25.0" },
  ]))),
}));

vi.mock("child_process", () => ({
  execSync: mocks.execSync,
  execFile: mocks.execFile,
  execFileSync: mocks.execFileSync,
}));
vi.mock("node:fs", () => ({ default: { existsSync: () => false } }));

import { findPython310, getHeadroomStatus, getInstalledHeadroomExtras, isLoopbackHeadroomUrl, pythonCommandSpec } from "../../src/lib/headroom/detect.js";

afterEach(() => {
  vi.clearAllMocks();
});

describe("headroom detect", () => {
  it("splits Windows py launcher versions into executable and args", () => {
    expect(pythonCommandSpec("py -3.13", true)).toEqual({ command: "py", args: ["-3.13"] });
    expect(pythonCommandSpec("python", true)).toEqual({ command: "python", args: [] });
  });

  it("supports a Python command spec when probing package metadata", () => {
    mocks.execFileSync.mockImplementationOnce(() => Buffer.from(JSON.stringify([
      { name: "headroom-ai", version: "0.26.0" },
    ])));
    expect(getInstalledHeadroomExtras({ command: "py", args: ["-3.13"] })).toMatchObject({
      installed: true,
      version: "0.26.0",
    });
    expect(mocks.execFileSync).toHaveBeenCalledWith(
      "py",
      ["-3.13", "-c", PACKAGE_METADATA_PROBE],
      expect.any(Object),
    );
  });

  it("detects installed headroom version and extras from package metadata", () => {
    const result = getInstalledHeadroomExtras("python3");

    expect(mocks.execFileSync).toHaveBeenCalledWith(
      "python3",
      ["-c", PACKAGE_METADATA_PROBE],
      expect.objectContaining({ windowsHide: true, timeout: 8000 }),
    );
    expect(result).toEqual({
      installed: true,
      version: "0.26.0",
      extras: { code: true, ml: false },
    });
  });

  it("prefers the interpreter that actually has headroom-ai installed", () => {
    // headroom binary lives in a bin dir; the python next to it has headroom-ai.
    const binPython = path.join("/opt/hr/bin", process.platform === "win32" ? "python.exe" : "python3");
    mocks.execSync.mockImplementation((cmd) => {
      if (String(cmd).includes("where") || String(cmd).includes("which")) return Buffer.from("/opt/hr/bin/headroom\n");
      if (String(cmd).includes("--version")) return Buffer.from("Python 3.13.0\n");
      throw new Error("unexpected execSync");
    });
    mocks.execFileSync.mockImplementation((py, args) => {
      if (args.includes("--version") && py !== "uv" && !py.endsWith("uv.exe") && !py.endsWith("/uv")) return Buffer.from("Python 3.13.0\n");
      if (args[0] === "-c" && args[1].includes("m.version")) {
        if (py === binPython) return Buffer.from("Name: headroom-ai\nVersion: 0.26.0\n");
        throw new Error(`not installed in ${py}`);
      }
      throw new Error(`unexpected execFileSync: ${py} ${args.join(" ")}`);
    });

    expect(findPython310()).toBe(binPython);
  });

  it("keeps top-level installed flag true when extras are readable", async () => {
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 }));
    mocks.execSync.mockImplementation((cmd) => {
      if (String(cmd).includes("where") || String(cmd).includes("which")) return Buffer.from("C:/Python/Scripts/headroom.exe\n");
      if (String(cmd).includes("python3 --version")) return Buffer.from("Python 3.13.0\n");
      if (String(cmd).includes("python --version")) return Buffer.from("Python 3.13.0\n");
      throw new Error("unexpected execSync");
    });
    mocks.execFileSync.mockImplementation((py, args) => {
      if (args.includes("--version") && py !== "uv" && !py.endsWith("uv.exe") && !py.endsWith("/uv")) return Buffer.from("Python 3.13.0\n");
      if (py === "python3" && args[0] === "-c" && args[1].includes("m.version")) throw new Error("not installed in python3");
      if (py === "python" && args[0] === "-c" && args[1].includes("m.version")) return Buffer.from("Name: headroom-ai\nVersion: 0.26.0\n");
      if (py === "python" && args[1] === PACKAGE_METADATA_PROBE) return Buffer.from(JSON.stringify([
        { name: "headroom-ai", version: "0.26.0" },
        { name: "tree-sitter", version: "0.25.0" },
      ]));
      throw new Error(`unexpected execFileSync: ${py} ${args.join(" ")}`);
    });

    const status = await getHeadroomStatus("http://localhost:8787");

    expect(status.installed).toBe(true);
    expect(status.version).toBe("0.26.0");
    expect(status.extras).toEqual({ code: true, ml: false });
  });

  it("treats a reachable external proxy as running without local CLI", async () => {
    global.fetch = vi.fn(async () => new Response("ok", { status: 200 }));
    mocks.execSync.mockImplementation((cmd) => {
      if (String(cmd).includes("where") || String(cmd).includes("which")) throw new Error("not found");
      throw new Error("unexpected execSync");
    });
    mocks.execFileSync.mockImplementation(() => { throw new Error("pip unavailable"); });

    const status = await getHeadroomStatus("http://headroom:8787");

    expect(status.installed).toBe(false);
    expect(status.running).toBe(true);
    expect(status.localUrl).toBe(false);
    expect(status.canStart).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith("http://headroom:8787/health", expect.any(Object));
  });

  it("recognizes loopback URLs for managed local mode", () => {
    expect(isLoopbackHeadroomUrl("http://localhost:8787")).toBe(true);
    expect(isLoopbackHeadroomUrl("http://127.0.0.1:8787")).toBe(true);
    expect(isLoopbackHeadroomUrl("http://headroom:8787")).toBe(false);
    expect(isLoopbackHeadroomUrl("not-a-url")).toBe(false);
  });
});
