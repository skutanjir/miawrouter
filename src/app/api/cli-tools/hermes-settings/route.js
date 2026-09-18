"use server";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
// YAML block builders/upserts are shared with the subagent automator.
import {
  HERMES_PROVIDER_KEY as PROVIDER_KEY,
  buildHermesModelBlock as buildModelBlock,
  buildHermesSubagentBlock as buildSubagentBlock,
  buildHermesProviderBlock as buildProviderBlock,
  upsertHermesProviderBlock as upsertProviderBlock,
  removeHermesProviderBlock as removeProviderBlock,
  upsertHermesModelBlock as upsertModelBlock,
  upsertHermesSubagentBlock as upsertSubagentBlock,
  removeHermesModelBlocks as removeModelBlock,
  parseHermesModelBlock as parseModelBlock,
  parseHermesSubagentBlock as parseSubagentBlock,
} from "@/lib/hermesConfig";

const execAsync = promisify(exec);

const PROVIDER_NAME = "MiawRouter";
const API_KEY_ENV = "OPENAI_API_KEY";

const getHermesDir = () => path.join(os.homedir(), ".hermes");
const getHermesConfigPath = () => path.join(getHermesDir(), "config.yaml");
const getHermesEnvPath = () => path.join(getHermesDir(), ".env");
const getHermesDesktopJsonPath = () => path.join(getHermesDir(), "desktop.json");

const getHermesDesktopConfigDir = () => {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Hermes Desktop");
  }
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Hermes Desktop");
  }
  return path.join(home, ".config", "hermes-desktop");
};

const getHermesDesktopConfigPath = () => path.join(getHermesDesktopConfigDir(), "config.json");

// .env helpers — upsert/remove single KEY=VALUE line
const upsertEnvVar = (envText, key, value) => {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(envText)) return envText.replace(re, line);
  return envText.length > 0 && !envText.endsWith("\n") ? `${envText}\n${line}\n` : `${envText}${line}\n`;
};

// Check if Hermes CLI is installed
const checkHermesCliInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where hermes" : "which hermes";
    await execAsync(command, { windowsHide: true });
    return true;
  } catch {
    try {
      await fs.access(getHermesConfigPath());
      return true;
    } catch {
      return false;
    }
  }
};

// Check if native Hermes Desktop is installed or configured
const checkHermesDesktopInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const cmd = isWindows ? "where hermes-desktop" : "which hermes-desktop";
    await execAsync(cmd, { windowsHide: true });
    return { installed: true, path: "hermes-desktop" };
  } catch {}

  const home = os.homedir();
  const candidates = [
    // Linux
    "/usr/bin/hermes-desktop",
    "/usr/local/bin/hermes-desktop",
    path.join(home, ".local", "bin", "hermes-desktop"),
    "/opt/Hermes Desktop/hermes-desktop",
    path.join(home, ".local", "share", "applications", "hermes-desktop.desktop"),
    // macOS
    "/Applications/Hermes Desktop.app",
    "/Applications/Hermes.app",
    path.join(home, "Applications", "Hermes Desktop.app"),
    // Windows
    path.join(process.env.LOCALAPPDATA || "", "Programs", "hermes-desktop", "Hermes Desktop.exe"),
  ];

  for (const c of candidates) {
    if (fsSync.existsSync(c)) return { installed: true, path: c };
  }

  // Also check if Hermes Desktop config exists
  if (fsSync.existsSync(getHermesDesktopConfigPath()) || fsSync.existsSync(getHermesDesktopJsonPath())) {
    return { installed: true, path: getHermesDesktopConfigPath() };
  }

  return { installed: false, path: null };
};

