import { CLAUDE_API_HEADERS } from "../shared.js";

export default {
  id: "deepseek",
  priority: 110,
  alias: "deepseek",
  aliases: [
    "ds",
  ],
  uiAlias: "ds",
  display: {
    name: "DeepSeek",
    icon: "bolt",
    color: "#4D6BFE",
    textIcon: "DS",
    website: "https://deepseek.com",
    notice: {
      apiKeyUrl: "https://platform.deepseek.com/api_keys",
    },
  },
  category: "apikey",
  transport: {
    baseUrl: "https://api.deepseek.com/chat/completions",
    validateUrl: "https://api.deepseek.com/models",
    reasoningInject: {
      scope: "all",
    },
  },
  // Multi-endpoint: pick the transport matching client sourceFormat to skip translation.
  transports: [
    {
      format: "openai",
      baseUrl: "https://api.deepseek.com/chat/completions",
      auth: { combined: true, header: "Authorization", scheme: "bearer" },
    },
    {
      format: "claude",
      baseUrl: "https://api.deepseek.com/anthropic/v1/messages",
      headers: { ...CLAUDE_API_HEADERS },
      auth: { combined: true, header: "x-api-key", scheme: "raw" },
    },
  ],
  models: [
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
    { id: "deepseek-flash", name: "DeepSeek V4.1 Flash", supportsReasoning: true, supportsVision: true, contextLength: 1000000, maxOutputTokens: 384000 },
    { id: "deepseek-v4-flash", name: "DeepSeek V4.1 Flash (Legacy ID)", supportsReasoning: true, supportsVision: true, contextLength: 1000000, maxOutputTokens: 384000 },
    { id: "deepseek-v4-flash-vision-exp", name: "DeepSeek V4.1 Flash (Legacy Vision ID)", supportsReasoning: true, supportsVision: true, contextLength: 1000000, maxOutputTokens: 384000 },
  ],
  features: {
    usage: true,
    usageApikey: true,
  },
};
