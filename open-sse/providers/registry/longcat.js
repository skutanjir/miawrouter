export default {
  id: "longcat",
  alias: "lc",
  aliases: ["long-cat"],
  uiAlias: "lc",
  display: {
    name: "LongCat AI",
    icon: "auto_awesome",
    color: "#FF6B9D",
    textIcon: "LC",
    website: "https://longcat.chat/platform/docs",
    notice: {
      apiKeyUrl: "https://longcat.chat/platform/",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.longcat.chat/openai/v1/chat/completions",
    validateUrl: "https://api.longcat.chat/openai/v1/models",
  },
  modelsFetcher: { url: "https://api.longcat.chat/openai/v1/models", type: "openai" },
  models: [
    { id: "LongCat-2.5-Preview", name: "LongCat 2.5 Preview", contextLength: 1000000 },
    { id: "LongCat-2.0", name: "LongCat 2.0", contextLength: 1000000 },
  ],
};
