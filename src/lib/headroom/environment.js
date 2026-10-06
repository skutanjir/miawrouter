import os from "node:os";
import path from "node:path";
import { execFileSync } from "child_process";
import { DATA_DIR } from "@/lib/dataDir.js";

export const HEADROOM_DIR = path.join(DATA_DIR, "headroom");
export const HEADROOM_VENV = path.join(HEADROOM_DIR, ".venv");
export const HEADROOM_PYTHON = path.join(HEADROOM_VENV, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
export const HEADROOM_BINARY = path.join(HEADROOM_VENV, process.platform === "win32" ? "Scripts/headroom.exe" : "bin/headroom");
export const PACKAGE_METADATA_PROBE = "import importlib.metadata as m,json; print(json.dumps([{'name':d.metadata['Name'],'version':d.version} for d in m.distributions()]))";
export const HEADROOM_SETUP_TIMEOUT_MS = 45 * 60 * 1000;

export function findUv({ run = execFileSync } = {}) {
  const name = process.platform === "win32" ? "uv.exe" : "uv";
  for (const command of ["uv", path.join(os.homedir(), ".local", "bin", name), path.join(os.homedir(), ".cargo", "bin", name)]) {
    try { run(command, ["--version"], { timeout: 3000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }); return command; } catch { /* try next location */ }
  }
  return null;
}

export function hasPip(python, { run = execFileSync } = {}) {
  if (!python?.command) return false;
  try { run(python.command, [...python.args, "-m", "pip", "--version"], { timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }); return true; } catch { return false; }
}

export function chooseInstaller(preference, { uv, pip }) {
  if (!["auto", "uv", "pip"].includes(preference)) throw Object.assign(new Error("Installer must be auto, uv, or pip"), { code: "INVALID_INSTALLER" });
  if (preference !== "pip" && uv) return "uv";
  if (preference !== "uv" && pip) return "pip";
  throw Object.assign(new Error(preference === "uv" ? "uv was not found. Install uv or select pip." : "No supported installer found. Install uv, or Python 3.10+ with pip and venv, then recheck."), { code: "NO_INSTALLER" });
}
