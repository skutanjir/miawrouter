export default {
  id: "sarvam",
  alias: "sarvam",
  aliases: ["sarvam-ai"],
  uiAlias: "sarvam",
  display: {
    name: "Sarvam AI",
    icon: "public",
    color: "#0EA5E9",
    textIcon: "SV",
    website: "https://docs.sarvam.ai",
    notice: { apiKeyUrl: "https://dashboard.sarvam.ai" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.sarvam.ai/v1/chat/completions",
    validateUrl: "https://api.sarvam.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.sarvam.ai/v1/models", type: "openai" },
  models: [
    { id: "sarvam-105b", name: "Sarvam 105B" },
    { id: "sarvam-105b-conversations", name: "Sarvam 105B Conversations" },
  ],
};
