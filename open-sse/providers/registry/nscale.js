export default {
  id: "nscale",
  alias: "nscale",
  uiAlias: "nscale",
  display: {
    name: "nScale",
    icon: "token",
    color: "#0891B2",
    textIcon: "NS",
    website: "https://nscale.com",
    notice: { apiKeyUrl: "https://console.nscale.com" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://inference.api.nscale.com/v1/chat/completions",
    validateUrl: "https://inference.api.nscale.com/v1/models",
  },
  modelsFetcher: { url: "https://inference.api.nscale.com/v1/models", type: "openai" },
  passthroughModels: true,
};
