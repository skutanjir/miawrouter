import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import net from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { checkPortAvailable, waitForPortAvailable } = require("../../cli/hooks/portCheck.js");

describe("CLI network defaults", () => {
  it("documents its loopback default and retains the explicit host option", () => {
    const result = spawnSync(process.execPath, [path.resolve("cli/cli.js"), "--help"], { encoding: "utf8", timeout: 10000 });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--host <host>");
    expect(result.stdout).toContain("default: 127.0.0.1");
  });

  it("refuses an occupied port without terminating its listener", async () => {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    try {
      await expect(checkPortAvailable(port, "127.0.0.1")).rejects.toMatchObject({ code: "EADDRINUSE" });
      expect(server.listening).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
    await expect(checkPortAvailable(port, "127.0.0.1")).resolves.toBeUndefined();
  });

  it("waits for its own listener to release a port during a tray handoff", async () => {
    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = server.address().port;
    const wait = waitForPortAvailable(port, "127.0.0.1", 2000);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await new Promise((resolve) => server.close(resolve));
    await expect(wait).resolves.toBeUndefined();
  });
});
