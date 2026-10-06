export default {
  id: "publicai",
  alias: "publicai",
  uiAlias: "publicai",
  display: {
    name: "PublicAI",
    icon: "public",
    color: "#059669",
    textIcon: "PA",
    website: "https://publicai.co",
    notice: { apiKeyUrl: "https://publicai.co" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.publicai.co/v1/chat/completions",
    validateUrl: "https://api.publicai.co/v1/models",
  },
  modelsFetcher: { url: "https://api.publicai.co/v1/models", type: "openai" },
  passthroughModels: true,
};
