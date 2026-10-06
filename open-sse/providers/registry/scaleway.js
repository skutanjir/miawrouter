export default {
  id: "scaleway",
  alias: "scw",
  aliases: ["scaleway-ai"],
  uiAlias: "scw",
  display: {
    name: "Scaleway AI",
    icon: "cloud",
    color: "#4F0599",
    textIcon: "SCW",
    website: "https://www.scaleway.com/en/docs/ai-data/generative-apis/",
    notice: { apiKeyUrl: "https://console.scaleway.com" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.scaleway.ai/v1/chat/completions",
    validateUrl: "https://api.scaleway.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.scaleway.ai/v1/models", type: "openai" },
  passthroughModels: true,
};
