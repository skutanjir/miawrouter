export default {
  id: "cerebras",
  priority: 60,
  alias: "cerebras",
  display: {
    name: "Cerebras",
    icon: "memory",
    color: "#FF4F00",
    textIcon: "CB",
    website: "https://www.cerebras.ai",
    notice: {
      apiKeyUrl: "https://cloud.cerebras.ai/platform",
    },
  },
  category: "freeTier",
  hasFree: true,
  transport: {
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    validateUrl: "https://api.cerebras.ai/v1/models",
    quirks: {
      dropClientMetadata: true,
    },
  },
  models: [
    { id: "gpt-oss-120b", name: "GPT OSS 120B" },
    { id: "gemma-4-31b", name: "Gemma 4 31B" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", isFreeTier: true },
    { id: "llama3.1-8b", name: "Llama 3.1 8B", isFreeTier: true },
    { id: "zai-glm-4.7", name: "ZAI GLM 4.7" },
    { id: "llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout" },
  ],
  passthroughModels: true,
};
