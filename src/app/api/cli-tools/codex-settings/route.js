"use server";

import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { parseTOML, stringifyTOML } from "confbox";

const execAsync = promisify(exec);

const getCodexDir = () => path.join(os.homedir(), ".codex");
const getCodexConfigPath = () => path.join(getCodexDir(), "config.toml");
const getCodexAuthPath = () => path.join(getCodexDir(), "auth.json");

const PROVIDER_KEY = "miawrouter";
const isOurs = (s) => s === PROVIDER_KEY;

// Flatten confbox-parsed TOML into a writable object, preserving nested tables
const parsedToWritable = (obj) => obj ?? {};

// Set a nested key from a flat dotted path, creating intermediate objects as needed
const setNestedSection = (obj, dottedKey, value) => {
  const keys = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== "object") {
      cur[keys[i]] = {};
    }
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
};

// Delete a nested key from a flat dotted path
const deleteNestedSection = (obj, dottedKey) => {
  const keys = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    cur = cur?.[keys[i]];
    if (cur == null) return;
  }
  delete cur[keys[keys.length - 1]];
};

// Check if codex CLI is installed (via which/where or config file exists)
const checkCodexInstalled = async () => {
  try {
    const isWindows = os.platform() === "win32";
    const command = isWindows ? "where codex" : "which codex";
    const env = isWindows
      ? { ...process.env, PATH: `${process.env.APPDATA}\\npm;${process.env.PATH}` }
      : process.env;
    await execAsync(command, { windowsHide: true, env });
    return true;
  } catch {
    try {
      await fs.access(getCodexConfigPath());
      return true;
    } catch {
      return false;
    }
  }
};

