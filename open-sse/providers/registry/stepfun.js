export default {
  id: "stepfun",
  alias: "stepfun",
  aliases: ["step-fun"],
  uiAlias: "stepfun",
  display: {
    name: "StepFun",
    icon: "auto_awesome",
    color: "#8B5CF6",
    textIcon: "SF",
    website: "https://stepfun.com",
    notice: { apiKeyUrl: "https://platform.stepfun.com" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.stepfun.com/v1/chat/completions",
    validateUrl: "https://api.stepfun.com/v1/models",
  },
  modelsFetcher: { url: "https://api.stepfun.com/v1/models", type: "openai" },
  passthroughModels: true,
};
