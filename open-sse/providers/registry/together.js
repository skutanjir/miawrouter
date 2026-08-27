export default {
  id: "together",
  priority: 60,
  alias: "together",
  display: {
    name: "Together AI",
    icon: "group_work",
    color: "#0F6FFF",
    textIcon: "TG",
    website: "https://www.together.ai",
    notice: {
      apiKeyUrl: "https://api.together.xyz/settings/api-keys",
    },
  },
  category: "apikey",
  hasFree: true,
  passthroughModels: true,
  authType: "apikey",
  transport: {
    baseUrl: "https://api.together.xyz/v1/chat/completions",
    validateUrl: "https://api.together.xyz/v1/models",
  },
  models: [{
  id: "moonshotai/Kimi-K3",
  name: "Kimi K3"
}, {
  id: "moonshotai/Kimi-K2.7-Code",
  name: "Kimi K2.7 Code"
}, {
  id: "moonshotai/Kimi-K2.6",
  name: "Kimi K2.6"
}, {
  id: "deepseek-ai/DeepSeek-V4-Pro-0813",
  name: "DeepSeek V4 Pro 0813"
}, {
  id: "deepseek-ai/DeepSeek-V4-Pro",
  name: "DeepSeek V4 Pro"
}, {
  id: "deepseek-ai/DeepSeek-V4-Flash-0731",
  name: "DeepSeek V4 Flash 0731"
}, {
  id: "deepseek-ai/DeepSeek-R1",
  name: "DeepSeek R1"
}, {
  id: "zai-org/GLM-5.2",
  name: "GLM-5.2"
}, {
  id: "Qwen/Qwen3.8-2.4T-A95B",
  name: "Qwen3.8 2.4T A95B"
}, {
  id: "Qwen/Qwen3.7-Plus",
  name: "Qwen3.7 Plus"
}, {
  id: "MiniMaxAI/MiniMax-M3",
  name: "MiniMax M3"
}, {
  id: "nvidia/nemotron-3-ultra-550b-a55b",
  name: "Nemotron 3 Ultra 550B"
}, {
  id: "openai/gpt-oss-120b",
  name: "GPT-OSS 120B"
}, {
  id: "openai/gpt-oss-20b",
  name: "GPT-OSS 20B"
}, {
  id: "google/gemma-4-31B-it",
  name: "Gemma 4 31B"
}, {
  id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  name: "Llama 3.3 70B Turbo"
}, {
  id: "Qwen/Qwen3-235B-A22B",
  name: "Qwen3 235B"
}, {
  id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
  name: "Llama 4 Maverick"
}, {
  id: "BAAI/bge-large-en-v1.5",
  name: "BGE Large EN v1.5",
  kind: "embedding"
}, {
  id: "togethercomputer/m2-bert-80M-8k-retrieval",
  name: "M2 BERT 80M 8K",
  kind: "embedding"
}, {
  "id": "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
  "name": "Llama 3.3 70B Turbo (🆓 Free)"
}, {
  "id": "meta-llama/Llama-Vision-Free",
  "name": "Llama Vision (🆓 Free)"
}, {
  "id": "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-Free",
  "name": "DeepSeek R1 Distill 70B (🆓 Free)"
}],
  serviceKinds: ["llm", "embedding"],
  embeddingConfig: { baseUrl: "https://api.together.xyz/v1/embeddings" },
};
