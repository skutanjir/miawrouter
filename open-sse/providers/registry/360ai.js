export default {
  id: "360ai",
  alias: "360ai",
  aliases: ["360-ai"],
  uiAlias: "360ai",
  display: {
    name: "360 AI",
    icon: "auto_awesome",
    color: "#00B96B",
    textIcon: "360",
    website: "https://ai.360.cn",
    notice: { apiKeyUrl: "https://ai.360.cn" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.360.cn/v1/chat/completions",
    validateUrl: "https://api.360.cn/v1/models",
  },
  modelsFetcher: { url: "https://api.360.cn/v1/models", type: "openai" },
  passthroughModels: true,
};