const readConfigYaml = async () => {
  try {
    return await fs.readFile(getHermesConfigPath(), "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

const readEnvFile = async () => {
  try {
    return await fs.readFile(getHermesEnvPath(), "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

const readDesktopConfig = async () => {
  try {
    const p = getHermesDesktopConfigPath();
    if (fsSync.existsSync(p)) {
      return JSON.parse(await fs.readFile(p, "utf-8"));
    }
  } catch {}
  try {
    const p = getHermesDesktopJsonPath();
    if (fsSync.existsSync(p)) {
      return JSON.parse(await fs.readFile(p, "utf-8"));
    }
  } catch {}
  return null;
};

// Detect MiawRouter by base_url containing localhost/127.0.0.1 or matching tunnel URL
const hasMiawRouterConfig = (modelCfg) => {
  if (!modelCfg?.base_url && !modelCfg?.endpoint && !modelCfg?.baseUrl) return false;
  const url = modelCfg.base_url || modelCfg.endpoint || modelCfg.baseUrl;
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url);
};

export async function GET() {
  try {
    const cliInstalled = await checkHermesCliInstalled();
    const desktopInfo = await checkHermesDesktopInstalled();
    const installed = cliInstalled || desktopInfo.installed;

    if (!installed) {
      return NextResponse.json({
        installed: false,
        cliInstalled: false,
        desktopInstalled: false,
        desktopConfigPath: getHermesDesktopConfigPath(),
        settings: null,
        message: "Hermes Agent & Desktop not detected",
      });
    }

    const yaml = await readConfigYaml();
    const model = parseModelBlock(yaml);
    const subagents = parseSubagentBlock(yaml);
    const desktopConfig = await readDesktopConfig();

    return NextResponse.json({
      installed: true,
      cliInstalled,
      desktopInstalled: desktopInfo.installed,
      desktopPath: desktopInfo.path,
      settings: {
        model,
        subagents,
        desktop: desktopConfig,
      },
      hasMiawRouter: hasMiawRouterConfig(model) || hasMiawRouterConfig(desktopConfig),
      configPath: getHermesConfigPath(),
      desktopConfigPath: getHermesDesktopConfigPath(),
    });
  } catch (error) {
    console.log("Error checking hermes settings:", error);
    return NextResponse.json({ error: "Failed to check hermes settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey, model, subagentModels = {}, syncDesktop = true } = await request.json();
    if (!baseUrl || !model) {
      return NextResponse.json({ error: "baseUrl and model are required" }, { status: 400 });
    }

    const dir = getHermesDir();
    await fs.mkdir(dir, { recursive: true });

    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
    const keyToUse = apiKey || "sk_miawrouter";

    // 1. Update config.yaml — upsert model block, subagents block, and the
    // provider entry the model block points at.
    const existingYaml = await readConfigYaml();
    let newYaml = upsertModelBlock(existingYaml, buildModelBlock(model, normalizedBaseUrl));
    newYaml = upsertSubagentBlock(newYaml, buildSubagentBlock(model, subagentModels));
    newYaml = upsertProviderBlock(newYaml, PROVIDER_KEY, buildProviderBlock(model, normalizedBaseUrl, keyToUse));
    await fs.writeFile(getHermesConfigPath(), newYaml);

    // 2. Update .env — upsert OPENAI_API_KEY
    const existingEnv = await readEnvFile();
    const newEnv = upsertEnvVar(existingEnv, API_KEY_ENV, keyToUse);
    await fs.writeFile(getHermesEnvPath(), newEnv);

    // 3. Write native Hermes Desktop configurations
    const desktopConfig = {
      endpoint: normalizedBaseUrl,
      baseUrl: normalizedBaseUrl,
      apiKey: keyToUse,
      model,
      provider: PROVIDER_KEY,
      nativeDesktop: true,
      subagents: {
        enabled: true,
        default_model: model,
        models: {
          explorer: subagentModels.explorer || model,
          reviewer: subagentModels.reviewer || model,
          planner: subagentModels.planner || model,
          fast: subagentModels.fast || model,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    // Write to ~/.hermes/desktop.json
    await fs.writeFile(getHermesDesktopJsonPath(), JSON.stringify(desktopConfig, null, 2), "utf-8");

    // Write to platform desktop config dir
    if (syncDesktop) {
      try {
        const desktopConfigDir = getHermesDesktopConfigDir();
        await fs.mkdir(desktopConfigDir, { recursive: true });
        await fs.writeFile(getHermesDesktopConfigPath(), JSON.stringify(desktopConfig, null, 2), "utf-8");
      } catch (e) {
        console.log("Could not write platform desktop config:", e?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Hermes Agent & Native Desktop settings applied successfully!",
      configPath: getHermesConfigPath(),
      desktopConfigPath: getHermesDesktopConfigPath(),
    });
  } catch (error) {
    console.log("Error updating hermes settings:", error);
    return NextResponse.json({ error: "Failed to update hermes settings" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const configPath = getHermesConfigPath();
    let yaml = "";
    try {
      yaml = await fs.readFile(configPath, "utf-8");
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({ success: true, message: "No config file to reset" });
      }
      throw error;
    }
    const newYaml = removeProviderBlock(removeModelBlock(yaml), PROVIDER_KEY);
    await fs.writeFile(configPath, newYaml);

    // Clean desktop configs
    try {
      if (fsSync.existsSync(getHermesDesktopJsonPath())) {
        await fs.unlink(getHermesDesktopJsonPath());
      }
      if (fsSync.existsSync(getHermesDesktopConfigPath())) {
        await fs.unlink(getHermesDesktopConfigPath());
      }
    } catch {}

    return NextResponse.json({ success: true, message: `${PROVIDER_NAME} Hermes CLI & Desktop settings removed` });
  } catch (error) {
    console.log("Error resetting hermes settings:", error);
    return NextResponse.json({ error: "Failed to reset hermes settings" }, { status: 500 });
  }
}
