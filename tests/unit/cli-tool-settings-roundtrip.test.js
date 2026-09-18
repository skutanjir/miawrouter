// Round-trip regression for CLI tool settings routes.
//
// Every route here writes a provider entry and then reads it back. After the
// MiawRouter rebrand, several "legacy" aliases became identical to the current
// key, so the "drop the legacy slot" cleanup deleted the entry that had just
// been written. These tests fail if a write-then-read round-trip loses the
// provider, its models, or the API key.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parseTOML } from "confbox";

const originalHome = process.env.HOME;
const originalXdg = process.env.XDG_CONFIG_HOME;
let tmpHome;

const readJson = async (file) => JSON.parse(await fs.readFile(file, "utf8"));

const BASE_URL = "http://127.0.0.1:21128";
const MODEL = "cc/claude-sonnet-4-6";

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "miaw-cli-settings-"));
  process.env.HOME = tmpHome;
  process.env.XDG_CONFIG_HOME = path.join(tmpHome, ".config");
});

afterEach(async () => {
  process.env.HOME = originalHome;
  if (originalXdg === undefined) delete process.env.XDG_CONFIG_HOME;
  else process.env.XDG_CONFIG_HOME = originalXdg;
  await fs.rm(tmpHome, { recursive: true, force: true });
});

describe("OpenCode settings round-trip", () => {
  it("keeps the provider block and its models after apply", async () => {
    const { POST, GET } = await import("../../src/app/api/cli-tools/opencode-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/opencode-settings", {
      method: "POST",
      body: JSON.stringify({
        baseUrl: BASE_URL,
        apiKey: "sk-test-opencode",
        models: [MODEL],
        activeModel: MODEL,
      }),
    }));
    expect(res.status).toBe(200);

    const configPath = path.join(tmpHome, ".config", "opencode", "opencode.json");
    const config = await readJson(configPath);
    expect(config.provider.miawrouter).toBeTruthy();
    expect(Object.keys(config.provider.miawrouter.models)).toEqual([MODEL]);
    expect(config.provider.miawrouter.options.baseURL).toBe(`${BASE_URL}/v1`);
    expect(config.model).toBe(`miawrouter/${MODEL}`);

    const status = await (await GET()).json();
    expect(status.hasMiawRouter).toBe(true);
    expect(status.opencode.models).toEqual([MODEL]);
    expect(status.opencode.activeModel).toBe(MODEL);
  });
});

describe("OpenClaw settings round-trip", () => {
  it("keeps the provider block after apply", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/openclaw-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/openclaw-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-openclaw", model: MODEL }),
    }));
    expect(res.status).toBe(200);

    const settings = await readJson(path.join(tmpHome, ".openclaw", "openclaw.json"));
    expect(settings.models.providers.miawrouter).toBeTruthy();
    expect(settings.models.providers.miawrouter.baseUrl).toBe(`${BASE_URL}/v1`);
    expect(settings.models.providers.miawrouter.models.map((m) => m.id)).toEqual([MODEL]);
    expect(settings.agents.defaults.model.primary).toBe(`miawrouter/${MODEL}`);
  });
});

describe("jcode settings round-trip", () => {
  it("keeps the provider block and its API key after apply", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/jcode-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/jcode-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-jcode", models: [MODEL] }),
    }));
    expect(res.status).toBe(200);

    const config = parseTOML(await fs.readFile(path.join(tmpHome, ".jcode", "config.toml"), "utf8"));
    expect(config.providers.miawrouter).toBeTruthy();
    expect(config.providers.miawrouter.base_url).toBe(`${BASE_URL}/v1`);

    const envPath = path.join(tmpHome, ".config", "jcode", "provider-miawrouter.env");
    const envText = await fs.readFile(envPath, "utf8");
    expect(envText).toMatch(/^JCODE_MIAWROUTER_API_KEY=["']?sk-test-jcode["']?$/m);
  });
});

describe("Cowork settings round-trip", () => {
  it("writes the gateway config and reads it back through GET", async () => {
    // Cowork resolves its root from homedir() at call time, but the CLI-token
    // helper resolves DATA_DIR at module load, so it reads the real data dir.
    // That path is read-only here (machine-id + cli-secret already exist).
    const { POST, GET } = await import("../../src/app/api/cli-tools/cowork-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/cowork-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: `${BASE_URL}/v1`, apiKey: "sk-test-cowork", models: [MODEL] }),
    }));
    expect(res.status).toBe(200);

    const configDir = path.join(tmpHome, ".config", "Claude-3p", "configLibrary");
    const meta = await readJson(path.join(configDir, "_meta.json"));
    expect(meta.appliedId).toBeTruthy();

    const config = await readJson(path.join(configDir, `${meta.appliedId}.json`));
    expect(config.inferenceGatewayBaseUrl).toBe(`${BASE_URL}/v1`);
    expect(config.inferenceGatewayApiKey).toBe("sk-test-cowork");
    expect(config.inferenceModels.map((m) => m.name)).toEqual([MODEL]);

    const status = await (await GET()).json();
    expect(status.hasMiawRouter).toBe(true);
    expect(status.config.inferenceGatewayBaseUrl).toBe(`${BASE_URL}/v1`);
  });
});

