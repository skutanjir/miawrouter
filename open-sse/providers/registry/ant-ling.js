export default {
  id: "ant-ling",
  alias: "ling",
  aliases: ["antling", "ant-ling-ring"],
  uiAlias: "ling",
  display: {
    name: "Ant Ling / Ring (inclusionAI)",
    icon: "auto_awesome",
    color: "#1677FF",
    textIcon: "AL",
    website: "https://developer.ant-ling.com/en/docs/",
    notice: { apiKeyUrl: "https://chat.ant-ling.com/open" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.ant-ling.com/v1/chat/completions",
    validateUrl: "https://api.ant-ling.com/v1/models",
  },
  modelsFetcher: { url: "https://api.ant-ling.com/v1/models", type: "openai" },
  passthroughModels: true,
};