// Read current config.toml
const readConfig = async () => {
  try {
    const configPath = getCodexConfigPath();
    const content = await fs.readFile(configPath, "utf-8");
    return content;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
};

// Check if config has MiawRouter settings
const hasMiawRouterConfig = (config) => {
  if (!config) return false;
  return config.includes(`model_provider = "${PROVIDER_KEY}"`)
    || config.includes(`[model_providers.${PROVIDER_KEY}]`);
};

// GET - Check codex CLI and read current settings
export async function GET() {
  try {
    const isInstalled = await checkCodexInstalled();
    
    if (!isInstalled) {
      return NextResponse.json({
        installed: false,
        config: null,
        message: "Codex CLI is not installed",
      });
    }

    const config = await readConfig();
    let subagents = { explorer: "", reviewer: "", planner: "", fast: "" };
    try {
      if (config) {
        const parsed = parseTOML(config);
        subagents = {
          explorer: parsed?.agents?.explorer?.model || parsed?.agents?.subagent?.model || "",
          reviewer: parsed?.agents?.reviewer?.model || "",
          planner: parsed?.agents?.planner?.model || "",
          fast: parsed?.agents?.fast?.model || "",
        };
      }
    } catch {}

    return NextResponse.json({
      installed: true,
      config,
      subagents,
      hasMiawRouter: hasMiawRouterConfig(config),
      configPath: getCodexConfigPath(),
    });
  } catch (error) {
    console.log("Error checking codex settings:", error);
    return NextResponse.json({ error: "Failed to check codex settings" }, { status: 500 });
  }
}

// POST - Update MiawRouter settings (merge with existing config)
export async function POST(request) {
  try {
    const { baseUrl, apiKey, model, subagentModel, subagents } = await request.json();
    
    if (!baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: "baseUrl, apiKey and model are required" }, { status: 400 });
    }

    const codexDir = getCodexDir();
    const configPath = getCodexConfigPath();

    // Ensure directory exists
    await fs.mkdir(codexDir, { recursive: true });

    // Read and parse existing config
    let parsed = {};
    try {
      const existingConfig = await fs.readFile(configPath, "utf-8");
      parsed = parsedToWritable(parseTOML(existingConfig));
    } catch { /* No existing config */ }

    // Update only MiawRouter related fields (api_key goes to auth.json, not config.toml)
    parsed.model = model;
    parsed.model_provider = PROVIDER_KEY;

    // Update or create miawrouter provider section (no api_key - Codex reads from auth.json)
    // Ensure /v1 suffix is added only once
    const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
    setNestedSection(parsed, `model_providers.${PROVIDER_KEY}`, {
      name: "MiawRouter",
      base_url: normalizedBaseUrl,
      wire_api: "responses",
      http_headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // Add subagent configuration
    const effectiveRoles = {
      explorer: subagents?.explorer || subagentModel || model,
      reviewer: subagents?.reviewer || model,
      planner: subagents?.planner || model,
      fast: subagents?.fast || subagentModel || model,
    };
    setNestedSection(parsed, "agents.explorer", {
      description: "Fast explorer subagent for codebase exploration",
      model: effectiveRoles.explorer,
    });
    setNestedSection(parsed, "agents.reviewer", {
      description: "Reviewer & auditor for adversarial review and verification",
      model: effectiveRoles.reviewer,
    });
    setNestedSection(parsed, "agents.planner", {
      description: "Architectural planner for task decomposition",
      model: effectiveRoles.planner,
    });
    setNestedSection(parsed, "agents.fast", {
      description: "Fast helper subagent for low-latency edits and diffs",
      model: effectiveRoles.fast,
    });
    setNestedSection(parsed, "agents.subagent", {
      description: "Default fallback subagent",
      model: effectiveRoles.fast || effectiveRoles.explorer,
    });

    // Write merged config
    const configContent = stringifyTOML(parsed);
    await fs.writeFile(configPath, configContent);

    // Update auth.json with OPENAI_API_KEY (Codex reads this first)
    const authPath = getCodexAuthPath();
    let authData = {};
    try {
      const existingAuth = await fs.readFile(authPath, "utf-8");
      authData = JSON.parse(existingAuth);
    } catch { /* No existing auth */ }
    
    // Force apikey mode (keep existing tokens untouched for ChatGPT login reuse)
    authData.OPENAI_API_KEY = apiKey;
    authData.auth_mode = "apikey";
    await fs.writeFile(authPath, JSON.stringify(authData, null, 2));

    // Ensure active model metadata exists in models_cache.json to avoid missing metadata warnings
    try {
      const modelsCachePath = path.join(codexDir, "models_cache.json");
      let cacheData = { fetched_at: new Date().toISOString(), client_version: "0.153.4", models: [] };
      try {
        const rawCache = await fs.readFile(modelsCachePath, "utf-8");
        cacheData = JSON.parse(rawCache);
      } catch { /* create new cache */ }

      if (Array.isArray(cacheData.models)) {
        const exists = cacheData.models.some((m) => m.slug === model || m.id === model);
        if (!exists) {
          cacheData.models.push({
            slug: model,
            display_name: model,
            description: `Model ${model} via MiawRouter`,
            default_reasoning_level: "medium",
            supported_reasoning_levels: [
              { effort: "low", description: "Fast responses with lighter reasoning" },
              { effort: "medium", description: "Balances speed and reasoning depth for everyday tasks" },
              { effort: "high", description: "Greater reasoning depth for complex problems" },
              { effort: "xhigh", description: "Extra high reasoning depth for complex problems" },
              { effort: "max", description: "Maximum reasoning depth for the hardest problems" },
              { effort: "ultra", description: "Maximum reasoning with automatic task delegation" },
            ],
            shell_type: "bash",
            visibility: "public",
            supported_in_api: true,
            priority: 1,
            additional_speed_tiers: [],
            service_tiers: [],
            availability_nux: null,
            upgrade: null,
            model_messages: null,
            include_skills_usage_instructions: true,
            include_plugin_usage_instructions: true,
            include_apps_usage_instructions: true,
            default_reasoning_summary: "none",
            support_verbosity: true,
            default_verbosity: "low",
            apply_patch_tool_type: "freeform",
            web_search_tool_type: "text_and_image",
            truncation_policy: { mode: "tokens", limit: 10000 },
            supports_image_detail_original: true,
            context_window: 1048576,
            max_context_window: 1048576,
            comp_hash: "3000",
            effective_context_window_percent: 95,
            experimental_supported_tools: ["send_user_message_async", "clock"],
            input_modalities: ["text", "image"],
            supports_search_tool: true,
            use_responses_lite: true,
            node_repl_auto_review_required: true,
            node_repl_disabled: false,
            tool_mode: "code_mode_only",
            multi_agent_version: "v2",
            multi_agent_reasoning_effort: "medium",
          });
          await fs.writeFile(modelsCachePath, JSON.stringify(cacheData, null, 2));
        }
      }
    } catch { /* non-fatal cache update failure */ }

    return NextResponse.json({
      success: true,
      message: "Codex settings applied successfully!",
      configPath,
    });
  } catch (error) {
    console.log("Error updating codex settings:", error);
    return NextResponse.json({ error: "Failed to update codex settings" }, { status: 500 });
  }
}

// DELETE - Remove MiawRouter settings only (keep other settings)
export async function DELETE() {
  try {
    const configPath = getCodexConfigPath();

    // Read and parse existing config
    let parsed = {};
    try {
      const existingConfig = await fs.readFile(configPath, "utf-8");
      parsed = parsedToWritable(parseTOML(existingConfig));
    } catch (error) {
      if (error.code === "ENOENT") {
        return NextResponse.json({
          success: true,
          message: "No config file to reset",
        });
      }
      throw error;
    }

    // Remove MiawRouter root fields only if they point at our provider.
    if (isOurs(parsed.model_provider)) {
      delete parsed.model;
      delete parsed.model_provider;
    }

    // Remove the miawrouter provider section
    deleteNestedSection(parsed, `model_providers.${PROVIDER_KEY}`);

    // Remove subagent configuration
    deleteNestedSection(parsed, "agents.subagent");

    // Write updated config
    const configContent = stringifyTOML(parsed);
    await fs.writeFile(configPath, configContent);

    // Remove OPENAI_API_KEY from auth.json
    const authPath = getCodexAuthPath();
    try {
      const existingAuth = await fs.readFile(authPath, "utf-8");
      const authData = JSON.parse(existingAuth);
      delete authData.OPENAI_API_KEY;
      delete authData.auth_mode;

      // Write back or delete if empty
      if (Object.keys(authData).length === 0) {
        await fs.unlink(authPath);
      } else {
        await fs.writeFile(authPath, JSON.stringify(authData, null, 2));
      }
    } catch { /* No auth file */ }

    return NextResponse.json({
      success: true,
      message: "MiawRouter settings removed successfully",
    });
  } catch (error) {
    console.log("Error resetting codex settings:", error);
    return NextResponse.json({ error: "Failed to reset codex settings" }, { status: 500 });
  }
}
