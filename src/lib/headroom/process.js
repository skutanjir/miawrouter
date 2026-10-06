import fs from "fs";
import path from "path";
import { spawn, execFileSync } from "child_process";
import { findHeadroomBinary, findPython310Spec, HEADROOM_COMPRESSION_EXTRAS, EXTRA_MARKERS, getInstalledHeadroomExtras } from "./detect.js";
import { HEADROOM_DIR, HEADROOM_VENV, HEADROOM_PYTHON, HEADROOM_SETUP_TIMEOUT_MS, findUv, hasPip, chooseInstaller } from "./environment.js";

const PID_FILE = path.join(HEADROOM_DIR, "proxy.pid");
const LOG_FILE = path.join(HEADROOM_DIR, "proxy.log");
const INSTALL_LOG_FILE = path.join(HEADROOM_DIR, "install.log");
const DEFAULT_PORT = 8787;
const STARTUP_TIMEOUT_MS = 8000;

function ensureDir() {
  if (!fs.existsSync(HEADROOM_DIR)) fs.mkdirSync(HEADROOM_DIR, { recursive: true });
}

function readPid() {
  try {
    if (fs.existsSync(PID_FILE)) return parseInt(fs.readFileSync(PID_FILE, "utf8"), 10);
  } catch { /* ignore */ }
  return null;
}

function writePid(pid) {
  ensureDir();
  fs.writeFileSync(PID_FILE, String(pid));
}

function clearPid() {
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch { /* ignore */ }
}

// process.kill throws if pid is dead — use this to probe.
export function isPidAlive(pid) {
  if (!pid || typeof pid !== "number") return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function terminatePid(pid, force) {
  if (process.platform === "win32") {
    execFileSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 3000 });
    return;
  }
  process.kill(pid, force ? "SIGKILL" : "SIGTERM");
}

export function getManagedPid() {
  const pid = readPid();
  return pid && isPidAlive(pid) ? pid : null;
}

// Build proxy CLI flags for the active compression extras. `[code]` (AST
// compression) is off by default in headroom → pass --code-aware to turn it on;
// `[ml]` (Kompress) is on by default → pass --disable-kompress to turn it off.
function extrasProxyArgs({ codeAware, kompress } = {}) {
  const args = [];
  if (codeAware) args.push("--code-aware");
  if (kompress === false) args.push("--disable-kompress");
  return args;
}

export async function startHeadroomProxy({ port = DEFAULT_PORT, codeAware = false, kompress = true } = {}) {
  const safePort = Number(port) > 0 && Number(port) < 65536 ? Number(port) : DEFAULT_PORT;
  const binary = findHeadroomBinary();
  if (!binary) {
    const err = new Error("Headroom CLI not installed");
    err.code = "NOT_INSTALLED";
    throw err;
  }

  const existing = getManagedPid();
  if (existing) return { pid: existing, alreadyRunning: true };

  ensureDir();
  // spawn stdio requires fd numbers, not WriteStream objects.
  const outFd = fs.openSync(LOG_FILE, "a");

  const args = ["proxy", "--port", String(safePort), ...extrasProxyArgs({ codeAware, kompress })];
  const child = spawn(binary, args, {
    stdio: ["ignore", outFd, outFd],
    detached: true,
    windowsHide: true,
    env: { ...process.env },
  });

  if (!child.pid) {
    fs.closeSync(outFd);
    const err = new Error("Failed to spawn headroom proxy");
    err.code = "SPAWN_FAILED";
    throw err;
  }

  child.unref();
  writePid(child.pid);

  // Wait until the process either stays alive briefly (success) or exits fast (failure).
  await new Promise((resolve, reject) => {
    const startupTimer = setTimeout(() => {
      if (isPidAlive(child.pid)) resolve();
      else reject(new Error("headroom proxy exited during startup — see proxy.log"));
    }, STARTUP_TIMEOUT_MS);

    child.once("exit", (code) => {
      clearTimeout(startupTimer);
      clearPid();
      fs.closeSync(outFd);
      const e = new Error(`headroom proxy exited early (code=${code}) — see proxy.log`);
      e.code = "EARLY_EXIT";
      reject(e);
    });
  });

  // Close parent's copy of the fd; child retains its own after unref.
  fs.closeSync(outFd);

  return { pid: child.pid, alreadyRunning: false };
}

