export default {
  id: "doubao",
  alias: "doubao",
  uiAlias: "doubao",
  display: {
    name: "Doubao",
    icon: "auto_awesome",
    color: "#FE2C55",
    textIcon: "DB",
    website: "https://doubao.com",
    notice: { apiKeyUrl: "https://console.volcengine.com" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    validateUrl: "https://ark.cn-beijing.volces.com/api/v3/models",
  },
  modelsFetcher: { url: "https://ark.cn-beijing.volces.com/api/v3/models", type: "openai" },
  passthroughModels: true,
};
