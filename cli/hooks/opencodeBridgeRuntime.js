const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");

function registerOpenCodeBridge() {
  const dataDir = process.env.DATA_DIR || (process.platform === "win32"
    ? path.join(process.env.APPDATA || os.homedir(), "miawrouter")
    : path.join(os.homedir(), ".miawrouter"));
  const dbPath = path.join(dataDir, "db", "data.sqlite");
  if (!fs.existsSync(dbPath)) return false;
  let db;
  try {
    try {
      const { DatabaseSync } = require("node:sqlite");
      db = new DatabaseSync(dbPath);
    } catch {
      const BetterSqlite = require(path.join(dataDir, "runtime", "node_modules", "better-sqlite3"));
      db = new BetterSqlite(dbPath);
    }
    db.exec("PRAGMA busy_timeout=5000; BEGIN IMMEDIATE");
    const nodes = db.prepare("SELECT data FROM providerNodes").all();
    if (nodes.some((row) => { try { return JSON.parse(row.data).prefix === "ocbridge"; } catch { return false; } })) {
      db.exec("COMMIT");
      return true;
    }
    const now = new Date().toISOString();
    const id = `openai-compatible-chat-${crypto.randomUUID()}`;
    const config = { prefix: "ocbridge", apiType: "chat", baseUrl: "http://127.0.0.1:20129/v1" };
    db.prepare("INSERT INTO providerNodes(id,type,name,data,createdAt,updatedAt) VALUES(?,?,?,?,?,?)")
      .run(id, "openai-compatible", "OpenCode Free Bridge", JSON.stringify(config), now, now);
    const data = { apiKey: "public", testStatus: "unknown", providerSpecificData: { ...config, nodeName: "OpenCode Free Bridge", connectionProxyEnabled: false, connectionProxyUrl: "", connectionNoProxy: "" } };
    db.prepare("INSERT INTO providerConnections(id,provider,authType,name,priority,isActive,data,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), id, "apikey", "OpenCode Free Bridge", 1, 1, JSON.stringify(data), now, now);
    db.exec("COMMIT");
    return true;
  } catch (error) {
    try { db?.exec("ROLLBACK"); } catch {}
    console.warn(`OpenCode Free Bridge setup failed: ${error.message}`);
    return false;
  } finally {
    db?.close();
  }
}

function startOpenCodeBridge({ log = console } = {}) {
  if (process.env.MIAW_OPENCODE_BRIDGE === "0") return null;
  const sourceDir = path.join(__dirname, "..", "vendor", "opencode-free-bridge");
  const script = path.join(sourceDir, "server.js");
  if (!fs.existsSync(script)) {
    log.warn("OpenCode Free Bridge is missing from this installation.");
    return null;
  }
  const homeBun = path.join(os.homedir(), ".bun", "bin", process.platform === "win32" ? "bun.exe" : "bun");
  const bun = fs.existsSync(homeBun) ? homeBun : "bun";
  const check = spawnSync(bun, ["--version"], { stdio: "ignore", windowsHide: true, timeout: 5000 });
  if (check.status !== 0) {
    log.warn("OpenCode Free Bridge needs Bun. Install Bun and restart Miawrouter.");
    return null;
  }

  // Pass only runtime environment; the third-party process does not need router secrets.
  const env = {};
  for (const key of ["PATH", "Path", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "SYSTEMROOT", "SystemRoot", "TEMP", "TMP", "TMPDIR"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  Object.assign(env, { HOST: "127.0.0.1", PORT: "20129", AUTO_UPDATE: "0" });
  const child = spawn(bun, [script], { cwd: sourceDir, env, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  child.on("error", (error) => log.warn(`OpenCode Free Bridge failed to start: ${error.message}`));
  child.stderr.on("data", (data) => {
    if (String(data).includes("EADDRINUSE")) log.warn("OpenCode Free Bridge port 20129 is already in use.");
  });
  return child;
}

module.exports = { startOpenCodeBridge, registerOpenCodeBridge };
