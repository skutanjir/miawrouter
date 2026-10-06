// Bundled source stays in the package; Python dependencies stay in user data.
const { spawnSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { getRuntimeDir } = require("./sqliteRuntime");

const SOURCE_DIR = path.resolve(__dirname, "../vendor/antigravity-fixer");
const metadata = require("../vendor/antigravity-fixer/UPSTREAM.json");
const PYTHON_PROBE = "import sys; print(sys.version_info >= (3, 10))";
const DEPENDENCY_PROBE = "import rich; from camoufox.sync_api import Camoufox";
const INSTALL_TIMEOUT_MS = 300000;

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, ...options });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || String(result.stderr || `Python exited ${result.status}`).trim().slice(-600));
  }
  return result;
}

function findPython({ platform = process.platform, run = spawnSync } = {}) {
  const candidates = platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
  for (const [command, prefix] of candidates) {
    const result = run(command, [...prefix, "-c", PYTHON_PROBE], { encoding: "utf8", timeout: 10000, windowsHide: true });
    if (!result.error && result.status === 0 && result.stdout?.trim() === "True") return { command, prefix };
  }
  throw new Error("Antigravity Fixer requires Python 3.10+. Install Python, then run miawrouter antigravity-fixer setup.");
}

function ensureAntigravityFixerRuntime({ silent = false, runtimeRoot = getRuntimeDir() } = {}) {
  const runtimeDir = path.join(runtimeRoot, "antigravity-fixer", metadata.revision);
  const venvDir = path.join(runtimeDir, ".venv");
  const python = path.join(venvDir, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  if (!fs.existsSync(python)) {
    const interpreter = findPython();
    fs.mkdirSync(runtimeDir, { recursive: true });
    if (!silent) console.log("[miawrouter] Preparing the bundled Antigravity Fixer...");
    runChecked(interpreter.command, [...interpreter.prefix, "-m", "venv", venvDir], { timeout: 60000 });
  }
  const ready = spawnSync(python, ["-c", DEPENDENCY_PROBE], { encoding: "utf8", timeout: 15000, windowsHide: true });
  if (ready.error || ready.status !== 0) {
    if (!silent) console.log("[miawrouter] Installing Antigravity Fixer Python dependencies...");
    runChecked(python, ["-m", "pip", "install", "--disable-pip-version-check", "--retries", "2", "--timeout", "30", "-r", path.join(SOURCE_DIR, "requirements.txt")], { timeout: INSTALL_TIMEOUT_MS, stdio: "inherit" });
    runChecked(python, ["-c", DEPENDENCY_PROBE], { timeout: 15000 });
  }
  return { python, sourceDir: SOURCE_DIR };
}

function parseFixerArgs(args) {
  const [action = "help", ...flags] = args;
  if (action === "help" || action === "--help" || action === "-h") return { action: "help" };
  if (!["setup", "clean", "interactive"].includes(action)) throw new Error("Use: setup, clean, or interactive.");
  if (flags.some((flag) => flag !== "--confirm-clean")) throw new Error("Unknown option. Use --confirm-clean to authorize cleanup.");
  if (action !== "setup" && !flags.includes("--confirm-clean")) {
    throw new Error("The fixer stops Antigravity and deletes matching Antigravity/Gemini credentials, local data, cache, settings, and extensions. Back up first, then add --confirm-clean only if you intend to continue.");
  }
  return { action, pythonArgs: action === "clean" ? ["--clean-only", "--lang", "en"] : ["--lang", "en"] };
}

async function runAntigravityFixer(args) {
  const { action, pythonArgs } = parseFixerArgs(args);
  if (action === "help") {
    console.log(`Bundled Antigravity Fixer (Python 3.10+, English by default)

Purpose: recover stale local Antigravity sessions and guide account recovery.
It cannot grant Google eligibility, bypass validation, or restore quota.

  miawrouter antigravity-fixer setup
      Prepare dependencies only. No cleanup or Google login.
  miawrouter antigravity-fixer clean --confirm-clean
      Delete matching local credentials and CLI/IDE data, cache, settings,
      and extensions. Back up first. Not a universal fix for login errors.
  miawrouter antigravity-fixer interactive --confirm-clean
      Run the upstream workflow, including destructive cleanup and Google
      credential prompts in this terminal. Prefer official OAuth first.

Choose recovery by the error:
  Antigravity "not eligible": check the account and service requirements,
      reconnect with OAuth, then test and retry onboarding.
  Gemini Code Assist "not eligible": check account/location requirements
      and service access; unresolved provisioning issues need Google support.
  403 VALIDATION_REQUIRED: complete the check Google requests for the same
      account, then reconnect. Local cleanup cannot bypass verification.
  Expired/revoked token: reconnect with OAuth before deleting local data.
  Generic 403: inspect full error details; do not assume age verification.

Installation never runs cleanup. Clean and interactive require explicit
--confirm-clean. Run on the computer where Antigravity is installed.
The dashboard provides error-specific guidance and official Google links.`);
    return 0;
  }
  const runtime = ensureAntigravityFixerRuntime();
  if (action === "setup") {
    console.log("[miawrouter] Antigravity Fixer is ready.");
    return 0;
  }
  // Interactive upstream may fetch its browser on first use, never on install.
  if (action === "interactive") runChecked(runtime.python, ["-m", "camoufox", "fetch"], { timeout: INSTALL_TIMEOUT_MS });
  return new Promise((resolve, reject) => {
    const child = spawn(runtime.python, [path.join(runtime.sourceDir, "fix.py"), ...pythonArgs], { cwd: runtime.sourceDir, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}

module.exports = { findPython, parseFixerArgs, ensureAntigravityFixerRuntime, runAntigravityFixer };

