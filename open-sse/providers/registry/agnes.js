export default {
  id: "agnes",
  alias: "agnes",
  aliases: ["agnes-ai", "sapiens-ai"],
  uiAlias: "agnes",
  display: {
    name: "Agnes AI",
    icon: "auto_awesome",
    color: "#10B981",
    textIcon: "AG",
    website: "https://agnes-ai.com",
    notice: {
      apiKeyUrl: "https://platform.agnes-ai.com",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://apihub.agnes-ai.com/v1/chat/completions",
    validateUrl: "https://apihub.agnes-ai.com/v1/models",
  },
  modelsFetcher: { url: "https://apihub.agnes-ai.com/v1/models", type: "openai" },
  models: [
    { id: "agnes-2.5-flash", name: "Agnes 2.5 Flash", contextLength: 512000 },
    { id: "agnes-2.0-flash", name: "Agnes 2.0 Flash", contextLength: 256000 },
  ],
};
