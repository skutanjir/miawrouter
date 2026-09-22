export default {
  id: "bazaarlink",
  alias: "bzl",
  aliases: ["bazaar-link"],
  uiAlias: "bzl",
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  display: {
    name: "Bazaarlink",
    icon: "storefront",
    color: "#DC2626",
    textIcon: "BZ",
    website: "https://bazaarlink.ai",
    notice: { apiKeyUrl: "https://bazaarlink.ai" },
  },
  transport: {
    baseUrl: "https://bazaarlink.ai/api/v1/chat/completions",
    validateUrl: "https://bazaarlink.ai/api/v1/models",
  },
  modelsFetcher: { url: "https://bazaarlink.ai/api/v1/models", type: "openai" },
  models: [{
  id: "auto:free",
  name: "Auto Free (Zero Cost)"
}, {
  id: "claude-opus-4.6",
  name: "Claude Opus 4.6",
  contextLength: 1000000
}, {
  id: "claude-sonnet-4.6",
  name: "Claude Sonnet 4.6",
  contextLength: 1000000
}, {
  id: "claude-opus-4.7",
  name: "Claude Opus 4.7",
  contextLength: 1000000
}, {
  id: "claude-haiku-4.5",
  name: "Claude Haiku 4.5",
  contextLength: 200000
}, {
  id: "gpt-5.5",
  name: "GPT-5.5",
  contextLength: 1050000
}, {
  id: "gpt-5.4",
  name: "GPT-5.4",
  contextLength: 1050000
}, {
  id: "gpt-5.3-codex",
  name: "GPT-5.3 Codex",
  contextLength: 400000
}, {
  id: "grok-4.7",
  name: "Grok 4.7",
  contextLength: 500000
}, {
  id: "grok-4.20",
  name: "Grok 4.20",
  contextLength: 2000000
}, {
  id: "gemini-3.1-pro-preview",
  name: "Gemini 3.1 Pro",
  contextLength: 1048576
}, {
  id: "gemini-3-flash-preview",
  name: "Gemini 3 Flash",
  contextLength: 1048576
}, {
  id: "gemini-3.1-flash-lite-preview",
  name: "Gemini 3.1 Flash Lite",
  contextLength: 1048576
}, {
  id: "kimi-k3",
  name: "Kimi K3",
  contextLength: 262144
}, {
  id: "kimi-k2.7-code",
  name: "Kimi K2.7 Code",
  contextLength: 262144
}, {
  id: "kimi-k2.6",
  name: "Kimi K2.6",
  contextLength: 262144
}, {
  id: "glm-5.2",
  name: "GLM 5.2",
  contextLength: 204800
}, {
  id: "glm-5.1",
  name: "GLM 5.1",
  contextLength: 204800
}, {
  id: "glm-5",
  name: "GLM 5",
  contextLength: 204800
}, {
  id: "deepseek-v4-pro",
  name: "DeepSeek V4 Pro"
}, {
  id: "deepseek-v4-flash",
  name: "DeepSeek V4 Flash"
}, {
  id: "deepseek-v3.2",
  name: "DeepSeek V3.2"
}, {
  id: "minimax-m3",
  name: "MiniMax M3",
  contextLength: 1048576
}, {
  id: "minimax-m2.7",
  name: "MiniMax M2.7",
  contextLength: 204800
}, {
  id: "qwen3.8-max",
  name: "Qwen 3.8 Max"
}, {
  id: "qwen3.7-max",
  name: "Qwen 3.7 Max"
}, {
  id: "qwen3.6-plus",
  name: "Qwen 3.6 Plus",
  contextLength: 1000000
}, {
  id: "seed-1.6",
  name: "Seed 1.6"
}, {
  id: "nemotron-3-super-120b-a12b",
  name: "Nemotron 3 Super",
  contextLength: 1000000
}, {
  id: "mimo-v2.6-pro",
  name: "MiMo-V2.6-Pro",
  contextLength: 1050000
}, {
  id: "mimo-v2.6-flash",
  name: "MiMo-V2.6-Flash",
  contextLength: 1050000
}, {
  id: "mimo-v2.5-pro",
  name: "MiMo-V2.5-Pro",
  contextLength: 1050000
}, {
  id: "mimo-v2.5",
  name: "MiMo-V2.5",
  contextLength: 1050000
}, {
  "id": "gemma-4-31b-it",
  "name": "Gemma 4 31B"
}, {
  "id": "gemma-4-26b-a4b-it",
  "name": "Gemma 4 26B A4B"
}, {
  "id": "llama-4-maverick",
  "name": "Llama 4 Maverick"
}, {
  "id": "llama-4-scout",
  "name": "Llama 4 Scout"
}, {
  "id": "llama-3.3-70b-instruct",
  "name": "Llama 3.3 70B"
}, {
  "id": "mistral-large-2512",
  "name": "Mistral Large 3"
}],
};
