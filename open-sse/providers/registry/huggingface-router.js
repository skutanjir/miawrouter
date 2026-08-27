export default {
  id: "huggingface-router",
  alias: "hf-router",
  aliases: [
    "huggingface-router",
    "hf-router",
  ],
  uiAlias: "HF",
  display: {
    name: "Hugging Face Router",
    icon: "hub",
    color: "#FFD21E",
    textIcon: "HF",
    website: "https://huggingface.co/docs/hub/en/inference-providers",
    notice: {
      apiKeyUrl: "https://huggingface.co/settings/tokens",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://router.huggingface.co/v1/chat/completions",
    validateUrl: "https://router.huggingface.co/v1/models",
  },
  modelsFetcher: { url: "https://router.huggingface.co/v1/models", type: "openai" },
  models: [{
    id: "openai/gpt-oss-120b",
    name: "GPT-OSS 120B (HF Router)"
  }, {
    id: "openai/gpt-oss-20b",
    name: "GPT-OSS 20B (HF Router)"
  }, {
    id: "deepseek-ai/DeepSeek-V3.1",
    name: "DeepSeek V3.1 (HF Router)"
  }, {
    id: "Qwen/Qwen3-235B-A22B-Instruct",
    name: "Qwen3 235B A22B Instruct (HF Router)"
  }, {
    id: "meta-llama/Llama-3.3-70B-Instruct",
    name: "Llama 3.3 70B Instruct (HF Router)",
    contextLength: 131072
  }, {
    id: "zai-org/GLM-4.7",
    name: "GLM 4.7 (HF Router)"
  }],
};
