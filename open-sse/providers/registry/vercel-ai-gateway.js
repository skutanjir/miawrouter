export default {
  id: "vercel-ai-gateway",
  priority: 160,
  alias: "vercel-ai-gateway",
  aliases: [
    "vercel",
  ],
  uiAlias: "vercel",
  display: {
    name: "Vercel AI Gateway",
    icon: "deployed_code",
    color: "#111827",
    textIcon: "VG",
    website: "https://vercel.com/ai-gateway",
    notice: {
      text: "Unified OpenAI-compatible endpoint from Vercel. Use your AI Gateway API key, then pick models with provider/model IDs like anthropic/claude-sonnet-4.6 or openai/gpt-5.4.",
      apiKeyUrl: "https://vercel.com/dashboard/~/ai-gateway",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://ai-gateway.vercel.sh/v1/chat/completions",
    thinkingFormat: "openai",
    retry: {
      "429": 2,
    },
    usage: {
      url: "https://ai-gateway.vercel.sh/v1/credits",
    },
  },
  serviceKinds: ["llm","embedding","image","imageToText","webSearch"],
  embeddingConfig: { baseUrl: "https://ai-gateway.vercel.sh/v1/embeddings" },
  imageConfig: { baseUrl: "https://ai-gateway.vercel.sh/v1/images/generations" },
  searchViaChat: { defaultModel: "openai/gpt-4o-mini", pricingUrl: "https://vercel.com/docs/ai-gateway/pricing" },
  modelsFetcher: { url: "https://ai-gateway.vercel.sh/v1/models", type: "openai" },
  models: [
    { id: "openai/gpt-5.6-luna", name: "openai/gpt-5.6-luna" },
    { id: "openai/gpt-5.4", name: "openai/gpt-5.4" },
    { id: "anthropic/claude-opus-4.8", name: "anthropic/claude-opus-4.8" },
    { id: "anthropic/claude-sonnet-4.6", name: "anthropic/claude-sonnet-4.6" },
    { id: "google/gemini-3.1-pro-preview", name: "google/gemini-3.1-pro-preview" },
    { id: "google/gemini-3.6-flash", name: "google/gemini-3.6-flash" },
    { id: "moonshotai/kimi-k3", name: "moonshotai/kimi-k3" },
    { id: "zai/glm-5.2", name: "zai/glm-5.2" },
    { id: "deepseek/deepseek-v4-flash", name: "deepseek/deepseek-v4-flash" },
  ],
  passthroughModels: true,
  features: {
    usage: true,
    usageApikey: true,
  },
};
