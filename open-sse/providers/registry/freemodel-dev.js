export default {
  id: "freemodel-dev",
  alias: "fmd",
  aliases: ["freemodel"],
  uiAlias: "fmd",
  display: {
    name: "FreeModel.dev",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "FM",
    website: "https://freemodel.dev",
    notice: { apiKeyUrl: "https://freemodel.dev" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.freemodel.dev/v1/chat/completions",
    validateUrl: "https://api.freemodel.dev/v1/models",
  },
  modelsFetcher: { url: "https://api.freemodel.dev/v1/models", type: "openai" },
  passthroughModels: true,
};
