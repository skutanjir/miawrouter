export default {
  id: "opencode",
  priority: 40,
  hasFree: true,
  alias: "oc",
  uiAlias: "oc",
  display: {
    name: "OpenCode Free",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
  },
  category: "free",
  noAuth: true,
  transport: {
    baseUrl: "https://opencode.ai",
    headers: {
      "x-opencode-client": "desktop",
    },
    noAuth: true,
  },
  models: [
    {
      id: "big-pickle",
      name: "Big Pickle",
      supportsReasoning: true,
      interleavedField: "reasoning_content",
      isFreeTier: true
    },
    {
      id: "deepseek-v4-flash-free",
      name: "DeepSeek V4 Flash Free",
      supportsReasoning: true,
      isFreeTier: true
    },
    {
      id: "muse-spark-1.2-contributor-free",
      name: "Muse Spark 1.2 Contributor Free",
      contextLength: 1048576,
      isFreeTier: true
    },
    {
      id: "mimo-v2.5-free",
      name: "MiMo V2.5 Free",
      contextLength: 131000,
      isFreeTier: true
    },
    {
      id: "ling-3.0-flash-fin-free",
      name: "Ling 3.0 Flash Fin Free",
      contextLength: 131000,
      isFreeTier: true
    },
    {
      id: "nemotron-3-ultra-free",
      name: "Nemotron 3 Ultra Free",
      contextLength: 1000000,
      isFreeTier: true
    },
    {
      id: "nemotron-3.5-lightning-free",
      name: "Nemotron 3.5 Lightning Free",
      contextLength: 1000000,
      isFreeTier: true
    },
    {
      id: "laguna-s-2.1-free",
      name: "Laguna S 2.1 Free",
      contextLength: 131000,
      isFreeTier: true
    },
    {
      id: "muse-spark-1.3-contributor-free",
      name: "Muse Spark 1.3 Free",
      contextLength: 1048576,
      isFreeTier: true
    },
    {
      id: "longcat-2.0-free",
      name: "LongCat 2.0 Free",
      contextLength: 1000000,
      isFreeTier: true
    },
    {
      id: "hy3-free",
      name: "Hy3 Free",
      contextLength: 190000,
      isFreeTier: true
    },
    {
      id: "hy3-preview-free",
      name: "Hy3 Preview Free",
      contextLength: 256000,
      isFreeTier: true
    },
    {
      id: "minimax-m3-free",
      name: "MiniMax M3 Free",
      contextLength: 200000,
      isFreeTier: true
    },
    {
      id: "minimax-m2.1-free",
      name: "MiniMax M2.1 Free",
      contextLength: 204800,
      isFreeTier: true
    },
    {
      id: "minimax-m2.5-free",
      name: "MiniMax M2.5 Free",
      contextLength: 204800,
      isFreeTier: true
    },
    {
      id: "glm-5-free",
      name: "GLM 5 Free",
      contextLength: 204800,
      isFreeTier: true
    },
    {
      id: "glm-4.7-free",
      name: "GLM 4.7 Free",
      contextLength: 204800,
      isFreeTier: true
    },
    {
      id: "mimo-v2-flash-free",
      name: "MiMo V2 Flash Free",
      contextLength: 262144,
      isFreeTier: true
    },
    {
      id: "mimo-v2-omni-free",
      name: "MiMo V2 Omni Free",
      contextLength: 262144,
      isFreeTier: true
    },
    {
      id: "mimo-v2-pro-free",
      name: "MiMo V2 Pro Free",
      contextLength: 1048576,
      isFreeTier: true
    },
    {
      id: "qwen3.6-plus-free",
      name: "Qwen 3.6 Plus Free",
      contextLength: 262144,
      isFreeTier: true
    },
    {
      id: "ling-3.0-flash-free",
      name: "Ling 3.0 Flash Free",
      contextLength: 262144,
      isFreeTier: true
    },
    {
      id: "x-preview-f-free",
      name: "Ox Alpha Free (Unlimited)",
      contextLength: 1000000,
      isFreeTier: true
    },
    {
      id: "kimi-k2.5-free",
      name: "Kimi K2.5 Free",
      contextLength: 262144,
      isFreeTier: true
    }
  ],
  modelsFetcher: { url: "https://opencode.ai/zen/v1/models", type: "opencode-free" },
  passthroughModels: true,
};
