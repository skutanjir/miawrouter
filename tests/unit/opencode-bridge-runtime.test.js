import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
let DatabaseSync;
try { ({ DatabaseSync } = require("node:sqlite")); } catch {}
const { registerOpenCodeBridge } = require("../../cli/hooks/opencodeBridgeRuntime.js");
const originalDataDir = process.env.DATA_DIR;
let tempDir;

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

describe.skipIf(!DatabaseSync)("built-in OpenCode bridge registration", () => {
  it("registers a loopback provider once without modifying an existing mapping", () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miaw-bridge-test-"));
    process.env.DATA_DIR = tempDir;
    fs.mkdirSync(path.join(tempDir, "db"));
    const db = new DatabaseSync(path.join(tempDir, "db", "data.sqlite"));
    db.exec("CREATE TABLE providerNodes(id TEXT, type TEXT, name TEXT, data TEXT, createdAt TEXT, updatedAt TEXT); CREATE TABLE providerConnections(id TEXT, provider TEXT, authType TEXT, name TEXT, priority INTEGER, isActive INTEGER, data TEXT, createdAt TEXT, updatedAt TEXT)");
    expect(registerOpenCodeBridge()).toBe(true);
    expect(registerOpenCodeBridge()).toBe(true);
    const nodes = db.prepare("SELECT * FROM providerNodes").all();
    const connections = db.prepare("SELECT * FROM providerConnections").all();
    expect(nodes).toHaveLength(1);
    expect(connections).toHaveLength(1);
    expect(JSON.parse(nodes[0].data)).toMatchObject({ prefix: "ocbridge", baseUrl: "http://127.0.0.1:20129/v1" });
    expect(connections[0].provider).toBe(nodes[0].id);
    db.close();
  });
});
