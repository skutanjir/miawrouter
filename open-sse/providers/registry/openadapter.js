export default {
  id: "openadapter",
  alias: "oad",
  aliases: ["open-adapter"],
  uiAlias: "oad",
  display: {
    name: "OpenAdapter",
    icon: "hub",
    color: "#10B981",
    textIcon: "OD",
    website: "https://openadapter.dev",
    notice: { apiKeyUrl: "https://dashboard.openadapter.in" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.openadapter.in/v1/chat/completions",
    validateUrl: "https://api.openadapter.in/v1/models",
  },
  modelsFetcher: { url: "https://api.openadapter.in/v1/models", type: "openai" },
  passthroughModels: true,
};
