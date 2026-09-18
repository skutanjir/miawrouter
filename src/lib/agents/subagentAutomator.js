// Subagent Automator for MiawRouter
// Automatically inspects active providers and models, classifies optimal subagent archetypes,
// and configures subagent swarms across all installed CLI and Desktop tools.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { parseTOML, stringifyTOML } from "confbox";
import { applyGrokBuildConfig } from "@/lib/grokBuildConfig";

const HOME = os.homedir();

// Tool directory & config resolvers
export const TOOL_PATHS = {
  claude: {
    dir: path.join(HOME, ".claude"),
    settings: path.join(HOME, ".claude", "settings.json"),
    agentsDir: path.join(HOME, ".claude", "agents"),
  },
  opencode: {
    dir: path.join(HOME, ".config", "opencode"),
    config: path.join(HOME, ".config", "opencode", "opencode.json"),
  },
  codex: {
    dir: path.join(HOME, ".codex"),
    config: path.join(HOME, ".codex", "config.toml"),
    auth: path.join(HOME, ".codex", "auth.json"),
  },
  hermes: {
    dir: path.join(HOME, ".hermes"),
    config: path.join(HOME, ".hermes", "config.yaml"),
    env: path.join(HOME, ".hermes", ".env"),
    desktopJson: path.join(HOME, ".hermes", "desktop.json"),
    agentsDir: path.join(HOME, ".hermes", "agents"),
    desktopConfigDir: process.platform === "win32"
      ? path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Hermes Desktop")
      : process.platform === "darwin"
      ? path.join(HOME, "Library", "Application Support", "Hermes Desktop")
      : path.join(HOME, ".config", "hermes-desktop"),
  },
  "grok-build": {
    dir: path.join(HOME, ".grok"),
    config: path.join(HOME, ".grok", "config.toml"),
  },
  droid: {
    dir: path.join(HOME, ".factory"),
    settings: path.join(HOME, ".factory", "settings.json"),
  },
  openclaw: {
    dir: path.join(HOME, ".openclaw"),
    settings: path.join(HOME, ".openclaw", "openclaw.json"),
  },
  jcode: {
    dir: path.join(HOME, ".jcode"),
    config: path.join(HOME, ".jcode", "config.toml"),
  },
  "deepseek-tui": {
    dir: path.join(HOME, ".deepseek"),
    config: path.join(HOME, ".deepseek", "config.toml"),
  },
  cline: {
    dir: path.join(HOME, ".cline", "data"),
    config: path.join(HOME, ".cline", "data", "globalState.json"),
  },
  kilo: {
    dir: path.join(HOME, ".local", "share", "kilo"),
    config: path.join(HOME, ".local", "share", "kilo", "auth.json"),
  },
};

/**
 * Check if a file or directory exists synchronously
 */
