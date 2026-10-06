export default {
  id: "baichuan",
  alias: "baichuan",
  uiAlias: "baichuan",
  display: {
    name: "Baichuan",
    icon: "auto_awesome",
    color: "#6366F1",
    textIcon: "BC",
    website: "https://baichuan.com",
    notice: { apiKeyUrl: "https://platform.baichuan-ai.com" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.baichuan-ai.com/v1/chat/completions",
    validateUrl: "https://api.baichuan-ai.com/v1/models",
  },
  modelsFetcher: { url: "https://api.baichuan-ai.com/v1/models", type: "openai" },
  passthroughModels: true,
};