export function stopHeadroomProxy() {
  const pid = getManagedPid();
  if (!pid) return { stopped: false, reason: "not_running" };
  try {
    terminatePid(pid, false);
    // Give it a moment, then force if still alive.
    setTimeout(() => {
      if (isPidAlive(pid)) {
        try { terminatePid(pid, true); } catch { /* already gone */ }
      }
    }, 2000);
    clearPid();
    return { stopped: true, pid };
  } catch (e) {
    clearPid();
    const err = new Error(`Failed to stop headroom proxy: ${e.message}`);
    err.code = "STOP_FAILED";
    throw err;
  }
}

// Stop the managed proxy (if any), wait for the pid to die, then start again
// with the given flags. Used when toggling active extras that require a restart.
export async function restartHeadroomProxy(opts = {}) {
  const pid = getManagedPid();
  if (pid) {
    try { terminatePid(pid, false); } catch { /* already gone */ }
    // Wait up to ~3s for graceful exit, force-kill if still alive.
    for (let i = 0; i < 30 && isPidAlive(pid); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (isPidAlive(pid)) {
      try { terminatePid(pid, true); } catch { /* already gone */ }
      await new Promise((r) => setTimeout(r, 300));
    }
    clearPid();
  }
  return startHeadroomProxy(opts);
}

export function getHeadroomLogTail(maxLines = 200) {
  try {
    if (!fs.existsSync(LOG_FILE)) return "";
    const content = fs.readFileSync(LOG_FILE, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines).join("\n");
  } catch { return ""; }
}

// Install (or upgrade) headroom-ai with the requested compression extras.
// `extras` is a whitelist from HEADROOM_COMPRESSION_EXTRAS — anything else
// is rejected to keep the install surface predictable. Always installs the
// `proxy` base + whatever extras the user picked, regardless of what is
// already present.
let installInFlight = null;

function runInstallCommand(command, args) {
  ensureDir();
  const outFd = fs.openSync(INSTALL_LOG_FILE, "a");
  return new Promise((resolve, reject) => {
    let finished = false;
    let timer;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      fs.closeSync(outFd);
      if (error) reject(error); else resolve();
    };
    let child;
    try {
      child = spawn(command, args, { stdio: ["ignore", outFd, outFd], windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1", PIP_DEFAULT_TIMEOUT: "120", PIP_RETRIES: "5", UV_HTTP_TIMEOUT: "120", UV_HTTP_RETRIES: "5" } });
    } catch (error) { finish(error); return; }
    timer = setTimeout(() => {
      child.kill();
      finish(Object.assign(new Error("Setup exceeded 45 minutes for this step. Cached downloads are kept; check the install log and retry."), { code: "INSTALL_FAILED" }));
    }, HEADROOM_SETUP_TIMEOUT_MS);
    child.once("error", finish);
    child.once("close", (code) => finish(code === 0 ? null : Object.assign(new Error(`Setup exited with code ${code}. See the install log.`), { code: "INSTALL_FAILED" })));
  });
}

export function installHeadroomExtras(extras = [], { installer = "auto" } = {}) {
  if (installInFlight) return installInFlight;
  installInFlight = installHeadroomEnvironment(extras, installer).finally(() => { installInFlight = null; });
  return installInFlight;
}

async function installHeadroomEnvironment(extras, preference) {
  const requested = Array.isArray(extras) ? extras.filter((e) => HEADROOM_COMPRESSION_EXTRAS.includes(e)) : [];
  const py = findPython310Spec();
  const uv = findUv();
  const installer = chooseInstaller(preference, { uv, pip: hasPip(py) });
  // pip install string is built from a closed set (HEADROOM_COMPRESSION_EXTRAS),
  // so it cannot be poisoned by caller input — the comma-list is a fixed
  // ['proxy', ...requested]. No shell interpolation.
  const existing = fs.existsSync(HEADROOM_PYTHON) ? getInstalledHeadroomExtras(HEADROOM_PYTHON).extras : {};
  const extrasList = ["proxy", ...HEADROOM_COMPRESSION_EXTRAS.filter((extra) => requested.includes(extra) || existing[extra])].join(",");
  const spec = `headroom-ai[${extrasList}]`;
  ensureDir();
  fs.writeFileSync(INSTALL_LOG_FILE, `Setting up ${spec} with ${installer} in a private environment.\n`);
  if (!fs.existsSync(HEADROOM_PYTHON)) {
    if (installer === "uv") {
      const interpreter = py ? execFileSync(py.command, [...py.args, "-c", "import sys; print(sys.executable)"], { encoding: "utf8", timeout: 5000, windowsHide: true }).trim() : "3.12";
      await runInstallCommand(uv, ["venv", "--seed", "--python", interpreter, HEADROOM_VENV]);
    } else {
      await runInstallCommand(py.command, [...py.args, "-m", "venv", HEADROOM_VENV]);
    }
  }
  if (installer === "uv") await runInstallCommand(uv, ["pip", "install", "--python", HEADROOM_PYTHON, "--upgrade", spec]);
  else await runInstallCommand(HEADROOM_PYTHON, ["-m", "pip", "install", "--disable-pip-version-check", "--upgrade", spec]);
  const status = getInstalledHeadroomExtras(HEADROOM_PYTHON);
  if (!status.installed || !findHeadroomBinary()) throw Object.assign(new Error("Setup finished but Headroom is not available. Check the install log."), { code: "INSTALL_FAILED" });
  return { success: true, spec, installer, python: HEADROOM_PYTHON, ...status };
}

// Uninstall the marker packages that back a single extra (e.g. `ml` → torch,
// huggingface-hub). `headroom-ai` base and the `proxy` extra are never removed.
export async function uninstallHeadroomExtras(extras = []) {
  const requested = Array.isArray(extras) ? extras.filter((e) => HEADROOM_COMPRESSION_EXTRAS.includes(e)) : [];
  const py = fs.existsSync(HEADROOM_PYTHON) ? { command: HEADROOM_PYTHON, args: [] } : null;
  if (!py) {
    const err = new Error("Set up the private Headroom environment before removing extras. Global Python packages will not be removed.");
    err.code = "NO_PYTHON";
    throw err;
  }
  const pkgs = [...new Set(requested.flatMap((e) => EXTRA_MARKERS[e] || []))];
  if (pkgs.length === 0) {
    const err = new Error("No valid extras to remove");
    err.code = "INVALID_EXTRAS";
    throw err;
  }
  const args = ["-m", "pip", "uninstall", "-y", ...pkgs];

  ensureDir();
  const outFd = fs.openSync(INSTALL_LOG_FILE, "w");
  const child = spawn(py.command, [...py.args, ...args], {
    stdio: ["ignore", outFd, outFd],
    windowsHide: true,
    env: { ...process.env },
  });

  return new Promise((resolve, reject) => {
    child.once("error", (e) => { fs.closeSync(outFd); reject(e); });
    child.once("exit", (code) => {
      fs.closeSync(outFd);
      if (code === 0) {
        const status = getInstalledHeadroomExtras(py);
        resolve({ success: true, code, removed: pkgs, extras: requested, ...status });
      } else {
        const err = new Error(`pip uninstall exited with code=${code} — see headroom/install.log`);
        err.code = "UNINSTALL_FAILED";
        reject(err);
      }
    });
  });
}

// Read the tail of the install/uninstall log for live progress in the UI.
export function getInstallLogTail(maxLines = 15) {
  try {
    if (!fs.existsSync(INSTALL_LOG_FILE)) return "";
    const lines = fs.readFileSync(INSTALL_LOG_FILE, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines).join("\n");
  } catch { return ""; }
}
