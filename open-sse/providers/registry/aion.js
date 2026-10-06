export default {
  id: "aion",
  alias: "aion",
  aliases: ["aion-labs"],
  uiAlias: "aion",
  display: {
    name: "Aion Labs",
    icon: "hub",
    color: "#0EA5E9",
    textIcon: "AI",
    website: "https://www.aionlabs.ai",
    notice: {
      apiKeyUrl: "https://www.aionlabs.ai/app/api-keys/",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.aionlabs.ai/v1/chat/completions",
    validateUrl: "https://api.aionlabs.ai/v1/models",
  },
  modelsFetcher: { url: "https://api.aionlabs.ai/v1/models", type: "openai" },
  models: [
    { id: "aion-labs/aion-3.0", name: "Aion 3.0" },
    { id: "aion-labs/aion-3.0-mini", name: "Aion 3.0 Mini" },
    { id: "aion-labs/aion-2.5", name: "Aion 2.5" },
    { id: "aion-labs/aion-2.0", name: "Aion 2.0" },
    { id: "aion-labs/aion-rp-llama-3.1-8b", name: "Aion RP Llama 3.1 8B" },
  ],
};
