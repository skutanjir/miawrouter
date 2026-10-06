export default {
  id: "arcee-ai",
  alias: "arcee",
  aliases: ["arcee"],
  uiAlias: "arcee",
  display: {
    name: "Arcee AI",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "AR",
    website: "https://arcee.ai",
    notice: {
      apiKeyUrl: "https://platform.arcee.ai/api/api-keys",
    },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.arcee.ai/api/v1/chat/completions",
    validateUrl: "https://api.arcee.ai/api/v1/models",
  },
  modelsFetcher: { url: "https://api.arcee.ai/api/v1/models", type: "openai" },
  models: [
    { id: "arcee-ai/trinity-large-preview:free", name: "Trinity Large Preview (free)", contextLength: 262000 },
  ],
  passthroughModels: true,
};
