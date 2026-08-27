// Hermes Agentic Autonomy System for MiawRouter
// Inspired by Nous Hermes 3 reasoning & tool-use architectures.
// Provides autonomous cross-session self-evolution:
//  - Memory synthesis & persistence
//  - Dynamic Agent Skill creation (open SKILL.md format)
//  - Autonomous Subagent spawning & persona persistence
//  - Automatic LSP workspace detection & configuration
//  - MCP / Plugin management
//
// Fail-open by design: all functions return structured results and never crash the process.

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { createMemory, searchMemories, listMemories, deleteMemory } from "@/lib/db/index.js";

const USER_ID = "default";

function getGlobalSkillsDir() {
  const home = os.homedir();
  // Check known agent skill directories
  const candidates = [
    path.join(home, ".config", "miawcode", "skills"),
    path.join(home, ".agents", "skills"),
    path.join(home, ".claude", "skills"),
  ];
  for (const c of candidates) {
    if (fsSync.existsSync(c)) return c;
  }
  return path.join(home, ".config", "miawcode", "skills");
}

function getGlobalAgentsDir() {
  const home = os.homedir();
  const candidates = [
    path.join(home, ".config", "miawcode", "agents"),
    path.join(home, ".agents"),
  ];
  for (const c of candidates) {
    if (fsSync.existsSync(c)) return c;
  }
  return path.join(home, ".config", "miawcode", "agents");
}

/**
 * Persist structured long-term memory across all workspaces.
 */
export async function saveHermesMemory({ key, value, scope = "global", tags = [] }) {
  try {
    const content = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value || "");
    const formattedContent = key ? `[${key}] ${content}` : content;

    const memory = await createMemory({
      userId: USER_ID,
      sessionId: scope === "global" ? "global" : (scope || ""),
      content: formattedContent,
      metadata: {
        key: key || null,
        scope,
        tags: Array.isArray(tags) ? tags : [tags],
        source: "hermes-autonomy",
        updatedAt: Date.now(),
      },
    });

    return { ok: true, memory };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

/**
 * Autonomously create a new Agent Skill in standard SKILL.md format.
 */
export async function createHermesSkill({ name, description = "", content = "", scope = "global", workspaceRoot = process.cwd() }) {
  try {
    if (!name) return { ok: false, error: "Skill name is required" };
    const cleanName = String(name).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!cleanName) return { ok: false, error: "Invalid skill name" };

    const baseDir = scope === "project"
      ? path.join(workspaceRoot, ".miawcode", "skills", cleanName)
      : path.join(getGlobalSkillsDir(), cleanName);

    await fs.mkdir(baseDir, { recursive: true });
    const skillPath = path.join(baseDir, "SKILL.md");

    // Format valid standard SKILL.md with frontmatter
    let fullContent = content.trim();
    if (!fullContent.startsWith("---")) {
      const frontmatter = [
        "---",
        `name: ${cleanName}`,
        `description: "${(description || cleanName).replace(/"/g, '\\"')}"`,
        "---",
        "",
      ].join("\n");
      fullContent = `${frontmatter}# ${cleanName}\n\n${fullContent}`;
    }

    await fs.writeFile(skillPath, fullContent, "utf8");

    return {
      ok: true,
      skill: {
        name: cleanName,
        path: skillPath,
        scope,
        description: description || cleanName,
      },
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

/**
 * Autonomously spawn or persist a specialized domain subagent.
 */
export async function createHermesSubagent({ name, description, prompt, model = null, temperature = null, scope = "global", workspaceRoot = process.cwd() }) {
  try {
    if (!name) return { ok: false, error: "Subagent name is required" };
    const cleanName = String(name).toLowerCase().replace(/[^a-z0-9_-]+/g, "-");

    const baseDir = scope === "project"
      ? path.join(workspaceRoot, ".miawcode", "agents")
      : getGlobalAgentsDir();

    await fs.mkdir(baseDir, { recursive: true });
    const agentPath = path.join(baseDir, `${cleanName}.md`);

    const agentDoc = [
      "---",
      `name: ${cleanName}`,
      `description: "${(description || cleanName).replace(/"/g, '\\"')}"`,
      model ? `model: ${model}` : null,
      temperature !== null && temperature !== undefined ? `temperature: ${temperature}` : null,
      "---",
      "",
      `# ${cleanName}`,
      "",
      prompt.trim(),
    ].filter(Boolean).join("\n");

    await fs.writeFile(agentPath, agentDoc, "utf8");

    return {
      ok: true,
      subagent: {
        name: cleanName,
        path: agentPath,
        scope,
        model,
        description,
      },
    };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

/**
 * Detect language environments and recommend LSP bindings.
 */
export function detectWorkspaceLsp(workspaceRoot = process.cwd()) {
  const detected = [];

  const checks = [
    { id: "typescript", server: "typescript-language-server", files: ["tsconfig.json", "package.json", "jsconfig.json"] },
    { id: "python", server: "pyright", files: ["requirements.txt", "pyproject.toml", "setup.py", "Pipfile"] },
    { id: "rust", server: "rust-analyzer", files: ["Cargo.toml"] },
    { id: "go", server: "gopls", files: ["go.mod"] },
    { id: "php", server: "intelephense", files: ["composer.json"] },
  ];

  for (const check of checks) {
    const found = check.files.some((f) => fsSync.existsSync(path.join(workspaceRoot, f)));
    if (found) {
      detected.push({
        language: check.id,
        lspServer: check.server,
        status: "detected",
      });
    }
  }

  return detected;
}

/**
 * Get comprehensive overview of active Hermes autonomy state.
 */
export async function getHermesAutonomyOverview(workspaceRoot = process.cwd()) {
  const lsp = detectWorkspaceLsp(workspaceRoot);
  let memoryCount = 0;
  try {
    const list = await listMemories({ userId: USER_ID, limit: 100 });
    memoryCount = list.length;
  } catch { /* ignore */ }

  return {
    ok: true,
    agent: "Hermes King Miaw",
    status: "active",
    lsp,
    memoryCount,
    capabilities: [
      "autonomous_memory_synthesis",
      "dynamic_skill_creation",
      "subagent_spawning",
      "lsp_workspace_detection",
      "mcp_plugin_management",
      "anti_slop_gate",
    ],
  };
}
