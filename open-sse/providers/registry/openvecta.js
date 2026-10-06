export default {
  id: "openvecta",
  alias: "openvecta",
  uiAlias: "openvecta",
  display: {
    name: "OpenVecta",
    icon: "vector_polygon",
    color: "#7C3AED",
    textIcon: "OV",
    website: "https://openvecta.com",
    notice: { apiKeyUrl: "https://openvecta.com" },
  },
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authModes: ["apikey"],
  transport: {
    baseUrl: "https://api.openvecta.com/v1/chat/completions",
    validateUrl: "https://api.openvecta.com/v1/models",
  },
  modelsFetcher: { url: "https://api.openvecta.com/v1/models", type: "openai" },
  passthroughModels: true,
};
