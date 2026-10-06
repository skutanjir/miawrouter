export default {
  id: "sealion",
  alias: "sealion",
  aliases: ["sea-lion"],
  uiAlias: "sealion",
  display: {
    name: "SEA-LION",
    icon: "public",
    color: "#0D9488",
    textIcon: "SL",
    website: "https://sea-lion.ai",
    notice: { apiKeyUrl: "https://sea-lion.ai" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.sea-lion.ai/v1/chat/completions",
    validateUrl: "https://api.sea-lion.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.sea-lion.ai/v1/models", type: "openai" },
  passthroughModels: true,
};
