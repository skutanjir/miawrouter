export default {
  id: "typhoon",
  alias: "typhoon",
  aliases: ["opentyphoon", "typhoon-ai"],
  uiAlias: "typhoon",
  display: {
    name: "Typhoon",
    icon: "public",
    color: "#7C3AED",
    textIcon: "TY",
    website: "https://docs.opentyphoon.ai",
    notice: {
      apiKeyUrl: "https://playground.opentyphoon.ai",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.opentyphoon.ai/v1/chat/completions",
    validateUrl: "https://api.opentyphoon.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.opentyphoon.ai/v1/models", type: "openai" },
  models: [
    { id: "typhoon-v2.5-30b-a3b-instruct", name: "Typhoon 2.5 30B A3B Instruct" },
    { id: "typhoon-v2.1-12b-instruct", name: "Typhoon 2.1 12B Instruct" },
  ],
  passthroughModels: true,
};
