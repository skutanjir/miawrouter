import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  resolveOptimalSubagentRoles,
  detectInstalledTools,
  autoConfigureAllTools,
  configureClaudeSubagents,
  configureOpenCodeSubagents,
  configureCodexSubagents,
  configureHermesSubagents,
  configureJcodeSubagents,
  configureDeepSeekTuiSubagents,
  TOOL_PATHS,
} from "../../src/lib/agents/subagentAutomator.js";

describe("Subagent Automator & Optimal Role Resolution", () => {
  it("classifies candidate models into optimal roles accurately", () => {
    const candidateModels = [
      "ag/gemini-3.8-flash-high",
      "cc/claude-sonnet-4-6",
      "ag/gemini-3.1-pro-high",
      "ag/gemini-3.8-flash-low",
      "cx/gpt-5.5",
    ];

    const roles = resolveOptimalSubagentRoles(candidateModels);
    expect(roles.explorer).toBe("ag/gemini-3.8-flash-high");
    expect(roles.reviewer).toBe("cc/claude-sonnet-4-6");
    expect(roles.planner).toBe("ag/gemini-3.1-pro-high");
    expect(roles.fast).toBe("ag/gemini-3.8-flash-low");
    expect(roles.general).toBe("cc/claude-sonnet-4-6");
  });

  it("falls back gracefully when candidates are minimal", () => {
    const single = ["custom/my-model"];
    const roles = resolveOptimalSubagentRoles(single);
    expect(roles.explorer).toBe("custom/my-model");
    expect(roles.reviewer).toBe("custom/my-model");
    expect(roles.planner).toBe("custom/my-model");
    expect(roles.fast).toBe("custom/my-model");
    expect(roles.general).toBe("custom/my-model");
  });

  it("detects installed tools without throwing", async () => {
    const tools = await detectInstalledTools();
    expect(typeof tools).toBe("object");
    expect("claude" in tools).toBe(true);
    expect("opencode" in tools).toBe(true);
    expect("codex" in tools).toBe(true);
    expect("hermes" in tools).toBe(true);
  });
});