function fileExists(filePath) {
  try {
    return fsSync.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Detect which CLI tools are installed or configured on this machine
 */
export async function detectInstalledTools() {
  const tools = {};

  // Claude Code
  tools.claude = fileExists(TOOL_PATHS.claude.settings) || fileExists(path.join(HOME, ".claude.json"));

  // OpenCode
  tools.opencode = fileExists(TOOL_PATHS.opencode.config);

  // OpenAI Codex
  tools.codex = fileExists(TOOL_PATHS.codex.config) || fileExists(TOOL_PATHS.codex.auth);

  // Hermes Agent & Desktop
  tools.hermes = fileExists(TOOL_PATHS.hermes.config)
    || fileExists(TOOL_PATHS.hermes.desktopJson)
    || fileExists(path.join(TOOL_PATHS.hermes.desktopConfigDir, "config.json"));

  // Grok Build
  tools["grok-build"] = fileExists(TOOL_PATHS["grok-build"].config);

  // Factory Droid
  tools.droid = fileExists(TOOL_PATHS.droid.settings);

  // Open Claw
  tools.openclaw = fileExists(TOOL_PATHS.openclaw.settings);

  // jcode
  tools.jcode = fileExists(TOOL_PATHS.jcode.config) || fileExists(path.join(HOME, ".config", "jcode", "provider-miawrouter.env"));

  // DeepSeek TUI
  tools["deepseek-tui"] = fileExists(TOOL_PATHS["deepseek-tui"].config);

  // Cline
  tools.cline = fileExists(TOOL_PATHS.cline.config);

  // Kilo Code
  tools.kilo = fileExists(TOOL_PATHS.kilo.config);

  return tools;
}

/**
 * Priority regexes for role archetype matching
 */
const ROLE_PATTERNS = {
  explorer: [
    /(gemini[-_]3\.8[-_]flash[-_]high|gemini[-_]3\.8[-_]flash|deepseek[-_]v4\.1[-_]flash[-_]high|deepseek[-_]v4\.1[-_]flash|deepseek[-_]flash|qwen3\.8[-_]flash|gpt[-_]5\.4[-_]mini|claude[-_]haiku[-_]4[-_]5|gemini[-_]2\.5[-_]flash)/i,
    /(flash|mini|haiku|nano|fast|lite)/i,
  ],
  reviewer: [
    /(claude[-_]sonnet[-_]4[-_]6|claude[-_]opus[-_]4[-_]6|claude[-_]sonnet[-_]4[-_]5|claude[-_]opus[-_]5|gpt[-_]5\.5|deepseek[-_]reasoner|deepseek[-_]v4[-_]pro|kimi[-_]k3[-_]max|glm[-_]5\.2[-_]high|gemini[-_]3\.1[-_]pro[-_]high)/i,
    /(sonnet|opus|reasoner|pro|high|plus|large|max)/i,
  ],
  planner: [
    /(gemini[-_]3\.1[-_]pro[-_]high|gemini[-_]pro[-_]agent|grok[-_]4\.6[-_]xhigh|grok.*plan)/i,
    /(claude[-_]sonnet[-_]4[-_]6|claude[-_]opus|gpt[-_]5\.5|deepseek[-_]v4[-_]pro)/i,
    /(pro|agent|plan|sonnet|opus)/i,
  ],
  fast: [
    /(gemini[-_]3\.8[-_]flash[-_]low|gemini[-_]3\.5[-_]flash[-_]extra[-_]low|deepseek[-_]v4\.1[-_]flash[-_]low|gpt[-_]5\.4[-_]nano|gemini[-_]2\.5[-_]flash)/i,
    /(nano|extra[-_]low|low|flash|haiku)/i,
  ],
  general: [
    /(claude[-_]sonnet[-_]4[-_]6|claude[-_]opus|gpt[-_]5\.5)/i,
    /(gemini[-_]3\.8[-_]flash[-_]high|deepseek[-_]v4\.1[-_]flash)/i,
    /(sonnet|flash|chat)/i,
  ],
};

/**
 * Classify a list of candidate model identifiers into optimal subagent roles.
 */
export function resolveOptimalSubagentRoles(candidateModels = []) {
  const models = Array.isArray(candidateModels)
    ? candidateModels.map((m) => (typeof m === "string" ? m : m?.value || m?.id || "")).filter(Boolean)
    : [];

  const findBestMatch = (patterns, fallbackIndex = 0) => {
    if (models.length === 0) return null;
    for (const pattern of patterns) {
      const match = models.find((m) => pattern.test(m));
      if (match) return match;
    }
    return models[Math.min(fallbackIndex, models.length - 1)];
  };

  const defaultModel = models[0] || "ag/gemini-3.8-flash-high";
  const explorer = findBestMatch(ROLE_PATTERNS.explorer, 0) || defaultModel;
  const reviewer = findBestMatch(ROLE_PATTERNS.reviewer, models.length > 1 ? 1 : 0) || defaultModel;
  const planner = findBestMatch(ROLE_PATTERNS.planner, models.length > 2 ? 2 : 0) || reviewer;
  const fast = findBestMatch(ROLE_PATTERNS.fast, 0) || explorer;
  const general = findBestMatch(ROLE_PATTERNS.general, 0) || defaultModel;

  return {
    explorer,
    reviewer,
    planner,
    fast,
    general,
  };
}

/**
 * Configure Claude Code subagent Markdown definitions in ~/.claude/agents/
 */
export async function configureClaudeSubagents({ roles }) {
  const agentsDir = TOOL_PATHS.claude.agentsDir;
  await fs.mkdir(agentsDir, { recursive: true });

  const agents = [
    {
      filename: "explorer.md",
      name: "explorer",
      description: "Fast codebase explorer and symbol searcher",
      model: roles.explorer,
      systemPrompt: "You are a specialized codebase exploration subagent. Search directories, find symbols, outline modules, and report concise structural summaries without editing code.",
    },
    {
      filename: "reviewer.md",
      name: "reviewer",
      description: "Senior adversarial code reviewer and security auditor",
      model: roles.reviewer,
      systemPrompt: "You are an adversarial senior code reviewer subagent. Audit code for security vulnerabilities, OWASP risks, logic flaws, architectural boundaries, edge cases, and test coverage.",
    },
    {
      filename: "planner.md",
      name: "planner",
      description: "Architectural planner and task decomposition subagent",
      model: roles.planner,
      systemPrompt: "You are an architecture and task planning subagent. Break down complex requirements into atomic, verifiable, and regression-safe implementation steps.",
    },
    {
      filename: "fast.md",
      name: "fast",
      description: "Ultra-fast helper for rapid single-turn queries and diffs",
      model: roles.fast,
      systemPrompt: "You are an ultra-fast helper subagent. Deliver immediate, high-accuracy answers, diff snippets, and lint fixes with zero fluff.",
    },
  ];

  const writtenFiles = [];
  for (const agent of agents) {
    const filePath = path.join(agentsDir, agent.filename);
    const content = [
      "---",
      `name: ${agent.name}`,
      `description: "${agent.description}"`,
      `model: "${agent.model}"`,
      "---",
      "",
      `# ${agent.name}`,
      "",
      agent.systemPrompt,
    ].join("\n");

    await fs.writeFile(filePath, content, "utf8");
    writtenFiles.push(filePath);
  }

  return { ok: true, tool: "claude", writtenFiles };
}

/**
 * Configure OpenCode subagents in ~/.config/opencode/opencode.json
 */
export async function configureOpenCodeSubagents({ baseUrl, apiKey, roles }) {
  const configPath = TOOL_PATHS.opencode.config;
  const configDir = TOOL_PATHS.opencode.dir;
  await fs.mkdir(configDir, { recursive: true });

  let config = {};
  try {
    const raw = await fs.readFile(configPath, "utf8");
    config = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    config = {};
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";

  if (!config.provider) config.provider = {};
  const provider = config.provider.miawrouter || { npm: "@ai-sdk/openai-compatible", options: {}, models: {} };
  provider.options = { ...provider.options, baseURL: normalizedBaseUrl, apiKey: keyToUse };
  provider.models = provider.models || {};

  // Ensure models are registered in provider models
  const uniqueModels = Array.from(new Set([roles.general, roles.explorer, roles.reviewer, roles.planner, roles.fast]));
  for (const m of uniqueModels) {
    if (m) provider.models[m] = { name: m, modalities: { input: ["text", "image"], output: ["text"] } };
  }
  config.provider.miawrouter = provider;

  if (!config.agent) config.agent = {};
  config.agent.explorer = {
    description: "Fast codebase explorer subagent",
    mode: "subagent",
    model: `miawrouter/${roles.explorer}`,
  };
  config.agent.reviewer = {
    description: "Code reviewer and security auditor subagent",
    mode: "subagent",
    model: `miawrouter/${roles.reviewer}`,
  };
  config.agent.planner = {
    description: "Architectural planner and task decomposition subagent",
    mode: "subagent",
    model: `miawrouter/${roles.planner}`,
  };
  config.agent.fast = {
    description: "Ultra-fast helper subagent",
    mode: "subagent",
    model: `miawrouter/${roles.fast}`,
  };

  if (!config.model) {
    config.model = `miawrouter/${roles.general}`;
  }

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
  return { ok: true, tool: "opencode", configPath };
}

/**
 * Configure Codex CLI / App subagents in ~/.codex/config.toml
 */
export async function configureCodexSubagents({ baseUrl, apiKey, roles }) {
  const configPath = TOOL_PATHS.codex.config;
  const configDir = TOOL_PATHS.codex.dir;
  await fs.mkdir(configDir, { recursive: true });

  let parsed = {};
  try {
    const raw = await fs.readFile(configPath, "utf8");
    parsed = parseTOML(raw) || {};
  } catch {
    parsed = {};
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

  if (!parsed.model_providers) parsed.model_providers = {};
  parsed.model_providers.miawrouter = {
    name: "MiawRouter",
    base_url: normalizedBaseUrl,
    wire_api: "responses",
    http_headers: {
      Authorization: `Bearer ${apiKey || "sk_miawrouter"}`,
    },
  };

  if (!parsed.model) parsed.model = roles.general;
  parsed.model_provider = "miawrouter";

  if (!parsed.agents) parsed.agents = {};
  parsed.agents.subagent = { description: "General delegated subagent", model: roles.general };
  parsed.agents.explorer = { description: "Fast codebase exploration subagent", model: roles.explorer };
  parsed.agents.reviewer = { description: "Senior code review & security audit subagent", model: roles.reviewer };
  parsed.agents.planner = { description: "Task planning & architecture subagent", model: roles.planner };
  parsed.agents.fast = { description: "Fast single-turn helper subagent", model: roles.fast };

  await fs.writeFile(configPath, stringifyTOML(parsed), "utf8");

  // Update auth.json
  const authPath = TOOL_PATHS.codex.auth;
  let auth = {};
  try {
    auth = JSON.parse(await fs.readFile(authPath, "utf8"));
  } catch {
    auth = {};
  }
  auth.OPENAI_API_KEY = apiKey || "sk_miawrouter";
  auth.auth_mode = "apikey";
  await fs.writeFile(authPath, JSON.stringify(auth, null, 2), "utf8");

  return { ok: true, tool: "codex", configPath };
}

/**
 * Configure Hermes Agent & Hermes Desktop subagents
 */
export async function configureHermesSubagents({ baseUrl, apiKey, roles }) {
  const hermesDir = TOOL_PATHS.hermes.dir;
  const configPath = TOOL_PATHS.hermes.config;
  const envPath = TOOL_PATHS.hermes.env;
  const desktopJsonPath = TOOL_PATHS.hermes.desktopJson;
  const desktopConfigDir = TOOL_PATHS.hermes.desktopConfigDir;

  await fs.mkdir(hermesDir, { recursive: true });
  await fs.mkdir(desktopConfigDir, { recursive: true });

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";

  // 1. Update config.yaml with subagents block
  let existingYaml = "";
  try {
    existingYaml = await fs.readFile(configPath, "utf8");
  } catch {
    existingYaml = "";
  }

  const modelBlock = `model:\n  default: "${roles.general}"\n  provider: "custom"\n  base_url: "${normalizedBaseUrl}"\n`;
  const subagentBlock = `subagents:\n  enabled: true\n  default_model: "${roles.general}"\n  models:\n    explorer: "${roles.explorer}"\n    reviewer: "${roles.reviewer}"\n    planner: "${roles.planner}"\n    fast: "${roles.fast}"\n`;

  let updatedYaml = existingYaml;
  const MODEL_BLOCK_RE = /^model:[ \t]*\r?\n((?:[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m;
  const SUBAGENT_BLOCK_RE = /^subagents:[ \t]*\r?\n((?:[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m;

  if (MODEL_BLOCK_RE.test(updatedYaml)) {
    updatedYaml = updatedYaml.replace(MODEL_BLOCK_RE, modelBlock);
  } else {
    updatedYaml = `${modelBlock}\n${updatedYaml}`;
  }

  if (SUBAGENT_BLOCK_RE.test(updatedYaml)) {
    updatedYaml = updatedYaml.replace(SUBAGENT_BLOCK_RE, subagentBlock);
  } else {
    updatedYaml = `${updatedYaml.trim()}\n\n${subagentBlock}`;
  }

  await fs.writeFile(configPath, updatedYaml.trim() + "\n", "utf8");

  // 2. Update .env
  let existingEnv = "";
  try {
    existingEnv = await fs.readFile(envPath, "utf8");
  } catch {
    existingEnv = "";
  }
  const envKeyRe = /^OPENAI_API_KEY=.*$/m;
  const newEnvLine = `OPENAI_API_KEY=${keyToUse}`;
  const updatedEnv = envKeyRe.test(existingEnv)
    ? existingEnv.replace(envKeyRe, newEnvLine)
    : `${existingEnv.trim()}\n${newEnvLine}\n`;
  await fs.writeFile(envPath, updatedEnv, "utf8");

  // 3. Write Hermes Desktop (Native) config JSON
  const desktopConfig = {
    endpoint: normalizedBaseUrl,
    baseUrl: normalizedBaseUrl,
    apiKey: keyToUse,
    model: roles.general,
    provider: "custom",
    nativeDesktop: true,
    subagents: {
      enabled: true,
      default_model: roles.general,
      models: {
        explorer: roles.explorer,
        reviewer: roles.reviewer,
        planner: roles.planner,
        fast: roles.fast,
      },
    },
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(desktopJsonPath, JSON.stringify(desktopConfig, null, 2), "utf8");
  const platformDesktopConfigFile = path.join(desktopConfigDir, "config.json");
  await fs.writeFile(platformDesktopConfigFile, JSON.stringify(desktopConfig, null, 2), "utf8");

  // 4. Create subagent persona markdown files in ~/.hermes/agents/
  const agentsDir = TOOL_PATHS.hermes.agentsDir;
  await fs.mkdir(agentsDir, { recursive: true });

  const hermesAgents = [
    { name: "explorer", model: roles.explorer, desc: "Fast codebase explorer and navigator" },
    { name: "reviewer", model: roles.reviewer, desc: "Senior code reviewer and security auditor" },
    { name: "planner", model: roles.planner, desc: "Architecture planner and task decomposer" },
  ];

  for (const ag of hermesAgents) {
    const agFile = path.join(agentsDir, `${ag.name}.md`);
    const doc = [
      "---",
      `name: ${ag.name}`,
      `description: "${ag.desc}"`,
      `model: ${ag.model}`,
      "---",
      "",
      `# ${ag.name}`,
      "",
      `You are the specialized ${ag.name} subagent in Hermes Agent & Desktop.`,
    ].join("\n");
    await fs.writeFile(agFile, doc, "utf8");
  }

  return { ok: true, tool: "hermes", configPath, desktopJsonPath, platformDesktopConfigFile };
}

/**
 * Configure Grok Build subagents in ~/.grok/config.toml
 */
export async function configureGrokBuildSubagents({ baseUrl, apiKey, roles }) {
  const configPath = TOOL_PATHS["grok-build"].config;
  const configDir = TOOL_PATHS["grok-build"].dir;
  await fs.mkdir(configDir, { recursive: true });

  let raw = "";
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch {
    raw = "";
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

  const updatedToml = applyGrokBuildConfig(raw, {
    baseUrl: normalizedBaseUrl,
    apiKey: apiKey || "sk_miawrouter",
    model: roles.general,
    subagentModels: {
      explore: roles.explorer,
      plan: roles.planner,
      "general-purpose": roles.general,
    },
  });

  await fs.writeFile(configPath, updatedToml, "utf8");
  return { ok: true, tool: "grok-build", configPath };
}

/**
 * Configure Factory Droid custom subagent models in ~/.factory/settings.json
 */
export async function configureDroidSubagents({ baseUrl, apiKey, roles }) {
  const settingsPath = TOOL_PATHS.droid.settings;
  const droidDir = TOOL_PATHS.droid.dir;
  await fs.mkdir(droidDir, { recursive: true });

  let settings = {};
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  } catch {
    settings = {};
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";

  if (!settings.customModels) settings.customModels = [];
  // Remove existing MiawRouter models
  settings.customModels = settings.customModels.filter(
    (m) => !m?.id?.startsWith("custom:MiawRouter") && !m?.id?.startsWith("custom:MiawRouter")
  );

  const subagentModels = [
    { role: "default", model: roles.general, name: `${roles.general} (General)` },
    { role: "explorer", model: roles.explorer, name: `${roles.explorer} (Explorer Subagent)` },
    { role: "reviewer", model: roles.reviewer, name: `${roles.reviewer} (Reviewer Subagent)` },
    { role: "planner", model: roles.planner, name: `${roles.planner} (Planner Subagent)` },
    { role: "fast", model: roles.fast, name: `${roles.fast} (Fast Helper)` },
  ];

  subagentModels.forEach((item, index) => {
    settings.customModels.push({
      model: item.model,
      id: `custom:MiawRouter-${item.role}`,
      index,
      baseUrl: normalizedBaseUrl,
      apiKey: keyToUse,
      displayName: item.name,
      maxOutputTokens: 131072,
      noImageSupport: false,
      provider: "openai",
    });
  });

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  return { ok: true, tool: "droid", settingsPath };
}

/**
 * Configure OpenClaw subagents in ~/.openclaw/openclaw.json
 */
export async function configureOpenClawSubagents({ baseUrl, apiKey, roles }) {
  const settingsPath = TOOL_PATHS.openclaw.settings;
  const openclawDir = TOOL_PATHS.openclaw.dir;
  await fs.mkdir(openclawDir, { recursive: true });

  let settings = {};
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, "utf8"));
  } catch {
    settings = {};
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";

  if (!settings.models) settings.models = {};
  if (!settings.models.providers) settings.models.providers = {};

  const uniqueModels = Array.from(new Set([roles.general, roles.explorer, roles.reviewer, roles.planner, roles.fast]));
  settings.models.providers.miawrouter = {
    baseUrl: normalizedBaseUrl,
    apiKey: keyToUse,
    api: "openai-completions",
    models: uniqueModels.map((id) => ({ id, name: id.split("/").pop() || id })),
  };

  // Ensure default agent model is general
  if (!settings.agents) settings.agents = {};
  if (!settings.agents.defaults) settings.agents.defaults = {};
  settings.agents.defaults.model = { primary: `miawrouter/${roles.general}` };

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), "utf8");
  return { ok: true, tool: "openclaw", settingsPath };
}

/**
 * Configure jcode subagents in ~/.jcode/config.toml
 */
export async function configureJcodeSubagents({ baseUrl, apiKey, roles }) {
  const configPath = TOOL_PATHS.jcode.config;
  const configDir = TOOL_PATHS.jcode.dir;
  await fs.mkdir(configDir, { recursive: true });

  let config = {};
  try {
    const raw = await fs.readFile(configPath, "utf8");
    config = parseTOML(raw) || {};
  } catch {
    config = {};
  }

  if (!config.providers) config.providers = {};
  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";

  const allModels = Array.from(new Set([roles.general, roles.explorer, roles.reviewer, roles.planner, roles.fast].filter(Boolean)));

  config.providers["miawrouter"] = {
    type: "openai-compatible",
    base_url: normalizedBaseUrl,
    auth: "bearer",
    api_key_env: "JCODE_MIAWROUTER_API_KEY",
    env_file: "provider-miawrouter.env",
    default_model: roles.general,
    requires_api_key: true,
    subagents: {
      explorer: roles.explorer,
      reviewer: roles.reviewer,
      planner: roles.planner,
      fast: roles.fast,
    },
    models: allModels.map((id) => ({ id })),
  };

  await fs.writeFile(configPath, stringifyTOML(config), "utf8");

  const xdgConfigDir = process.env.XDG_CONFIG_HOME || path.join(HOME, ".config");
  const jcodeEnvDir = path.join(xdgConfigDir, "jcode");
  await fs.mkdir(jcodeEnvDir, { recursive: true });
  const envPath = path.join(jcodeEnvDir, "provider-miawrouter.env");
  await fs.writeFile(envPath, `JCODE_MIAWROUTER_API_KEY="${keyToUse}"\n`, "utf8");

  return { ok: true, tool: "jcode", configPath };
}

/**
 * Configure DeepSeek TUI subagents in ~/.deepseek/config.toml
 */
export async function configureDeepSeekTuiSubagents({ baseUrl, apiKey, roles }) {
  const configDir = TOOL_PATHS["deepseek-tui"].dir;
  const configPath = TOOL_PATHS["deepseek-tui"].config;
  await fs.mkdir(configDir, { recursive: true });

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";

  const content = `provider = "openai"

[providers.openai]
base_url = "${normalizedBaseUrl}"
api_key = "${keyToUse}"
model = "${roles.general}"

[subagents]
explorer = "${roles.explorer}"
reviewer = "${roles.reviewer}"
planner = "${roles.planner}"
fast = "${roles.fast}"
`;

  await fs.writeFile(configPath, content, "utf8");
  return { ok: true, tool: "deepseek-tui", configPath };
}

/**
 * Configure Cline subagents in ~/.cline/data/globalState.json
 */
export async function configureClineSubagents({ baseUrl, apiKey, roles }) {
  const dataDir = TOOL_PATHS.cline.dir;
  const globalStatePath = TOOL_PATHS.cline.config;
  const secretsPath = path.join(dataDir, "secrets.json");
  await fs.mkdir(dataDir, { recursive: true });

  let globalState = {};
  try {
    globalState = JSON.parse(await fs.readFile(globalStatePath, "utf8"));
  } catch {
    globalState = {};
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl.slice(0, -3) : baseUrl;
  const keyToUse = apiKey || "sk_miawrouter";

  globalState.actModeApiProvider = "openai";
  globalState.planModeApiProvider = "openai";
  globalState.openAiBaseUrl = normalizedBaseUrl;
  globalState.openAiModelId = roles.general || roles.fast;
  globalState.planModeOpenAiModelId = roles.planner || roles.general;
  globalState.subagentModels = {
    explorer: roles.explorer,
    reviewer: roles.reviewer,
    planner: roles.planner,
    fast: roles.fast,
  };

  await fs.writeFile(globalStatePath, JSON.stringify(globalState, null, 2), "utf8");

  let secrets = {};
  try {
    secrets = JSON.parse(await fs.readFile(secretsPath, "utf8"));
  } catch {
    secrets = {};
  }
  secrets.openAiApiKey = keyToUse;
  await fs.writeFile(secretsPath, JSON.stringify(secrets, null, 2), "utf8");

  return { ok: true, tool: "cline", globalStatePath };
}

/**
 * Configure Kilo Code subagents in ~/.local/share/kilo/auth.json
 */
export async function configureKiloSubagents({ baseUrl, apiKey, roles }) {
  const dataDir = TOOL_PATHS.kilo.dir;
  const authPath = TOOL_PATHS.kilo.config;
  await fs.mkdir(dataDir, { recursive: true });

  let auth = {};
  try {
    auth = JSON.parse(await fs.readFile(authPath, "utf8"));
  } catch {
    auth = {};
  }

  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const keyToUse = apiKey || "sk_miawrouter";
  const allModels = Array.from(new Set([roles.general, roles.explorer, roles.reviewer, roles.planner, roles.fast].filter(Boolean)));

  auth["miawrouter"] = {
    provider: "openai",
    baseUrl: normalizedBaseUrl,
    apiKey: keyToUse,
    defaultModel: roles.general,
    models: allModels,
    subagents: {
      explorer: roles.explorer,
      reviewer: roles.reviewer,
      planner: roles.planner,
      fast: roles.fast,
    },
  };

  await fs.writeFile(authPath, JSON.stringify(auth, null, 2), "utf8");
  return { ok: true, tool: "kilo", authPath };
}

/**
 * Fallback generic subagents persistence for guide or custom tools
 */
export async function configureGenericSubagents({ toolId, baseUrl, apiKey, roles }) {
  const miawDir = path.join(HOME, ".miawrouter", "subagents");
  await fs.mkdir(miawDir, { recursive: true });
  const filePath = path.join(miawDir, `${toolId}.json`);
  const data = {
    toolId,
    baseUrl,
    apiKey,
    roles,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return { ok: true, tool: toolId, filePath };
}

/**
 * Main auto-configuration runner across all installed tools.
 */
export async function autoConfigureAllTools({
  baseUrl = "http://127.0.0.1:21128/v1",
  apiKey = "sk_miawrouter",
  candidateModels = [],
  customRoles = null,
  targetTools = "all",
}) {
  const detected = await detectInstalledTools();
  const roles = customRoles ? { ...resolveOptimalSubagentRoles(candidateModels), ...customRoles } : resolveOptimalSubagentRoles(candidateModels);

  const configured = [];
  const skipped = [];
  const errors = [];

  const toolConfigurators = {
    claude: configureClaudeSubagents,
    opencode: configureOpenCodeSubagents,
    codex: configureCodexSubagents,
    hermes: configureHermesSubagents,
    "grok-build": configureGrokBuildSubagents,
    droid: configureDroidSubagents,
    openclaw: configureOpenClawSubagents,
    jcode: configureJcodeSubagents,
    cline: configureClineSubagents,
    kilo: configureKiloSubagents,
    "deepseek-tui": configureDeepSeekTuiSubagents,
  };

  const requestedTargets = Array.isArray(targetTools)
    ? targetTools
    : targetTools === "all"
    ? Object.keys(toolConfigurators)
    : [targetTools];

  for (const toolId of requestedTargets) {
    const configurator = toolConfigurators[toolId] || ((args) => configureGenericSubagents({ ...args, toolId }));
    const isInstalled = detected[toolId] || targetTools !== "all";
    if (!isInstalled && targetTools === "all") {
      skipped.push(toolId);
      continue;
    }

    try {
      await configurator({ baseUrl, apiKey, roles });
      configured.push(toolId);
    } catch (err) {
      errors.push({ tool: toolId, error: err?.message || String(err) });
    }
  }

  return {
    ok: errors.length === 0,
    configured,
    skipped,
    errors,
    roles,
  };
}
