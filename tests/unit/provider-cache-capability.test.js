import { describe, it, expect, beforeEach } from "vitest";
import { begin, finish, countBreakpoints, _resetCacheState } from "../../open-sse/cache/l0.js";
import {
  resolveCacheCapability,
  supportsCacheMarkers,
  CACHE_MODE,
} from "../../open-sse/providers/cacheCapabilities.js";
import { applyCloaking } from "../../open-sse/utils/claudeCloaking.js";
import { filterToOpenAIFormat } from "../../open-sse/translator/formats/openai.js";

/**
 * Regression suite for two provider prompt-cache bugs:
 *
 * 1. L0 injected Anthropic-only cache_control into EVERY provider body. After two
 *    turns of a stable prefix, OpenAI/Gemini/unknown providers received an
 *    outbound body carrying cache_control on message blocks AND tool objects.
 *    Anthropic's marker dialect is not interoperable; providers that reject the
 *    field fail the request, and providers that ignore it are no better off.
 *
 * 2. applyCloaking put a randomized billing header into system[0] for every
 *    Anthropic OAuth request. system[0] is the first bytes of the cached prefix,
 *    so the cache could never hit.
 */

function codingSessionBody() {
  return {
    model: "test-model",
    messages: [
      { role: "system", content: "You are a coding agent." },
      { role: "user", content: "first turn" },
      { role: "assistant", content: "ok" },
      { role: "user", content: "latest tail" },
    ],
    tools: [
      {
        type: "function",
        function: { name: "read_file", description: "read", parameters: { type: "object", properties: {} } },
      },
    ],
  };
}

/** Drive `turns` identical-prefix requests through L0 and return the last result. */
function runSession({ cacheKey, provider, format, turns = 2 }) {
  const capability = resolveCacheCapability(provider, format);
  let out = null;
  for (let i = 0; i < turns; i++) {
    const body = codingSessionBody();
    const state = begin(body);
    out = finish(body, state, { cacheKey, provider, model: "m", capability });
  }
  return out;
}