describe("Tool Subagent Configurations", () => {
  const tmpDir = path.join(os.tmpdir(), "miawrouter-subagent-test-" + Date.now());

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("configures Claude subagents in agents directory", async () => {
    const originalDir = TOOL_PATHS.claude.agentsDir;
    TOOL_PATHS.claude.agentsDir = path.join(tmpDir, "claude-agents");

    try {
      const res = await configureClaudeSubagents({
        roles: {
          explorer: "ag/gemini-3.8-flash-high",
          reviewer: "cc/claude-sonnet-4-6",
          planner: "ag/gemini-3.1-pro-high",
          fast: "ag/gemini-3.8-flash-low",
          general: "cc/claude-sonnet-4-6",
        },
      });

      expect(res.ok).toBe(true);
      const explorerFile = path.join(TOOL_PATHS.claude.agentsDir, "explorer.md");
      const reviewerFile = path.join(TOOL_PATHS.claude.agentsDir, "reviewer.md");

      const explorerContent = await fs.readFile(explorerFile, "utf8");
      expect(explorerContent).toContain('name: explorer');
      expect(explorerContent).toContain('model: "ag/gemini-3.8-flash-high"');

      const reviewerContent = await fs.readFile(reviewerFile, "utf8");
      expect(reviewerContent).toContain('name: reviewer');
      expect(reviewerContent).toContain('model: "cc/claude-sonnet-4-6"');
    } finally {
      TOOL_PATHS.claude.agentsDir = originalDir;
    }
  });

  it("configures OpenCode subagents with miawrouter provider prefix", async () => {
    const origConfig = TOOL_PATHS.opencode.config;
    const origDir = TOOL_PATHS.opencode.dir;
    TOOL_PATHS.opencode.dir = tmpDir;
    TOOL_PATHS.opencode.config = path.join(tmpDir, "opencode.json");

    try {
      const res = await configureOpenCodeSubagents({
        baseUrl: "http://127.0.0.1:21128/v1",
        apiKey: "sk-test-subagents",
        roles: {
          explorer: "ag/gemini-3.8-flash-high",
          reviewer: "cc/claude-sonnet-4-6",
          planner: "ag/gemini-3.1-pro-high",
          fast: "ag/gemini-3.8-flash-low",
          general: "ag/gemini-3.8-flash-high",
        },
      });

      expect(res.ok).toBe(true);
      const content = JSON.parse(await fs.readFile(TOOL_PATHS.opencode.config, "utf8"));
      expect(content.provider.miawrouter.options.baseURL).toBe("http://127.0.0.1:21128/v1");
      expect(content.agent.explorer.model).toBe("miawrouter/ag/gemini-3.8-flash-high");
      expect(content.agent.reviewer.model).toBe("miawrouter/cc/claude-sonnet-4-6");
      expect(content.agent.planner.model).toBe("miawrouter/ag/gemini-3.1-pro-high");
    } finally {
      TOOL_PATHS.opencode.config = origConfig;
      TOOL_PATHS.opencode.dir = origDir;
    }
  });

  it("configures Hermes Agent and Native Desktop subagents", async () => {
    const origDir = TOOL_PATHS.hermes.dir;
    const origConfig = TOOL_PATHS.hermes.config;
    const origEnv = TOOL_PATHS.hermes.env;
    const origDesktopJson = TOOL_PATHS.hermes.desktopJson;
    const origAgentsDir = TOOL_PATHS.hermes.agentsDir;
    const origDesktopConfigDir = TOOL_PATHS.hermes.desktopConfigDir;

    TOOL_PATHS.hermes.dir = tmpDir;
    TOOL_PATHS.hermes.config = path.join(tmpDir, "config.yaml");
    TOOL_PATHS.hermes.env = path.join(tmpDir, ".env");
    TOOL_PATHS.hermes.desktopJson = path.join(tmpDir, "desktop.json");
    TOOL_PATHS.hermes.agentsDir = path.join(tmpDir, "agents");
    TOOL_PATHS.hermes.desktopConfigDir = path.join(tmpDir, "desktop-config");

    try {
      const res = await configureHermesSubagents({
        baseUrl: "http://127.0.0.1:21128/v1",
        apiKey: "sk-hermes-test",
        roles: {
          explorer: "ag/gemini-3.8-flash-high",
          reviewer: "cc/claude-sonnet-4-6",
          planner: "ag/gemini-3.1-pro-high",
          fast: "ag/gemini-3.8-flash-low",
          general: "ag/gemini-3.8-flash-high",
        },
      });

      expect(res.ok).toBe(true);

      // Verify config.yaml
      const yaml = await fs.readFile(TOOL_PATHS.hermes.config, "utf8");
      expect(yaml).toContain("subagents:");
      expect(yaml).toContain('explorer: "ag/gemini-3.8-flash-high"');
      expect(yaml).toContain('reviewer: "cc/claude-sonnet-4-6"');

      // Verify native desktop json
      const desktop = JSON.parse(await fs.readFile(TOOL_PATHS.hermes.desktopJson, "utf8"));
      expect(desktop.nativeDesktop).toBe(true);
      expect(desktop.subagents.models.explorer).toBe("ag/gemini-3.8-flash-high");
      expect(desktop.subagents.models.reviewer).toBe("cc/claude-sonnet-4-6");

      // Verify platform desktop config
      const platformFile = path.join(TOOL_PATHS.hermes.desktopConfigDir, "config.json");
      const platformCfg = JSON.parse(await fs.readFile(platformFile, "utf8"));
      expect(platformCfg.nativeDesktop).toBe(true);
      expect(platformCfg.endpoint).toBe("http://127.0.0.1:21128/v1");
    } finally {
      TOOL_PATHS.hermes.dir = origDir;
      TOOL_PATHS.hermes.config = origConfig;
      TOOL_PATHS.hermes.env = origEnv;
      TOOL_PATHS.hermes.desktopJson = origDesktopJson;
      TOOL_PATHS.hermes.agentsDir = origAgentsDir;
      TOOL_PATHS.hermes.desktopConfigDir = origDesktopConfigDir;
    }
  });

  it("configures jcode subagents with models and env file", async () => {
    const origDir = TOOL_PATHS.jcode.dir;
    const origConfig = TOOL_PATHS.jcode.config;
    TOOL_PATHS.jcode.dir = path.join(tmpDir, "jcode");
    TOOL_PATHS.jcode.config = path.join(tmpDir, "jcode", "config.toml");

    try {
      const res = await configureJcodeSubagents({
        baseUrl: "http://127.0.0.1:21128/v1",
        apiKey: "sk_test_jcode",
        roles: {
          explorer: "ag/gemini-3.8-flash-high",
          reviewer: "cc/claude-sonnet-4-6",
          planner: "ag/gemini-3.1-pro-high",
          fast: "ag/gemini-3.8-flash-low",
          general: "cc/claude-sonnet-4-6",
        },
      });

      expect(res.ok).toBe(true);
      const toml = await fs.readFile(TOOL_PATHS.jcode.config, "utf8");
      expect(toml).toContain("providers.miawrouter");
      expect(toml).toContain("default_model = \"cc/claude-sonnet-4-6\"");
      expect(toml).toContain("explorer = \"ag/gemini-3.8-flash-high\"");
    } finally {
      TOOL_PATHS.jcode.dir = origDir;
      TOOL_PATHS.jcode.config = origConfig;
    }
  });

  it("configures DeepSeek TUI subagents in config.toml", async () => {
    const origDir = TOOL_PATHS["deepseek-tui"].dir;
    const origConfig = TOOL_PATHS["deepseek-tui"].config;
    TOOL_PATHS["deepseek-tui"].dir = path.join(tmpDir, "deepseek");
    TOOL_PATHS["deepseek-tui"].config = path.join(tmpDir, "deepseek", "config.toml");

    try {
      const res = await configureDeepSeekTuiSubagents({
        baseUrl: "http://127.0.0.1:21128/v1",
        apiKey: "sk_test_deepseek",
        roles: {
          explorer: "deepseek/deepseek-v4.1-flash",
          reviewer: "deepseek/deepseek-v4-pro",
          planner: "deepseek/deepseek-reasoner",
          fast: "deepseek/deepseek-flash",
          general: "deepseek/deepseek-v4-pro",
        },
      });

      expect(res.ok).toBe(true);
      const toml = await fs.readFile(TOOL_PATHS["deepseek-tui"].config, "utf8");
      expect(toml).toContain('[subagents]');
      expect(toml).toContain('explorer = "deepseek/deepseek-v4.1-flash"');
      expect(toml).toContain('reviewer = "deepseek/deepseek-v4-pro"');
    } finally {
      TOOL_PATHS["deepseek-tui"].dir = origDir;
      TOOL_PATHS["deepseek-tui"].config = origConfig;
    }
  });

  it("autoConfigureAllTools runs safely across target tools", async () => {
    const res = await autoConfigureAllTools({
      baseUrl: "http://127.0.0.1:21128/v1",
      apiKey: "sk_test",
      candidateModels: ["ag/gemini-3.8-flash-high", "cc/claude-sonnet-4-6"],
      targetTools: [],
    });

    expect(res.ok).toBe(true);
    expect(res.configured).toEqual([]);
  });
});

describe("API Routes: hermes-settings & subagents", () => {
  it("GET /api/cli-tools/hermes-settings returns desktop support flags", async () => {
    const { GET } = await import("../../src/app/api/cli-tools/hermes-settings/route.js");
    const response = await GET();
    const data = await response.json();
    expect(typeof data).toBe("object");
    expect("desktopInstalled" in data).toBe(true);
    expect("desktopConfigPath" in data).toBe(true);
  });

  it("POST /api/cli-tools/subagents handles auto configuration request", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/subagents/route.js");
    const req = new Request("http://localhost/api/cli-tools/subagents", {
      method: "POST",
      body: JSON.stringify({
        targetTools: [],
        candidateModels: ["ag/gemini-3.8-flash-high", "cc/claude-sonnet-4-6"],
      }),
    });
    const response = await POST(req);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.configured)).toBe(true);
    expect(data.roles.explorer).toBe("ag/gemini-3.8-flash-high");
  });
});

