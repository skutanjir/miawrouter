export default {
  id: "hcnsec",
  alias: "hcnsec",
  uiAlias: "hcnsec",
  display: {
    name: "Huancheng Public API",
    icon: "security",
    color: "#0EA5E9",
    textIcon: "HC",
    website: "https://api.hcnsec.cn",
    notice: { apiKeyUrl: "https://api.hcnsec.cn" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.hcnsec.cn/v1/chat/completions",
    validateUrl: "https://api.hcnsec.cn/v1/models",
  },
  modelsFetcher: { url: "https://api.hcnsec.cn/v1/models", type: "openai" },
  passthroughModels: true,
};