describe("L0 provider-aware cache breakpoints", () => {
  beforeEach(() => _resetCacheState());

  // --- capability model -----------------------------------------------------

  it("resolves explicit caching only for marker-supporting formats", () => {
    expect(resolveCacheCapability("anthropic", "claude").mode).toBe(CACHE_MODE.EXPLICIT);
    expect(resolveCacheCapability("claude", "claude").supportsCacheMarkers).toBe(true);
    // DashScope-compatible endpoints accept cache_control (quirks.preserveCacheControl)
    expect(resolveCacheCapability("alicode", "openai").supportsCacheMarkers).toBe(true);
    expect(resolveCacheCapability("alims-intl", "openai").supportsCacheMarkers).toBe(true);
  });

  it("classifies implicit-cache providers and never marks them marker-capable", () => {
    for (const [provider, format] of [
      ["openai", "openai"],
      ["deepseek", "openai"],
      ["openrouter", "openai"],
      ["gemini", "gemini"],
      ["gemini-cli", "gemini-cli"],
      ["vertex", "vertex"],
      ["antigravity", "antigravity"],
      ["codex", "openai-responses"],
    ]) {
      const cap = resolveCacheCapability(provider, format);
      expect(cap.mode, `${provider}/${format}`).toBe(CACHE_MODE.IMPLICIT);
      expect(cap.supportsCacheMarkers, `${provider}/${format}`).toBe(false);
    }
  });

  it("keeps unknown providers unknown rather than assuming no caching", () => {
    for (const [provider, format] of [
      ["commandcode", "commandcode"],
      ["kiro", "kiro"],
      ["cursor", "cursor"],
      ["grok-web", "grok-web"],
      ["some-future-vendor", "openai"],
    ]) {
      const cap = resolveCacheCapability(provider, format);
      expect(cap.mode, `${provider}/${format}`).toBe(CACHE_MODE.UNKNOWN);
      expect(cap.supportsCacheMarkers, `${provider}/${format}`).toBe(false);
    }
  });

  it("resolves by target format first so a provider's claude transport still gets markers", () => {
    // deepseek speaks both openai and claude; only the claude transport accepts markers.
    expect(resolveCacheCapability("deepseek", "openai").supportsCacheMarkers).toBe(false);
    expect(resolveCacheCapability("deepseek", "claude").supportsCacheMarkers).toBe(true);
  });

  it("treats a missing capability as unknown, so callers that pass nothing never inject", () => {
    expect(supportsCacheMarkers("anthropic", "claude")).toBe(true);
    const body = codingSessionBody();
    const state = begin(body);
    const out = finish(body, state, { cacheKey: "no-cap", provider: "anthropic", model: "m" });
    expect(out.info.markerInserted).toBe(false);
    expect(countBreakpoints(out.body)).toBe(0);
  });

  // --- the bug ---------------------------------------------------------------

  it("does NOT inject cache_control into an OpenAI-format body after a stable prefix", () => {
    const out = runSession({ cacheKey: "openai:s1", provider: "openai", format: "openai" });
    expect(out.info.stable).toBe(true);
    expect(out.info.markerInserted).toBe(false);
    expect(out.info.breakpoints).toBe(0);
    expect(JSON.stringify(out.body)).not.toContain("cache_control");
    // tool objects are the most damaging place to leak the field
    expect(out.body.tools.every((t) => t.cache_control === undefined)).toBe(true);
  });

  it("does NOT inject cache_control into a Gemini/Antigravity body", () => {
    for (const [provider, format] of [["gemini", "gemini"], ["antigravity", "antigravity"]]) {
      const out = runSession({ cacheKey: `${provider}:s1`, provider, format });
      expect(out.info.stable).toBe(true);
      expect(JSON.stringify(out.body), provider).not.toContain("cache_control");
    }
  });

  it("does NOT inject cache_control into an unknown-format body", () => {
    const out = runSession({ cacheKey: "cc:s1", provider: "commandcode", format: "commandcode" });
    expect(out.info.stable).toBe(true);
    expect(JSON.stringify(out.body)).not.toContain("cache_control");
  });

  it("still injects breakpoints for an explicit-cache provider (no regression)", () => {
    const out = runSession({ cacheKey: "anthropic:s1", provider: "anthropic", format: "claude" });
    expect(out.info.stable).toBe(true);
    expect(out.info.markerInserted).toBe(true);
    expect(out.info.breakpoints).toBeGreaterThan(0);
    expect(countBreakpoints(out.body)).toBe(out.info.breakpoints);
  });

  it("preserves a client-supplied cache_control block verbatim on every provider", () => {
    const clientMarker = { type: "ephemeral", ttl: "1h" };
    const body = codingSessionBody();
    body.system = [{ type: "text", text: "You are a coding agent.", cache_control: clientMarker }];
    const state = begin(body);
    const capability = resolveCacheCapability("openai", "openai");
    const out = finish(body, state, { cacheKey: "openai:client", provider: "openai", model: "m", capability });
    // L0 must never rewrite what the client sent, even when it adds nothing itself.
    expect(out.body.system[0].cache_control).toEqual(clientMarker);
    expect(out.info.markerInserted).toBe(false);
  });

  it("reports the resolved cache mode in the probe event", () => {
    const events = [];
    // Two turns: a breakpoint is only safe once the prefix has been seen twice.
    const capability = resolveCacheCapability("openai", "openai");
    for (let i = 0; i < 2; i++) {
      const body = codingSessionBody();
      const state = begin(body);
      finish(body, state, {
        cacheKey: "openai:probe",
        provider: "openai",
        model: "m",
        capability,
        onCacheEvent: (e) => events.push(e),
      });
    }
    expect(events).toHaveLength(2);
    expect(events[1].cacheMode).toBe(CACHE_MODE.IMPLICIT);
    expect(events[1].stable).toBe(true);
  });
});

