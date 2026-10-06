export default {
  id: "novita",
  alias: "novita",
  aliases: ["novita-ai"],
  uiAlias: "novita",
  display: {
    name: "Novita AI",
    icon: "auto_awesome",
    color: "#FF4081",
    textIcon: "NV",
    website: "https://novita.ai",
    notice: {
      apiKeyUrl: "https://novita.ai/settings/key-management",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.novita.ai/openai/v1/chat/completions",
    validateUrl: "https://api.novita.ai/openai/v1/models",
  },
  modelsFetcher: { url: "https://api.novita.ai/openai/v1/models", type: "openai" },
  passthroughModels: true,
};
