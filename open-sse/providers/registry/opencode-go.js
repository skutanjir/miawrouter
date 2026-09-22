export default {
  id: "opencode-go",
  priority: 210,
  alias: "opencode-go",
  aliases: [
    "ocg",
  ],
  uiAlias: "ocg",
  display: {
    name: "OpenCode Go",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OC",
    website: "https://opencode.ai/auth",
    notice: {
      text: "OpenCode Go subscription: $5/mo (then  0/mo). Access to Kimi, GLM, Qwen, MiMo, MiniMax models.",
      apiKeyUrl: "https://opencode.ai/auth",
    },
  },
  category: "apikey",
  billingTier: "subscription",
  transport: {
    baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
    headers: {},
  },
  models: [{
  id: "glm-5.2",
  name: "GLM 5.2"
}, {
  id: "glm-5.1",
  name: "GLM 5.1"
}, {
  id: "glm-5.3",
  name: "GLM 5.3"
}, {
  id: "glm-5.3-flash",
  name: "GLM 5.3 Flash",
  supportsReasoning: true
}, {
  id: "kimi-k2.7-code",
  name: "Kimi K2.7 Code"
}, {
  id: "kimi-k2.6",
  name: "Kimi K2.6"
}, {
  id: "deepseek-v4-pro",
  name: "DeepSeek V4 Pro"
}, {
  id: "deepseek-v4-flash",
  name: "DeepSeek V4 Flash"
}, {
  id: "deepseek-v4-flash-vision-exp",
  name: "DeepSeek V4 Flash Vision Exp",
  supportsVision: true
}, {
  id: "mimo-v2.5",
  name: "MiMo V2.5"
}, {
  id: "mimo-v2-pro",
  name: "MiMo V2 Pro"
}, {
  id: "mimo-v2-omni",
  name: "MiMo V2 Omni"
}, {
  id: "mimo-v2.5-pro",
  name: "MiMo V2.5 Pro"
}, {
  id: "mimo-v2.6-flash",
  name: "MiMo V2.6 Flash",
  contextLength: 1048576,
  supportsReasoning: true
}, {
  id: "mimo-v2.6-pro",
  name: "MiMo V2.6 Pro",
  contextLength: 1048576,
  supportsReasoning: true
}, {
  id: "minimax-m3",
  name: "MiniMax M3",
  targetFormat: "claude"
}, {
  id: "minimax-m2.7",
  name: "MiniMax M2.7",
  targetFormat: "claude"
}, {
  id: "minimax-m2.5",
  name: "MiniMax M2.5",
  targetFormat: "claude"
}, {
  id: "qwen3.8-max",
  name: "Qwen 3.8 Max",
  targetFormat: "claude"
}, {
  id: "qwen3.7-max",
  name: "Qwen 3.7 Max",
  targetFormat: "claude"
}, {
  id: "qwen3.7-plus",
  name: "Qwen 3.7 Plus",
  targetFormat: "claude"
}, {
  id: "qwen3.6-plus",
  name: "Qwen 3.6 Plus",
  targetFormat: "claude"
}, {
  "id": "glm-5.2-high",
  "name": "GLM-5.2 (high effort)",
  "upstreamModelId": "glm-5.2(high)",
  "supportsReasoning": true
}, {
  "id": "glm-5.2-max",
  "name": "GLM-5.2 (max effort)",
  "upstreamModelId": "glm-5.2(max)",
  "supportsReasoning": true
}, {
  "id": "glm-5",
  "name": "GLM-5"
}, {
  "id": "kimi-k2.5",
  "name": "Kimi K2.5"
}, {
  "id": "kimi-k3",
  "name": "Kimi K3",
  "supportsReasoning": true
}, {
  "id": "kimi-k3-max",
  "name": "Kimi K3 (max effort)",
  "upstreamModelId": "kimi-k3(max)",
  "supportsReasoning": true
}, {
  "id": "mimo-v2.5-high",
  "name": "MiMo-V2.5 (high effort)",
  "upstreamModelId": "mimo-v2.5(high)",
  "supportsReasoning": true
}, {
  "id": "mimo-v2.5-max",
  "name": "MiMo-V2.5 (max effort)",
  "upstreamModelId": "mimo-v2.5(max)",
  "supportsReasoning": true
}, {
  "id": "mimo-v2.6-flash-high",
  "name": "MiMo-V2.6 Flash (high effort)",
  "upstreamModelId": "mimo-v2.6-flash(high)",
  "supportsReasoning": true
}, {
  "id": "mimo-v2.6-flash-max",
  "name": "MiMo-V2.6 Flash (max effort)",
  "upstreamModelId": "mimo-v2.6-flash(max)",
  "supportsReasoning": true
}, {
  "id": "mimo-v2.6-pro-high",
  "name": "MiMo-V2.6 Pro (high effort)",
  "upstreamModelId": "mimo-v2.6-pro(high)",
  "supportsReasoning": true
}, {
  "id": "mimo-v2.6-pro-max",
  "name": "MiMo-V2.6 Pro (max effort)",
  "upstreamModelId": "mimo-v2.6-pro(max)",
  "supportsReasoning": true
}, {
  "id": "qwen3.7-max-high",
  "name": "Qwen3.7 Max (high effort)",
  "upstreamModelId": "qwen3.7-max(high)",
  "targetFormat": "claude",
  "supportsVision": false,
  "supportsReasoning": true
}, {
  "id": "qwen3.7-max-max",
  "name": "Qwen3.7 Max (max effort)",
  "upstreamModelId": "qwen3.7-max(max)",
  "targetFormat": "claude",
  "supportsVision": false,
  "supportsReasoning": true
}, {
  "id": "qwen3.7-plus-high",
  "name": "Qwen3.7 Plus (high effort)",
  "upstreamModelId": "qwen3.7-plus(high)",
  "targetFormat": "claude",
  "supportsVision": false,
  "supportsReasoning": true
}, {
  "id": "qwen3.7-plus-max",
  "name": "Qwen3.7 Plus (max effort)",
  "upstreamModelId": "qwen3.7-plus(max)",
  "targetFormat": "claude",
  "supportsVision": false,
  "supportsReasoning": true
}, {
  "id": "qwen3.6-plus-high",
  "name": "Qwen3.6 Plus (high effort)",
  "upstreamModelId": "qwen3.6-plus(high)",
  "targetFormat": "claude",
  "supportsVision": false,
  "supportsReasoning": true
}, {
  "id": "qwen3.6-plus-max",
  "name": "Qwen3.6 Plus (max effort)",
  "upstreamModelId": "qwen3.6-plus(max)",
  "targetFormat": "claude",
  "supportsVision": false,
  "supportsReasoning": true
}, {
  "id": "qwen3.5-plus",
  "name": "Qwen3.5 Plus",
  "targetFormat": "claude",
  "supportsVision": false
}, {
  "id": "hy3",
  "name": "Hunyuan3",
  "contextLength": 256000,
  "supportsReasoning": true
}, {
  "id": "hy3-none",
  "name": "Hunyuan3 (none effort)",
  "upstreamModelId": "hy3(none)",
  "contextLength": 256000,
  "supportsReasoning": true
}, {
  "id": "hy3-low",
  "name": "Hunyuan3 (low effort)",
  "upstreamModelId": "hy3(low)",
  "contextLength": 256000,
  "supportsReasoning": true
}, {
  "id": "hy3-high",
  "name": "Hunyuan3 (high effort)",
  "upstreamModelId": "hy3(high)",
  "contextLength": 256000,
  "supportsReasoning": true
}, {
  "id": "hy3-preview",
  "name": "Hunyuan3 Preview"
}, {
  "id": "grok-4.5",
  "name": "Grok 4.5",
  "supportsReasoning": true
}, {
  "id": "grok-4.5-low",
  "name": "Grok 4.5 (low effort)",
  "upstreamModelId": "grok-4.5(low)",
  "supportsReasoning": true
}, {
  "id": "grok-4.5-medium",
  "name": "Grok 4.5 (medium effort)",
  "upstreamModelId": "grok-4.5(medium)",
  "supportsReasoning": true
}, {
  "id": "grok-4.5-high",
  "name": "Grok 4.5 (high effort)",
  "upstreamModelId": "grok-4.5(high)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4-pro-low",
  "name": "DeepSeek V4 Pro (low effort)",
  "upstreamModelId": "deepseek-v4-pro(low)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4-pro-medium",
  "name": "DeepSeek V4 Pro (medium effort)",
  "upstreamModelId": "deepseek-v4-pro(medium)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4-pro-high",
  "name": "DeepSeek V4 Pro (high effort)",
  "upstreamModelId": "deepseek-v4-pro(high)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4-pro-max",
  "name": "DeepSeek V4 Pro (max effort)",
  "upstreamModelId": "deepseek-v4-pro(max)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4-flash-high",
  "name": "DeepSeek V4 Flash (high effort)",
  "upstreamModelId": "deepseek-v4-flash(high)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4-flash-max",
  "name": "DeepSeek V4 Flash (max effort)",
  "upstreamModelId": "deepseek-v4-flash(max)",
  "supportsReasoning": true
}, {
  "id": "gpt-5.6-luna",
  "name": "GPT-5.6 Luna",
  "contextLength": 1050000
}, {
  "id": "muse-spark-1.2-contributor",
  "name": "Muse Spark 1.2 Contributor",
  "contextLength": 1048576
}, {
  "id": "deepseek-v4.1-flash",
  "name": "DeepSeek V4.1 Flash",
  "contextLength": 1000000,
  "supportsVision": true,
  "supportsReasoning": true
}, {
  "id": "deepseek-v4.1-flash-low",
  "name": "DeepSeek V4.1 Flash (low effort)",
  "upstreamModelId": "deepseek-v4.1-flash(low)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4.1-flash-high",
  "name": "DeepSeek V4.1 Flash (high effort)",
  "upstreamModelId": "deepseek-v4.1-flash(high)",
  "supportsReasoning": true
}, {
  "id": "deepseek-v4.1-flash-max",
  "name": "DeepSeek V4.1 Flash (max effort)",
  "upstreamModelId": "deepseek-v4.1-flash(max)",
  "supportsReasoning": true
}, {
  "id": "grok-4.6",
  "name": "Grok 4.6",
  "contextLength": 500000,
  "supportsVision": true,
  "supportsReasoning": true
}, {
  "id": "grok-4.6-low",
  "name": "Grok 4.6 (low effort)",
  "upstreamModelId": "grok-4.6(low)",
  "supportsReasoning": true
}, {
  "id": "grok-4.6-medium",
  "name": "Grok 4.6 (medium effort)",
  "upstreamModelId": "grok-4.6(medium)",
  "supportsReasoning": true
}, {
  "id": "grok-4.6-high",
  "name": "Grok 4.6 (high effort)",
  "upstreamModelId": "grok-4.6(high)",
  "supportsReasoning": true
}, {
  "id": "grok-4.6-xhigh",
  "name": "Grok 4.6 (xhigh effort)",
  "upstreamModelId": "grok-4.6(xhigh)",
  "supportsReasoning": true
}, {
  "id": "grok-4.7",
  "name": "Grok 4.7",
  "contextLength": 500000,
  "supportsVision": true,
  "supportsReasoning": true
}, {
  "id": "grok-4.7-low",
  "name": "Grok 4.7 (low effort)",
  "upstreamModelId": "grok-4.7(low)",
  "supportsReasoning": true
}, {
  "id": "grok-4.7-medium",
  "name": "Grok 4.7 (medium effort)",
  "upstreamModelId": "grok-4.7(medium)",
  "supportsReasoning": true
}, {
  "id": "grok-4.7-high",
  "name": "Grok 4.7 (high effort)",
  "upstreamModelId": "grok-4.7(high)",
  "supportsReasoning": true
}, {
  "id": "grok-4.7-xhigh",
  "name": "Grok 4.7 (xhigh effort)",
  "upstreamModelId": "grok-4.7(xhigh)",
  "supportsReasoning": true
}, {
  "id": "hy4-preview",
  "name": "Hy4 Preview",
  "contextLength": 1024000,
  "supportsReasoning": true
}, {
  "id": "hy4-preview-none",
  "name": "Hy4 Preview (none effort)",
  "upstreamModelId": "hy4-preview(none)",
  "contextLength": 1024000,
  "supportsReasoning": true
}, {
  "id": "hy4-preview-high",
  "name": "Hy4 Preview (high effort)",
  "upstreamModelId": "hy4-preview(high)",
  "contextLength": 1024000,
  "supportsReasoning": true
}, {
  "id": "longcat-2.0",
  "name": "LongCat 2.0",
  "contextLength": 1000000,
  "supportsReasoning": true
}, {
  "id": "muse-spark-1.3-contributor",
  "name": "Muse Spark 1.3 Contributor",
  "contextLength": 1048576,
  "supportsVision": true,
  "supportsReasoning": true
}, {
  "id": "omen-alpha",
  "name": "Omen Alpha",
  "contextLength": 500000,
  "supportsVision": true,
  "supportsReasoning": true
}, {
  "id": "ox-alpha-free",
  "name": "Ox Alpha Free",
  "contextLength": 1000000,
  "supportsVision": true,
  "supportsReasoning": true
}, {
  "id": "qwen3.8-flash",
  "name": "Qwen 3.8 Flash",
  "targetFormat": "claude",
  "supportsVision": true,
  "supportsReasoning": true,
  "contextLength": 1000000
}, {
  "id": "qwen3.8-flash-low",
  "name": "Qwen 3.8 Flash (low effort)",
  "upstreamModelId": "qwen3.8-flash(low)",
  "targetFormat": "claude",
  "supportsReasoning": true
}, {
  "id": "qwen3.8-flash-medium",
  "name": "Qwen 3.8 Flash (medium effort)",
  "upstreamModelId": "qwen3.8-flash(medium)",
  "targetFormat": "claude",
  "supportsReasoning": true
}, {
  "id": "qwen3.8-flash-xhigh",
  "name": "Qwen 3.8 Flash (xhigh effort)",
  "upstreamModelId": "qwen3.8-flash(xhigh)",
  "targetFormat": "claude",
  "supportsReasoning": true
},],
};