describe("Idempotent apply", () => {
  it("OpenCode keeps the provider block when Apply runs twice", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/opencode-settings/route.js");
    const body = JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-twice", models: [MODEL], activeModel: MODEL });
    const call = () => POST(new Request("http://localhost/api/cli-tools/opencode-settings", { method: "POST", body }));

    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);

    const config = await readJson(path.join(tmpHome, ".config", "opencode", "opencode.json"));
    expect(Object.keys(config.provider.miawrouter.models)).toEqual([MODEL]);
    expect(config.provider.miawrouter.options.apiKey).toBe("sk-twice");
  });

  it("Hermes models block names a provider that still exists on a second Apply", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/hermes-settings/route.js");
    const call = () => POST(new Request("http://localhost/api/cli-tools/hermes-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-twice", model: MODEL }),
    }));

    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);

    const yaml = await fs.readFile(path.join(tmpHome, ".hermes", "config.yaml"), "utf8");
    const providerName = yaml.match(/^model:\s*\n(?:[ \t]+.*\r?\n)*?[ \t]+provider:[ \t]*["']?([^"'\r\n]+)["']?/m)?.[1]?.trim();
    expect(providerName).toBeTruthy();
    // Exactly one entry for that name — a self-deleting cleanup would have removed it.
    const entries = yaml.match(new RegExp(`^ {2}${providerName}:`, "gm")) || [];
    expect(entries).toHaveLength(1);
  });
});

describe("Claude settings round-trip", () => {
  it("points ANTHROPIC_BASE_URL at MiawRouter", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/claude-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/claude-settings", {
      method: "POST",
      body: JSON.stringify({ env: { ANTHROPIC_BASE_URL: BASE_URL, ANTHROPIC_AUTH_TOKEN: "sk-test-claude" } }),
    }));
    expect(res.status).toBe(200);

    const settings = await readJson(path.join(tmpHome, ".claude", "settings.json"));
    expect(settings.env.ANTHROPIC_BASE_URL).toBe(`${BASE_URL}/v1`);
    expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe("sk-test-claude");
  });
});

describe("Cline settings round-trip", () => {
  it("keeps the OpenAI-compatible endpoint and key", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/cline-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/cline-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-cline", model: MODEL }),
    }));
    expect(res.status).toBe(200);

    const globalState = await readJson(path.join(tmpHome, ".cline", "data", "globalState.json"));
    expect(globalState.actModeApiProvider).toBe("openai");
    expect(globalState.openAiBaseUrl).toBe(BASE_URL);
    expect(globalState.openAiModelId).toBe(MODEL);

    const secrets = await readJson(path.join(tmpHome, ".cline", "data", "secrets.json"));
    expect(secrets.openAiApiKey).toBe("sk-test-cline");
  });
});

describe("Codex settings round-trip", () => {
  it("keeps the provider table and auth after apply", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/codex-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/codex-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-codex", model: MODEL }),
    }));
    expect(res.status).toBe(200);

    const config = parseTOML(await fs.readFile(path.join(tmpHome, ".codex", "config.toml"), "utf8"));
    expect(config.model_provider).toBe("miawrouter");
    expect(config.model_providers.miawrouter).toBeTruthy();
    expect(config.model_providers.miawrouter.base_url).toBe(`${BASE_URL}/v1`);
    expect(config.model_providers.miawrouter.http_headers.Authorization).toBe("Bearer sk-test-codex");

    const auth = await readJson(path.join(tmpHome, ".codex", "auth.json"));
    expect(auth.OPENAI_API_KEY).toBe("sk-test-codex");
  });
});

describe("Copilot settings round-trip", () => {
  it("writes a single MiawRouter entry pointing at the gateway", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/copilot-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/copilot-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: `${BASE_URL}/v1`, apiKey: "sk-test-copilot", models: [MODEL] }),
    }));
    expect(res.status).toBe(200);

    const config = await readJson(path.join(tmpHome, ".config", "Code", "User", "chatLanguageModels.json"));
    const entries = config.filter((e) => e.name === "MiawRouter");
    expect(entries).toHaveLength(1);
    expect(entries[0].models.map((m) => m.id)).toEqual([MODEL]);
    expect(entries[0].models[0].url).toContain(`${BASE_URL}/v1/chat/completions`);
  });
});

describe("DeepSeek TUI settings round-trip", () => {
  it("writes an openai provider block pointing at MiawRouter", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/deepseek-tui-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/deepseek-tui-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-deepseek", model: MODEL }),
    }));
    expect(res.status).toBe(200);

    const config = parseTOML(await fs.readFile(path.join(tmpHome, ".deepseek", "config.toml"), "utf8"));
    expect(config.provider).toBe("openai");
    expect(config.providers.openai.base_url).toBe(`${BASE_URL}/v1`);
    expect(config.providers.openai.model).toBe(MODEL);
  });
});

