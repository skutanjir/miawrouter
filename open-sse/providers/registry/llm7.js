export default {
  id: "llm7",
  alias: "llm7",
  aliases: [
    "llm-7",
  ],
  uiAlias: "llm7",
  display: {
    name: "LLM7",
    icon: "pool",
    color: "#7C3AED",
    textIcon: "L7",
    website: "https://llm7.io",
    notice: {
      apiKeyUrl: "https://llm7.io",
    },
  },
  category: "apikey",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://api.llm7.io/v1/chat/completions",
    validateUrl: "https://api.llm7.io/v1/models",
  },
  modelsFetcher: { url: "https://api.llm7.io/v1/models", type: "openai" },
  models: [{
  id: "gpt-5.6-sol",
  name: "GPT-5.6 Sol (LLM7)",
  contextLength: 1000000
}, {
  id: "gpt-5.6-terra",
  name: "GPT-5.6 Terra (LLM7)",
  contextLength: 1000000
}, {
  id: "gpt-5.5",
  name: "GPT-5.5 (LLM7)",
  contextLength: 1050000
}, {
  id: "gpt-5.4",
  name: "GPT-5.4 (LLM7)",
  contextLength: 1050000
}, {
  id: "claude-opus-5",
  name: "Claude Opus 5 (LLM7)",
  contextLength: 1000000
}, {
  id: "claude-fable-5",
  name: "Claude Fable 5 (LLM7)",
  contextLength: 1000000
}, {
  id: "claude-opus-4-8",
  name: "Claude Opus 4.8 (LLM7)",
  contextLength: 1000000
}, {
  id: "claude-sonnet-5",
  name: "Claude Sonnet 5 (LLM7)",
  contextLength: 1000000
}, {
  id: "claude-sonnet-4-6",
  name: "Claude Sonnet 4.6 (LLM7)",
  contextLength: 1000000
}, {
  id: "claude-haiku-4-5",
  name: "Claude Haiku 4.5 (LLM7)",
  contextLength: 200000
}, {
  id: "gemini-3.7-flash",
  name: "Gemini 3.7 Flash (LLM7)",
  contextLength: 1000000
}, {
  id: "gemini-3-flash",
  name: "Gemini 3 Flash (LLM7)",
  contextLength: 1048576
}, {
  id: "gemini-3.5-flash-low",
  name: "Gemini 3.5 Flash Low (LLM7)",
  contextLength: 1040000
}, {
  id: "gemini-3.1-flash-lite",
  name: "Gemini 3.1 Flash Lite (LLM7)",
  contextLength: 256000
}, {
  id: "glm-5.3",
  name: "GLM 5.3 (LLM7)",
  contextLength: 1000000
}, {
  id: "grok-4.7",
  name: "Grok 4.7 (LLM7)",
  contextLength: 500000
}, {
  id: "grok-4.6",
  name: "Grok 4.6 (LLM7)",
  contextLength: 500000
}, {
  id: "grok-4.5",
  name: "Grok 4.5 (LLM7)",
  contextLength: 500000
}, {
  id: "deepseek-v4-flash:0731",
  name: "DeepSeek V4 Flash (LLM7)",
  contextLength: 1000000
}, {
  id: "DeepSeek-V4-Flash-0731",
  name: "DeepSeek V4 Flash 0731 (LLM7)",
  contextLength: 400000
}, {
  id: "kimi-k2.6",
  name: "Kimi K2.6 (LLM7)",
  contextLength: 240000
}, {
  id: "minimax-m2.7",
  name: "MiniMax M2.7 (LLM7)",
  contextLength: 180000
}, {
  id: "XiaomiMiMo/MiMo-V2.5-Pro",
  name: "MiMo V2.5 Pro (LLM7)",
  contextLength: 1024000
}, {
  id: "XiaomiMiMo/MiMo-V2.5",
  name: "MiMo V2.5 (LLM7)",
  contextLength: 256000
}, {
  id: "Inkling",
  name: "Inkling (LLM7)",
  contextLength: 512000
}, {
  id: "Inkling-Small",
  name: "Inkling Small (LLM7)",
  contextLength: 512000
}, {
  id: "seed-2.0-mini",
  name: "Seed 2.0 Mini (LLM7)",
  contextLength: 250000
}, {
  id: "gemma4:31b",
  name: "Gemma 4 31B (LLM7)",
  contextLength: 262000
}, {
  id: "meta-Llama-3.1-8B-Instruct-Turbo",
  name: "Llama 3.1 8B Instruct Turbo (LLM7)",
  contextLength: 128000
}, {
  id: "mistral-Nemo-Instruct-2407",
  name: "Mistral Nemo (LLM7)",
  contextLength: 128000
}],
  passthroughModels: true,
};
