export default {
  id: "dgrid",
  alias: "dgrid",
  uiAlias: "dgrid",
  display: {
    name: "DGrid",
    icon: "router",
    color: "#65A30D",
    textIcon: "DG",
    website: "https://dgrid.ai",
    notice: { apiKeyUrl: "https://dgrid.ai" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.dgrid.ai/v1/chat/completions",
    validateUrl: "https://api.dgrid.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.dgrid.ai/v1/models", type: "openai" },
  passthroughModels: true,
};