describe("Droid settings round-trip", () => {
  it("keeps customModels pointing at MiawRouter", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/droid-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/droid-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-droid", models: [MODEL] }),
    }));
    expect(res.status).toBe(200);

    const settings = await readJson(path.join(tmpHome, ".factory", "settings.json"));
    const ours = settings.customModels.filter((m) => m.id.startsWith("custom:MiawRouter"));
    expect(ours).toHaveLength(1);
    expect(ours[0].baseUrl).toBe(`${BASE_URL}/v1`);
    expect(ours[0].model).toBe(MODEL);
  });
});

describe("Kilo settings round-trip", () => {
  it("keeps the openai-compatible entry after apply", async () => {
    const { POST } = await import("../../src/app/api/cli-tools/kilo-settings/route.js");

    const res = await POST(new Request("http://localhost/api/cli-tools/kilo-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-kilo", model: MODEL }),
    }));
    expect(res.status).toBe(200);

    const auth = await readJson(path.join(tmpHome, ".local", "share", "kilo", "auth.json"));
    expect(auth["openai-compatible"]).toBeTruthy();
    expect(auth["openai-compatible"].baseUrl).toBe(`${BASE_URL}/v1`);
    expect(auth["openai-compatible"].model).toBe(MODEL);
  });
});

describe("Oh My Pi settings round-trip", () => {
  it("keeps the provider entry after apply", async () => {
    const configDir = path.join(tmpHome, ".omp", "agent");
    process.env.PI_CODING_AGENT_DIR = configDir;
    try {
      const { POST } = await import("../../src/app/api/cli-tools/oh-my-pi-settings/route.js");

      const res = await POST(new Request("http://localhost/api/cli-tools/oh-my-pi-settings", {
        method: "POST",
        body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-omp", model: MODEL }),
      }));
      expect(res.status).toBe(200);

      const yaml = await fs.readFile(path.join(configDir, "models.yml"), "utf8");
      expect(yaml).toMatch(/^providers:$/m);
      expect(yaml).toMatch(/^ {2}miawrouter:$/m);
      expect(yaml).toContain(`${BASE_URL}/v1`);
      expect(yaml).toContain(`id: "${MODEL}"`);
    } finally {
      delete process.env.PI_CODING_AGENT_DIR;
    }
  });
});

describe("Hermes settings round-trip", () => {
  it("points the selected provider at MiawRouter instead of a stale endpoint", async () => {
    const hermesDir = path.join(tmpHome, ".hermes");
    await fs.mkdir(hermesDir, { recursive: true });
    await fs.writeFile(
      path.join(hermesDir, "config.yaml"),
      [
        "model:",
        '  default: "nye"',
        '  provider: "custom"',
        `  base_url: "http://127.0.0.1:20128/v1"`,
        "providers:",
        "  custom:",
        "    name: Custom",
        '    base_url: "http://127.0.0.1:20128/v1"',
        '    model: "nye"',
        "    discover_models: true",
        "    api_key: sk-stale",
        "  ollama:",
        "    name: ollama",
        '    base_url: "http://127.0.0.1:11434/v1"',
        "",
      ].join("\n"),
      "utf8",
    );

    const { POST } = await import("../../src/app/api/cli-tools/hermes-settings/route.js");
    const res = await POST(new Request("http://localhost/api/cli-tools/hermes-settings", {
      method: "POST",
      body: JSON.stringify({ baseUrl: BASE_URL, apiKey: "sk-test-hermes", model: MODEL }),
    }));
    expect(res.status).toBe(200);

    const yaml = await fs.readFile(path.join(hermesDir, "config.yaml"), "utf8");

    // The top-level model block must select a provider that actually resolves
    // to MiawRouter; a stale sibling entry must not be reachable via that name.
    const providerMatch = yaml.match(/^model:\s*\n(?:[ \t]+.*\r?\n)*?[ \t]+provider:[ \t]*["']?([^"'\r\n]+)["']?/m);
    expect(providerMatch).toBeTruthy();
    const providerName = providerMatch[1].trim();

    const blockRe = new RegExp(`^  ${providerName}:[ \\t]*\\r?\\n((?:[ \\t]+.*\\r?\\n?|[ \\t]*\\r?\\n)*)`, "m");
    const blockMatch = yaml.match(blockRe);
    expect(blockMatch).toBeTruthy();
    expect(blockMatch[1]).toContain(`${BASE_URL}/v1`);
    expect(blockMatch[1]).not.toContain("20128");

    expect(yaml).toContain(`default: "${MODEL}"`);

    // Unrelated providers are preserved.
    expect(yaml).toContain("ollama:");
    expect(yaml).toContain("http://127.0.0.1:11434/v1");

    // The native desktop payload must name the same provider that now exists.
    const desktop = await readJson(path.join(hermesDir, "desktop.json"));
    expect(desktop.provider).toBe(providerName);
    expect(desktop.endpoint).toBe(`${BASE_URL}/v1`);
  });
});
