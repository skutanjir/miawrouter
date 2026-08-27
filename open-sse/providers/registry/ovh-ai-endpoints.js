export default {
  id: "ovh-ai-endpoints",
  alias: "ovh",
  aliases: [
    "ovhcloud",
    "ovh-ai",
  ],
  uiAlias: "ovh",
  display: {
    name: "OVHcloud AI Endpoints",
    icon: "cloud_queue",
    color: "#200F58",
    textIcon: "OVH",
    website: "https://endpoints.ai.cloud.ovh.net",
    notice: {
      apiKeyUrl: "https://console.ovh.com",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions",
    validateUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models",
  },
  modelsFetcher: { url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models", type: "openai" },
  models: [{
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B (OVHcloud)"
  }, {
    id: "gpt-oss-20b",
    name: "GPT-OSS 20B (OVHcloud)"
  }, {
    id: "qwen3.6-27b",
    name: "Qwen3.6 27B (OVHcloud)"
  }, {
    id: "qwen3.5-397b-a17b",
    name: "Qwen3.5 397B A17B (OVHcloud)"
  }, {
    id: "Meta-Llama-3_3_70B-Instruct",
    name: "Llama 3.3 70B Instruct (OVHcloud)",
    contextLength: 131072
  }, {
    id: "Qwen2.5-VL-72B-Instruct",
    name: "Qwen2.5 VL 72B Instruct (OVHcloud)"
  }],
};
