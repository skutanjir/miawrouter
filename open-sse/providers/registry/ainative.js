export default {
  id: "ainative",
  alias: "ainative",
  aliases: ["ai-native", "ainative-studio"],
  uiAlias: "ainative",
  display: {
    name: "AINative Studio",
    icon: "hub",
    color: "#7C3AED",
    textIcon: "AN",
    website: "https://ainative.studio",
    notice: { apiKeyUrl: "https://ainative.studio" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.ainative.studio/v1/chat/completions",
    validateUrl: "https://api.ainative.studio/v1/models",
  },
  modelsFetcher: { url: "https://api.ainative.studio/v1/models", type: "openai" },
  passthroughModels: true,
};
