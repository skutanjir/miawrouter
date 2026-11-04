import { GOOGLE_OAUTH_CLIENT } from "../shared.js";

export default {
  id: "gemini",
  priority: 50,
  hasFree: true,
  alias: "gemini",
  display: {
    name: "Gemini",
    icon: "diamond",
    color: "#4285F4",
    textIcon: "GE",
    website: "https://ai.google.dev",
    notice: {
      apiKeyUrl: "https://aistudio.google.com/app/apikey",
    },
  },
  category: "freeTier",
  modelsFetcher: { url: "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", type: "openai", authHeader: "x-goog-api-key", authPrefix: "" },
  authType: "apikey",
  authModes: ["apikey"],
  mediaPriority: 1,
  transport: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    format: "gemini",
    clientId: "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com",
    clientSecret: "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",
    auth: {
      apiKey: {
        header: "x-goog-api-key",
        scheme: "raw",
      },
      oauth: {
        header: "Authorization",
        scheme: "bearer",
      },
    },
  },
  models: [{
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    contextLength: 1048576,
    maxOutputTokens: 1048576,
    toolCalling: true,
    supportsVision: true
  }, {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    toolCalling: true,
    supportsVision: true
  }, {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash (legacy alias; routes to Gemini 3.8 Flash)"
  }, {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash"
  }, {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash (legacy alias; routes to Gemini 3.6 Flash)",
    toolCalling: true,
    supportsVision: true
  }, {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite"
  }, {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro Preview"
  }, {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash-Lite",
    toolCalling: true,
    supportsVision: true
  }, {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview"
  }, {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro"
  }, {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash"
  }, {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite"
  }, {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro"
  }, {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash"
  }, {
    id: "gemma-4-31b-it",
    name: "Gemma 4 31B IT"
  }, {
    id: "gemini-embedding-2-preview",
    name: "Gemini Embedding 2 Preview",
    kind: "embedding"
  }, {
    id: "gemini-embedding-001",
    name: "Gemini Embedding 001",
    kind: "embedding"
  }, {
    id: "text-embedding-005",
    name: "Text Embedding 005",
    kind: "embedding"
  }, {
    id: "gemini-nano-banana-2.1",
    name: "Nano Banana 2.1",
    params: [],
    kind: "image"
  }, {
    id: "gemini-3.1-flash-image",
    name: "Nano Banana 2",
    params: [],
    kind: "image"
  }, {
    id: "gemini-3.1-flash-lite-image",
    name: "Nano Banana 2 Lite",
    params: [],
    kind: "image"
  }, {
    id: "gemini-3-pro-image",
    name: "Nano Banana Pro",
    params: [],
    kind: "image"
  }, {
    id: "gemini-2.5-flash-image",
    name: "Gemini 2.5 Flash Image (Nano Banana)",
    params: [],
    kind: "image"
  }, {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro (Best)",
    params: ["language", "prompt"],
    kind: "stt"
  }, {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    params: ["language", "prompt"],
    kind: "stt"
  }, {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite (Cheapest)",
    params: ["language", "prompt"],
    kind: "stt"
  }, {
    id: "gemini-omni-1.1-flash",
    name: "Gemini Omni Flash",
    kind: "video"
  }, {
    id: "veo-3.1-generate-preview",
    name: "Veo 3.1",
    kind: "video"
  }, {
    id: "veo-3.1-lite-generate-preview",
    name: "Veo 3.1 Lite",
    kind: "video"
  }, {
    id: "gemini-3.8-flash-tts",
    name: "Gemini 3.8 Flash TTS",
    kind: "tts"
  }, {
    id: "gemini-3.8-flash-lite-tts",
    name: "Gemini 3.8 Flash-Lite TTS",
    kind: "tts"
  }, {
    id: "gemini-3.1-flash-tts-preview",
    name: "Gemini 3.1 Flash TTS (legacy)",
    kind: "tts"
  }, {
    id: "gemini-2.5-flash-preview-tts",
    name: "Gemini 2.5 Flash TTS (legacy)",
    kind: "tts"
  }, {
    id: "gemini-2.5-pro-preview-tts",
    name: "Gemini 2.5 Pro TTS (legacy)",
    kind: "tts"
  }],
  serviceKinds: ["llm","embedding","image","imageToText","webSearch","tts","stt","video"],
  ttsConfig: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    authType: "apikey",
    authHeader: "key",
    format: "gemini-tts",
  },
  sttConfig: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    authType: "apikey",
    authHeader: "key",
    format: "gemini-stt",
  },
  embeddingConfig: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/models", authType: "apikey", authHeader: "key" },
  imageConfig: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/models" },
  searchViaChat: {
    defaultModel: "gemini-2.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    pricingUrl: "https://ai.google.dev/pricing",
    freeTier: "Free tier: 15 RPM, 1M tokens/day on gemini-2.5-flash via AI Studio.",
  },
};
