export default {
  id: "modelscope",
  alias: "modelscope",
  aliases: [
    "ms",
  ],
  uiAlias: "ModelScope",
  display: {
    name: "ModelScope Inference",
    icon: "science",
    color: "#7D32C8",
    textIcon: "MS",
    website: "https://modelscope.cn",
    notice: {
      apiKeyUrl: "https://modelscope.cn/my/myaccesstoken",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: [
    "apikey",
  ],
  transport: {
    baseUrl: "https://api-inference.modelscope.cn/v1/chat/completions",
    validateUrl: "https://api-inference.modelscope.cn/v1/models",
  },
  modelsFetcher: { url: "https://api-inference.modelscope.cn/v1/models", type: "openai" },
  models: [{
    id: "Qwen/Qwen3-235B-A22B-Instruct",
    name: "Qwen3 235B A22B Instruct (ModelScope)"
  }, {
    id: "Qwen/Qwen3-Coder-480B-A35B-Instruct",
    name: "Qwen3 Coder 480B A35B (ModelScope)",
    contextLength: 262144
  }, {
    id: "deepseek-ai/DeepSeek-V3.1",
    name: "DeepSeek V3.1 (ModelScope)"
  }, {
    id: "ZhipuAI/GLM-4.7",
    name: "GLM 4.7 (ModelScope)"
  }, {
    id: "moonshotai/Kimi-K2.6",
    name: "Kimi K2.6 (ModelScope)"
  }],
};
