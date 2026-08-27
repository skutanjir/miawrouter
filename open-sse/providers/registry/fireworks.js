export default {
  id: "fireworks",
  priority: 50,
  alias: "fireworks",
  display: {
    name: "Fireworks AI",
    icon: "local_fire_department",
    color: "#7B2EF2",
    textIcon: "FW",
    website: "https://fireworks.ai",
    notice: {
      apiKeyUrl: "https://fireworks.ai/account/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  transport: {
    baseUrl: "https://api.fireworks.ai/inference/v1/chat/completions",
    validateUrl: "https://api.fireworks.ai/inference/v1/models",
  },
  models: [{
  id: "kimi-k3",
  name: "Kimi K3"
}, {
  id: "kimi-k2p7-code",
  name: "Kimi K2.7 Code"
}, {
  id: "kimi-k2p6",
  name: "Kimi K2.6"
}, {
  id: "deepseek-v4-pro-0813",
  name: "DeepSeek V4 Pro 0813"
}, {
  id: "deepseek-v4-pro",
  name: "DeepSeek V4 Pro",
  "supportsReasoning": true
}, {
  id: "deepseek-v4-flash",
  name: "DeepSeek V4 Flash",
  supportsReasoning: true
}, {
  id: "deepseek-v4-flash-0731",
  name: "DeepSeek V4 Flash (0731)",
  "supportsReasoning": true
}, {
  id: "glm-5p2",
  name: "GLM 5.2"
}, {
  id: "glm-5p1",
  name: "GLM 5.1"
}, {
  id: "qwen3p7-plus",
  name: "Qwen3.7 Plus"
}, {
  id: "step-3p7-flash-nvfp4",
  name: "Step 3.7 Flash NVFP4"
}, {
  id: "gpt-oss-120b",
  name: "OpenAI gpt-oss-120b"
}, {
  id: "gpt-oss-20b",
  name: "OpenAI gpt-oss-20b"
}, {
  id: "nomic-ai/nomic-embed-text-v1.5",
  name: "Nomic Embed Text v1.5",
  kind: "embedding"
}, {
  "id": "kimi-k2p5",
  "name": "Kimi K2.5"
}, {
  "id": "minimax-m2p5",
  "name": "MiniMax M2.5"
}, {
  "id": "minimax-m2p7",
  "name": "MiniMax M2.7"
}, {
  "id": "qwen3p6-plus",
  "name": "Qwen3.6 Plus"
}],
  serviceKinds: ["llm", "embedding"],
  embeddingConfig: { baseUrl: "https://api.fireworks.ai/inference/v1/embeddings" },
};
