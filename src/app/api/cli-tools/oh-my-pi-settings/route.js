"use server";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildOhMyPiProvider, mergeOhMyPiModels } from "./config";

const execAsync = promisify(exec);
const getConfigDir = () => process.env.PI_CODING_AGENT_DIR || path.join(os.homedir(), ".omp", "agent");
const getPreferredConfigPath = () => path.join(getConfigDir(), "models.yml");

const resolveConfigPath = async () => {
  const ymlPath = getPreferredConfigPath();
  try {
    await fs.access(ymlPath);
    return ymlPath;
  } catch {
    const yamlPath = path.join(getConfigDir(), "models.yaml");
    try {
      await fs.access(yamlPath);
      return yamlPath;
    } catch {
      return ymlPath;
    }
  }
};

const checkOhMyPiInstalled = async () => {
  try {
    const command = os.platform() === "win32" ? "where omp" : "which omp";
    const { stdout } = await execAsync(command, { windowsHide: true });
    return { installed: true, source: stdout.trim().split(/\r?\n/)[0] || "PATH" };
  } catch {
    return { installed: false, source: null };
  }
};

const readConfig = async (configPath) => {
  try {
    return await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
};

const inspectConfig = (content) => {
  const lines = String(content || "").replace(/\r\n/g, "\n").split("\n");
  const providerStart = lines.findIndex((line) => /^  miawrouter:\s*$/.test(line));
  if (providerStart === -1) return { configured: false, baseUrl: null, model: null };
  let providerEnd = lines.length;
  for (let i = providerStart + 1; i < lines.length; i += 1) {
    if (/^  [A-Za-z0-9_-]+\s*:/.test(lines[i]) || /^\S/.test(lines[i])) {
      providerEnd = i;
      break;
    }
  }
  const provider = lines.slice(providerStart + 1, providerEnd).join("\n");
  const baseUrl = provider.match(/^\s+baseUrl:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim() || null;
  const model = provider.match(/^\s+- id:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim() || null;
  return { configured: Boolean(baseUrl && model), baseUrl, model };
};

const normalizeBaseUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return null;
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) return null;
  return url.replace(/\/+$/, "").endsWith("/v1") ? url.replace(/\/+$/, "") : `${url.replace(/\/+$/, "")}/v1`;
};

export async function GET() {
  try {
    const [{ installed, source }, configPath] = await Promise.all([
      checkOhMyPiInstalled(),
      resolveConfigPath(),
    ]);
    const content = await readConfig(configPath);
    const config = inspectConfig(content);
    return NextResponse.json({
      installed,
      source,
      configExists: Boolean(content),
      configPath,
      has9Router: config.configured,
      ...config,
    });
  } catch (error) {
    console.log("Error checking Oh My Pi settings:", error);
    return NextResponse.json({ error: "Failed to check Oh My Pi settings" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    let baseUrl;
    try {
      baseUrl = normalizeBaseUrl(body?.baseUrl);
    } catch {
      baseUrl = null;
    }
    const model = String(body?.model || "").trim();
    const apiKey = String(body?.apiKey || "sk_miawrouter").trim();

    if (!baseUrl || !model || /[\r\n]/.test(model) || /[\r\n]/.test(apiKey)) {
      return NextResponse.json({ error: "A valid baseUrl and model are required" }, { status: 400 });
    }

    const configPath = await resolveConfigPath();
    const existing = await readConfig(configPath);
    const provider = buildOhMyPiProvider(baseUrl, apiKey, model);

    await fs.mkdir(getConfigDir(), { recursive: true });
    const backupPath = existing ? `${configPath}.bak` : null;
    if (backupPath) {
      try {
        await fs.access(backupPath);
      } catch {
        await fs.copyFile(configPath, backupPath);
      }
    }
    await fs.writeFile(configPath, mergeOhMyPiModels(existing, provider), { mode: 0o600 });
    await fs.chmod(configPath, 0o600);

    return NextResponse.json({
      success: true,
      message: "Oh My Pi settings applied successfully",
      configPath,
      backupPath,
      has9Router: true,
    });
  } catch (error) {
    console.log("Error applying Oh My Pi settings:", error);
    return NextResponse.json({ error: "Failed to apply Oh My Pi settings" }, { status: 500 });
  }
}
