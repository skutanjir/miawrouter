import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Claude Code Gateway Security & Header Forwarding", () => {
  let DefaultExecutor;
  let isOfficialAnthropicHost;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("open-sse/executors/default.js");
    DefaultExecutor = mod.DefaultExecutor || mod.default;
    isOfficialAnthropicHost = mod.isOfficialAnthropicHost;
  });

  describe("isOfficialAnthropicHost helper", () => {
    it("validates official api.anthropic.com hostnames", () => {
      expect(isOfficialAnthropicHost("https://api.anthropic.com")).toBe(true);
      expect(isOfficialAnthropicHost("https://api.anthropic.com/v1")).toBe(true);
      expect(isOfficialAnthropicHost("https://api.anthropic.com/v1/messages")).toBe(true);
      expect(isOfficialAnthropicHost("http://api.anthropic.com/v1")).toBe(true);
      expect(isOfficialAnthropicHost("api.anthropic.com")).toBe(true);
    });

    it("rejects path-based and subdomain spoofed hosts", () => {
      expect(isOfficialAnthropicHost("https://evil.com/api.anthropic.com")).toBe(false);
      expect(isOfficialAnthropicHost("https://api.anthropic.com.attacker.com")).toBe(false);
      expect(isOfficialAnthropicHost("https://api.anthropic.com.attacker.com/v1")).toBe(false);
      expect(isOfficialAnthropicHost("evil.com/api.anthropic.com")).toBe(false);
      expect(isOfficialAnthropicHost("https://not-anthropic.com?ref=api.anthropic.com")).toBe(false);
    });

    it("rejects malformed and empty URLs", () => {
      expect(isOfficialAnthropicHost("")).toBe(false);
      expect(isOfficialAnthropicHost("   ")).toBe(false);
      expect(isOfficialAnthropicHost(null)).toBe(false);
      expect(isOfficialAnthropicHost(undefined)).toBe(false);
      expect(isOfficialAnthropicHost("not a valid url :///")).toBe(false);
    });
  });

  describe("Spoofed Host Rejection in buildHeaders()", () => {
    it("strips first-party identity headers for evil.com/api.anthropic.com", () => {
      const executor = new DefaultExecutor("anthropic-compatible-custom");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-test",
          providerSpecificData: { baseUrl: "https://evil.com/api.anthropic.com" },
        },
        true
      );

      expect(headers["x-app"]).toBeUndefined();
      expect(headers["X-App"]).toBeUndefined();
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBeUndefined();
      expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBeUndefined();

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      expect(betaVal).not.toContain("claude-code-20250219");
    });

    it("strips first-party identity headers for api.anthropic.com.attacker.com", () => {
      const executor = new DefaultExecutor("anthropic-compatible-custom");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-test",
          providerSpecificData: { baseUrl: "https://api.anthropic.com.attacker.com/v1" },
        },
        true
      );

      expect(headers["x-app"]).toBeUndefined();
      expect(headers["X-App"]).toBeUndefined();
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBeUndefined();
      expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBeUndefined();

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      expect(betaVal).not.toContain("claude-code-20250219");
    });

    it("strips first-party identity headers when spoofed host passed as url argument", () => {
      const executor = new DefaultExecutor("anthropic-compatible-custom");
      const headers = executor.buildHeaders(
        { apiKey: "sk-test" },
        true,
        "https://evil.com/api.anthropic.com/v1/messages"
      );

      expect(headers["x-app"]).toBeUndefined();
      expect(headers["X-App"]).toBeUndefined();
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBeUndefined();
      expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBeUndefined();

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      expect(betaVal).not.toContain("claude-code-20250219");
    });

    it("strips first-party identity headers when claude provider is pointed to a spoofed host", () => {
      const executor = new DefaultExecutor("claude");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-test",
          providerSpecificData: { baseUrl: "https://evil.com/api.anthropic.com" },
        },
        true
      );

      expect(headers["x-app"]).toBeUndefined();
      expect(headers["X-App"]).toBeUndefined();
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBeUndefined();
      expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBeUndefined();

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      expect(betaVal).not.toContain("claude-code-20250219");
    });
  });

  describe("Native 'anthropic' provider recognition", () => {
    it("preserves beta and tracking headers on official host", () => {
      const executor = new DefaultExecutor("anthropic");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-ant-test",
          providerSpecificData: { baseUrl: "https://api.anthropic.com/v1" },
        },
        true
      );

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      expect(betaVal).toContain("claude-code-20250219");
      expect(betaVal).toContain("interleaved-thinking-2025-05-14");

      const versionVal = headers["anthropic-version"] || headers["Anthropic-Version"];
      expect(versionVal).toBe("2023-06-01");
    });

    it("selects model-gated beta flags for official anthropic provider with claude-opus-5", () => {
      const executor = new DefaultExecutor("anthropic");
      const headers = executor.buildHeaders(
        { apiKey: "sk-ant-test" },
        true,
        undefined,
        "claude-opus-5"
      );

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      const flags = betaVal.split(",").map(s => s.trim());
      expect(flags).toContain("claude-code-20250219");
      expect(flags).toContain("advanced-tool-use-2025-11-20");
      expect(flags).toContain("effort-2025-11-24");
    });

    it("preserves tracking headers passed to anthropic provider on official host", () => {
      const executor = new DefaultExecutor("anthropic");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-ant-test",
          runtimeTransport: {
            headers: {
              "X-App": "cli",
              "User-Agent": "claude-cli/2.1.272 (external, sdk-cli)",
              "Anthropic-Dangerous-Direct-Browser-Access": "true",
            },
          },
        },
        true
      );

      expect(headers["X-App"]).toBe("cli");
      expect(headers["User-Agent"]).toContain("claude-cli");
      expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBe("true");
    });

    it("strips first-party identity headers when anthropic provider is directed to spoofed host", () => {
      const executor = new DefaultExecutor("anthropic");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-ant-test",
          providerSpecificData: { baseUrl: "https://evil.com/api.anthropic.com" },
        },
        true
      );

      expect(headers["x-app"]).toBeUndefined();
      expect(headers["X-App"]).toBeUndefined();
      expect(headers["anthropic-dangerous-direct-browser-access"]).toBeUndefined();
      expect(headers["Anthropic-Dangerous-Direct-Browser-Access"]).toBeUndefined();

      const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"] || "";
      expect(betaVal).not.toContain("claude-code-20250219");
    });
  });

  describe("Generic / non-Anthropic provider non-leakage", () => {
    it("never leaks incoming anthropic-version to generic openai provider", () => {
      const executor = new DefaultExecutor("openai");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-openai-key",
          runtimeTransport: {
            headers: {
              "anthropic-version": "2023-06-01",
              "Anthropic-Version": "2023-06-01",
              "ANTHROPIC-VERSION": "2023-06-01",
            },
          },
        },
        true
      );

      const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
      expect(versionKeys).toHaveLength(0);
      expect(headers["anthropic-version"]).toBeUndefined();
      expect(headers["Anthropic-Version"]).toBeUndefined();
    });

    it("never leaks incoming anthropic-version to other generic providers (e.g. groq)", () => {
      const executor = new DefaultExecutor("groq");
      const headers = executor.buildHeaders(
        {
          apiKey: "gsk-test",
          runtimeTransport: {
            headers: {
              "anthropic-version": "2023-06-01",
            },
          },
        },
        true
      );

      const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
      expect(versionKeys).toHaveLength(0);
    });
  });

  describe("Version Header Canonicalization and Deduplication", () => {
    it("canonicalizes duplicate casings to exactly one version header for claude provider", () => {
      const executor = new DefaultExecutor("claude");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-test",
          runtimeTransport: {
            headers: {
              "anthropic-version": "2023-06-01",
              "Anthropic-Version": "2023-06-01",
              "ANTHROPIC-VERSION": "2023-06-01",
            },
          },
        },
        true
      );

      const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
      expect(versionKeys).toHaveLength(1);
      const versionVal = headers[versionKeys[0]];
      expect(versionVal).toBe("2023-06-01");
    });

    it("canonicalizes duplicate casings to exactly one version header for anthropic provider", () => {
      const executor = new DefaultExecutor("anthropic");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-test",
          runtimeTransport: {
            headers: {
              "Anthropic-Version": "2023-06-01",
              "anthropic-version": "2023-06-01",
            },
          },
        },
        true
      );

      const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
      expect(versionKeys).toHaveLength(1);
      expect(headers[versionKeys[0]]).toBe("2023-06-01");
    });

    it("canonicalizes duplicate casings for anthropic-compatible provider", () => {
      const executor = new DefaultExecutor("anthropic-compatible-custom");
      const headers = executor.buildHeaders(
        {
          apiKey: "sk-test",
          runtimeTransport: {
            headers: {
              "Anthropic-Version": "2023-06-01",
              "anthropic-version": "2023-06-01",
              "ANTHROPIC-VERSION": "2023-06-01",
            },
          },
        },
        true
      );

      const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
      expect(versionKeys).toHaveLength(1);
      expect(headers[versionKeys[0]]).toBe("2023-06-01");
    });
  });

  describe("rawHeaders Passthrough and Capability/Tracking Forwarding", () => {
    describe("Native official claude and anthropic providers", () => {
      it("merges unknown incoming anthropic-beta flags with existing defaults for claude provider", () => {
        const executor = new DefaultExecutor("claude");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            rawHeaders: {
              "Anthropic-Beta": "custom-feature-2026,another-beta-flag",
            },
          },
          true,
          undefined,
          "claude-opus-5"
        );

        const betaVal = headers["Anthropic-Beta"] || headers["anthropic-beta"];
        expect(betaVal).toBeDefined();
        const flags = betaVal.split(",").map(s => s.trim());
        expect(flags).toContain("custom-feature-2026");
        expect(flags).toContain("another-beta-flag");
        expect(flags).toContain("claude-code-20250219");
        expect(flags).toContain("advanced-tool-use-2025-11-20");
        expect(flags).toContain("effort-2025-11-24");
      });

      it("merges unknown incoming anthropic-beta with case-insensitive header name lookup", () => {
        const executor = new DefaultExecutor("anthropic");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            rawHeaders: {
              "anthropic-BETA": "prompt-caching-test-flag,new-beta-feature",
            },
          },
          true
        );

        const betaVal = headers["Anthropic-Beta"] || headers["anthropic-beta"];
        expect(betaVal).toBeDefined();
        const flags = betaVal.split(",").map(s => s.trim());
        expect(flags).toContain("prompt-caching-test-flag");
        expect(flags).toContain("new-beta-feature");
        expect(flags).toContain("claude-code-20250219");
      });

      it("preserves incoming anthropic-version unchanged with exactly one casing", () => {
        const executor = new DefaultExecutor("claude");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            rawHeaders: {
              "Anthropic-Version": "2024-01-01-custom",
            },
          },
          true
        );

        const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
        expect(versionKeys).toEqual(["Anthropic-Version"]);
        expect(headers["Anthropic-Version"]).toBe("2024-01-01-custom");
      });

      it("preserves incoming lowercase anthropic-version with exactly one casing", () => {
        const executor = new DefaultExecutor("anthropic");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            rawHeaders: {
              "anthropic-version": "2024-02-15",
            },
          },
          true
        );

        const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
        expect(versionKeys).toEqual(["anthropic-version"]);
        expect(headers["anthropic-version"]).toBe("2024-02-15");
      });

      it("forwards tracking and capability headers (session-id, agent-id, parent-agent-id, workspace-id)", () => {
        const executor = new DefaultExecutor("claude");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            rawHeaders: {
              "X-Claude-Code-Session-Id": "ses_12345",
              "x-claude-code-agent-id": "agent_main",
              "X-CLAUDE-CODE-PARENT-AGENT-ID": "agent_parent",
              "anthropic-workspace-id": "ws_abcdef",
            },
          },
          true
        );

        expect(headers["X-Claude-Code-Session-Id"]).toBe("ses_12345");
        expect(headers["x-claude-code-agent-id"]).toBe("agent_main");
        expect(headers["X-CLAUDE-CODE-PARENT-AGENT-ID"]).toBe("agent_parent");
        expect(headers["anthropic-workspace-id"]).toBe("ws_abcdef");
      });
    });

    describe("Official anthropic-compatible target (api.anthropic.com)", () => {
      it("preserves and merges rawHeaders when endpoint is api.anthropic.com", () => {
        const executor = new DefaultExecutor("anthropic-compatible-official");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            providerSpecificData: { baseUrl: "https://api.anthropic.com/v1" },
            rawHeaders: {
              "anthropic-beta": "extra-beta-flag-1",
              "anthropic-version": "2024-03-01",
              "x-claude-code-session-id": "ses_compat_999",
              "x-claude-code-agent-id": "agent_compat",
              "x-claude-code-parent-agent-id": "agent_compat_parent",
              "anthropic-workspace-id": "ws_compat",
            },
          },
          true
        );

        const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"];
        expect(betaVal).toContain("extra-beta-flag-1");

        const versionKeys = Object.keys(headers).filter(k => k.toLowerCase() === "anthropic-version");
        expect(versionKeys).toHaveLength(1);
        expect(headers[versionKeys[0]]).toBe("2024-03-01");

        expect(headers["x-claude-code-session-id"]).toBe("ses_compat_999");
        expect(headers["x-claude-code-agent-id"]).toBe("agent_compat");
        expect(headers["x-claude-code-parent-agent-id"]).toBe("agent_compat_parent");
        expect(headers["anthropic-workspace-id"]).toBe("ws_compat");
      });

      it("preserves and merges rawHeaders when target url parameter is api.anthropic.com", () => {
        const executor = new DefaultExecutor("anthropic-compatible-official");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            rawHeaders: {
              "anthropic-beta": "url-beta-flag",
              "anthropic-workspace-id": "ws_url_test",
            },
          },
          true,
          "https://api.anthropic.com/v1/messages"
        );

        const betaVal = headers["anthropic-beta"] || headers["Anthropic-Beta"];
        expect(betaVal).toContain("url-beta-flag");
        expect(headers["anthropic-workspace-id"]).toBe("ws_url_test");
      });
    });

    describe("Third-party, spoofed, malformed, and generic providers non-leakage", () => {
      it("does not forward tracking/capability headers to spoofed host", () => {
        const executor = new DefaultExecutor("claude");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            providerSpecificData: { baseUrl: "https://evil.com/api.anthropic.com" },
            rawHeaders: {
              "x-claude-code-session-id": "leak_session",
              "x-claude-code-agent-id": "leak_agent",
              "x-claude-code-parent-agent-id": "leak_parent",
              "anthropic-workspace-id": "leak_ws",
              "anthropic-beta": "evil-beta",
            },
          },
          true
        );

        expect(headers["x-claude-code-session-id"]).toBeUndefined();
        expect(headers["x-claude-code-agent-id"]).toBeUndefined();
        expect(headers["x-claude-code-parent-agent-id"]).toBeUndefined();
        expect(headers["anthropic-workspace-id"]).toBeUndefined();
      });

      it("does not forward tracking/capability headers to subdomain-spoofed host", () => {
        const executor = new DefaultExecutor("anthropic");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            providerSpecificData: { baseUrl: "https://api.anthropic.com.attacker.com" },
            rawHeaders: {
              "x-claude-code-session-id": "leak_session",
              "anthropic-workspace-id": "leak_ws",
            },
          },
          true
        );

        expect(headers["x-claude-code-session-id"]).toBeUndefined();
        expect(headers["anthropic-workspace-id"]).toBeUndefined();
      });

      it("does not forward tracking/capability headers to third-party anthropic-compatible provider", () => {
        const executor = new DefaultExecutor("anthropic-compatible-custom");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-test",
            providerSpecificData: { baseUrl: "https://third-party-gateway.com/v1" },
            rawHeaders: {
              "x-claude-code-session-id": "thirdparty_session",
              "x-claude-code-agent-id": "thirdparty_agent",
              "x-claude-code-parent-agent-id": "thirdparty_parent",
              "anthropic-workspace-id": "thirdparty_ws",
            },
          },
          true
        );

        expect(headers["x-claude-code-session-id"]).toBeUndefined();
        expect(headers["x-claude-code-agent-id"]).toBeUndefined();
        expect(headers["x-claude-code-parent-agent-id"]).toBeUndefined();
        expect(headers["anthropic-workspace-id"]).toBeUndefined();
      });

      it("does not forward tracking/capability headers to generic providers (openai, groq)", () => {
        const executor = new DefaultExecutor("openai");
        const headers = executor.buildHeaders(
          {
            apiKey: "sk-openai",
            rawHeaders: {
              "x-claude-code-session-id": "openai_session",
              "anthropic-workspace-id": "openai_ws",
              "anthropic-beta": "openai_beta",
              "anthropic-version": "2023-06-01",
            },
          },
          true
        );

        expect(headers["x-claude-code-session-id"]).toBeUndefined();
        expect(headers["anthropic-workspace-id"]).toBeUndefined();
        expect(headers["anthropic-beta"]).toBeUndefined();
        expect(headers["Anthropic-Beta"]).toBeUndefined();
        expect(headers["anthropic-version"]).toBeUndefined();
        expect(headers["Anthropic-Version"]).toBeUndefined();
      });
    });
  });
});
