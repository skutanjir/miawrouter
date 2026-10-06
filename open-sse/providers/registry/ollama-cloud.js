export default {
  id: "ollama-cloud",
  alias: "ollamacloud",
  aliases: ["ollama-cloud", "ollama.com"],
  uiAlias: "ollamacloud",
  display: {
    name: "Ollama Cloud",
    icon: "cloud",
    color: "#58A6FF",
    textIcon: "OC",
    website: "https://ollama.com/settings/keys",
    notice: { apiKeyUrl: "https://ollama.com/settings/keys" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://ollama.com/v1/chat/completions",
    validateUrl: "https://ollama.com/v1/models",
  },
  modelsFetcher: { url: "https://ollama.com/v1/models", type: "openai" },
  passthroughModels: true,
};
