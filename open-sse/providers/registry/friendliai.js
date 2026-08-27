export default {
  id: "friendliai",
  alias: "friendli",
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  display: {
    name: "FriendliAI",
    icon: "handshake",
    color: "#EC4899",
    textIcon: "FR",
    website: "https://friendli.ai",
  },
  transport: {
    baseUrl: "https://api.friendli.ai/serverless/v1/chat/completions",
    validateUrl: "https://api.friendli.ai/serverless/v1/models",
  },
  modelsFetcher: { url: "https://api.friendli.ai/serverless/v1/models", type: "openai" },
  // Live serverless catalog verified 2026-08-26.
  models: [
    { id: "zai-org/GLM-5.2", name: "GLM 5.2" },
    { id: "zai-org/GLM-5.1", name: "GLM 5.1" },
    { id: "deepseek-ai/DeepSeek-V3.2", name: "DeepSeek V3.2" },
    { id: "MiniMaxAI/MiniMax-M2.5", name: "MiniMax M2.5" },
    { id: "google/gemma-4-31B-it", name: "Gemma 4 31B IT" },
    { id: "LGAI-EXAONE/K-EXAONE-2.0-750B-A37B", name: "K-EXAONE 2.0 750B A37B" },
  ],
  passthroughModels: true,
};
