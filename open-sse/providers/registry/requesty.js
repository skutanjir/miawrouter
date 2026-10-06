export default {
  id: "requesty",
  alias: "requesty",
  aliases: ["requesty-router"],
  uiAlias: "requesty",
  display: {
    name: "Requesty",
    icon: "router",
    color: "#6366F1",
    textIcon: "RQ",
    website: "https://requesty.ai",
    notice: {
      apiKeyUrl: "https://app.requesty.ai/api-keys",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://router.requesty.ai/v1/chat/completions",
    validateUrl: "https://router.requesty.ai/v1/models",
  },
  modelsFetcher: { url: "https://router.requesty.ai/v1/models", type: "openai" },
  passthroughModels: true,
};
