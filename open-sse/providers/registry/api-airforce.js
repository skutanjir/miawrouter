export default {
  id: "api-airforce",
  alias: "af",
  aliases: [
    "airforce",
  ],
  uiAlias: "af",
  display: {
    name: "API.airforce",
    icon: "flight",
    color: "#0EA5E9",
    textIcon: "AF",
    website: "https://api.airforce",
    notice: {
      apiKeyUrl: "https://api.airforce",
    },
    deprecated: true,
    deprecationNotice: "Upstream service has been dead since Aug 2026. Use llm7 or OVHcloud AI Endpoints instead.",
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://api.airforce/v1/chat/completions",
    validateUrl: "https://api.airforce/v1/models",
    headers: {
      "HTTP-Referer": "https://endpoint-proxy.local",
      "X-Title": "Endpoint Proxy",
    },
  },
  modelsFetcher: { url: "https://api.airforce/v1/models", type: "openai" },
  // Regenerated 2026-08-26 from https://api.airforce/v1/models (supports_chat, operational).
  // The full live catalog (~434 chat models) stays reachable via modelsFetcher suggestions.
  models: [{
  id: "grok-4.1-fast",
  name: "Grok 4.1 Fast (Free)",
  contextLength: 2000000
}, {
  id: "gemini-3.1-pro",
  name: "Gemini 3.1 Pro (Free)",
  contextLength: 2000000
}, {
  id: "gemini-3.1-pro-preview",
  name: "Gemini 3.1 Pro Preview (Free)",
  contextLength: 2000000
}, {
  id: "gemini-3-pro",
  name: "Gemini 3 Pro (Free)",
  contextLength: 2000000
}, {
  id: "gemini-2.5-pro",
  name: "Gemini 2.5 Pro (Free)",
  contextLength: 2000000
}, {
  id: "gemini-3.7-flash",
  name: "Gemini 3.7 Flash (Free)",
  contextLength: 1000000
}, {
  id: "gemini-3.6-flash",
  name: "Gemini 3.6 Flash (Free)",
  contextLength: 8192
}, {
  id: "gemini-3-flash",
  name: "Gemini 3 Flash (Free)",
  contextLength: 1000000
}, {
  id: "gemini-3.5-flash-lite",
  name: "Gemini 3.5 Flash Lite (Free)",
  contextLength: 8192
}, {
  id: "gemini-2.5-flash",
  name: "Gemini 2.5 Flash (Free)",
  contextLength: 1048576
}, {
  id: "claude-opus-5",
  name: "Claude Opus 5 (Free)",
  contextLength: 1000000
}, {
  id: "claude-sonnet-5",
  name: "Claude Sonnet 5 (Free)",
  contextLength: 1000000
}, {
  id: "claude-opus-4.8",
  name: "Claude Opus 4.8 (Free)",
  contextLength: 1000000
}, {
  id: "claude-opus-4.7",
  name: "Claude Opus 4.7 (Free)",
  contextLength: 1000000
}, {
  id: "claude-sonnet-4.6",
  name: "Claude Sonnet 4.6 (Free)",
  contextLength: 1000000
}, {
  id: "gpt-5-codex",
  name: "GPT-5 Codex (Free)",
  contextLength: 400000
}, {
  id: "gpt-5.2-chat-latest",
  name: "GPT-5.2 Chat (Free)",
  contextLength: 400000
}, {
  id: "gpt-5.1",
  name: "GPT-5.1 (Free)",
  contextLength: 400000
}, {
  id: "gpt-5",
  name: "GPT-5 (Free)",
  contextLength: 400000
}, {
  id: "kimi-k3",
  name: "Kimi K3 (Free)",
  contextLength: 8192
}, {
  id: "kimi-k2.6",
  name: "Kimi K2.6 (Free)",
  contextLength: 262144
}, {
  id: "kimi-k2.5",
  name: "Kimi K2.5 (Free)",
  contextLength: 262144
}, {
  id: "minimax-m2",
  name: "MiniMax M2 (Free)",
  contextLength: 204800
}, {
  id: "glm-5",
  name: "GLM 5 (Free)",
  contextLength: 200000
}, {
  id: "glm-4.7-flash",
  name: "GLM 4.7 Flash (Free)",
  contextLength: 131072
}, {
  id: "deepseek-v3.2",
  name: "DeepSeek V3.2 (Free)",
  contextLength: 163840
}, {
  id: "deepseek-r1-0528",
  name: "DeepSeek R1 (Free)",
  contextLength: 163840
}, {
  id: "qwen3-235b-a22b",
  name: "Qwen3 235B (Free)",
  contextLength: 131072
}, {
  id: "gpt-oss-120b",
  name: "GPT-OSS 120B (Free)",
  contextLength: 131072
}, {
  id: "gpt-oss-20b",
  name: "GPT-OSS 20B (Free)",
  contextLength: 131072
}],
};
