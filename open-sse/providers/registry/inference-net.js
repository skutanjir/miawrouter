export default {
  id: "inference-net",
  alias: "inet",
  aliases: ["inference"],
  uiAlias: "inet",
  display: {
    name: "Inference.net",
    icon: "dns",
    color: "#2563EB",
    textIcon: "IN",
    website: "https://inference.net",
    notice: { apiKeyUrl: "https://inference.net" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.inference.net/v1/chat/completions",
    validateUrl: "https://api.inference.net/v1/models",
  },
  modelsFetcher: { url: "https://api.inference.net/v1/models", type: "openai" },
  passthroughModels: true,
};