describe("cache marker preservation across the OpenAI bridge", () => {
  const claudeTool = () => ({
    name: "read_file",
    description: "read",
    input_schema: { type: "object", properties: {} },
    cache_control: { type: "ephemeral" },
  });

  it("preserves a tool-level marker for a marker-supporting provider", () => {
    const body = { messages: [{ role: "user", content: "hi" }], tools: [claudeTool()] };
    const out = filterToOpenAIFormat(body, { preserveCacheControl: true });
    expect(out.tools[0].cache_control).toEqual({ type: "ephemeral" });
    expect(out.tools[0].type).toBe("function");
  });

  it("strips a tool-level marker for a provider that rejects the field", () => {
    const body = { messages: [{ role: "user", content: "hi" }], tools: [claudeTool()] };
    const out = filterToOpenAIFormat(body, {});
    expect(out.tools[0].cache_control).toBeUndefined();
    expect(out.tools[0].type).toBe("function");
  });

  it("strips a message-block marker by default and keeps it when supported", () => {
    const mk = () => ({
      messages: [{ role: "user", content: [{ type: "text", text: "hi", cache_control: { type: "ephemeral" } }] }],
    });
    expect(filterToOpenAIFormat(mk(), {}).messages[0].content[0].cache_control).toBeUndefined();
    expect(filterToOpenAIFormat(mk(), { preserveCacheControl: true }).messages[0].content[0].cache_control)
      .toEqual({ type: "ephemeral" });
  });
});

describe("Anthropic OAuth billing header prefix stability", () => {
  const OAT = "sk-ant-oat01-account-a";

  function bodyFor(tail) {
    return {
      model: "claude-sonnet-4-5",
      system: "You are a coding agent.",
      tools: [{ name: "Read", description: "read", input_schema: { type: "object", properties: {} } }],
      messages: [
        { role: "user", content: "turn one" },
        { role: "assistant", content: "ok" },
        { role: "user", content: tail },
      ],
    };
  }

  it("produces a byte-identical system[0] for two identical requests", () => {
    const a = applyCloaking(bodyFor("turn two"), OAT, "sess-1");
    const b = applyCloaking(bodyFor("turn two"), OAT, "sess-1");
    expect(a.system[0].text).toBe(b.system[0].text);
  });

  it("keeps system[0] stable when the conversation grows (prefix stays cacheable)", () => {
    const first = applyCloaking(bodyFor("turn two"), OAT, "sess-1");
    const second = applyCloaking(bodyFor("turn three"), OAT, "sess-1");
    expect(second.system[0].text).toBe(first.system[0].text);
  });

  it("still derives a distinct header per account", () => {
    const a = applyCloaking(bodyFor("x"), OAT, "sess-1");
    const b = applyCloaking(bodyFor("x"), "sk-ant-oat01-account-b", "sess-1");
    expect(a.system[0].text).not.toBe(b.system[0].text);
  });

  it("keeps the billing header protocol-valid (version.build; entrypoint; cch)", () => {
    const out = applyCloaking(bodyFor("x"), OAT, "sess-1");
    expect(out.system[0].text).toMatch(/^x-anthropic-billing-header: cc_version=\d+\.\d+\.\d+\.[0-9a-f]{3}; cc_entrypoint=[^;]+; cch=[0-9a-f]{5};$/);
  });

  it("leaves non-OAuth requests untouched", () => {
    const out = applyCloaking(bodyFor("x"), "sk-plain-key", "sess-1");
    expect(out.system).toBe("You are a coding agent.");
  });

  it("does not touch the tools array (renaming is cloakClaudeTools' job)", () => {
    const body = bodyFor("x");
    body.tools = [
      { name: "MyTool", description: "custom", input_schema: { type: "object", properties: {} } },
      { name: "AnotherTool", description: "custom", input_schema: { type: "object", properties: {} } },
    ];
    const out = applyCloaking(body, OAT, "sess-1");
    expect(out.tools.map((t) => t.name)).toEqual(["MyTool", "AnotherTool"]);
  });
});
