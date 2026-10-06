export default {
  id: "routeway",
  alias: "rw",
  aliases: ["routeway-ai"],
  uiAlias: "rw",
  display: {
    name: "Routeway",
    icon: "hub",
    color: "#F59E0B",
    textIcon: "RW",
    website: "https://routeway.ai",
    notice: {
      apiKeyUrl: "https://routeway.ai",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.routeway.ai/v1/chat/completions",
    validateUrl: "https://api.routeway.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.routeway.ai/v1/models", type: "openai" },
  passthroughModels: true,
};
