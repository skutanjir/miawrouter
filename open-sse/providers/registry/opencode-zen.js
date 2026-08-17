const BASE_URL = "https://opencode.ai/zen/v1";

const responsesModel = (id, name) => ({ id, name, targetFormat: "openai-responses" });
const messagesModel = (id, name) => ({ id, name, targetFormat: "claude" });
const geminiModel = (id, name) => ({ id, name, targetFormat: "gemini" });

export default {
  id: "opencode-zen",
  priority: 211,
  alias: "zen",
  aliases: ["ocz", "opencode-zen"],
  uiAlias: "zen",
  category: "apikey",
  authType: "apikey",
  authModes: ["apikey"],
  display: {
    name: "OpenCode Zen",
    icon: "terminal",
    color: "#E87040",
    textIcon: "OZ",
    website: "https://opencode.ai/docs/zen/",
    notice: {
      text: "OpenCode Zen is a pay-as-you-go gateway for coding models curated by the OpenCode team.",
      apiKeyUrl: "https://opencode.ai/auth",
    },
  },
  transport: {
    baseUrl: `${BASE_URL}/chat/completions`,
    validateUrl: `${BASE_URL}/models`,
    format: "openai",
  },
  models: [messagesModel("claude-fable-5", "Claude Fable 5"), messagesModel("claude-opus-5", "Claude Opus 5"), messagesModel("claude-opus-4-8", "Claude Opus 4.8"), messagesModel("claude-opus-4-7", "Claude Opus 4.7"), messagesModel("claude-opus-4-6", "Claude Opus 4.6"), messagesModel("claude-opus-4-5", "Claude Opus 4.5"), messagesModel("claude-sonnet-5", "Claude Sonnet 5"), messagesModel("claude-sonnet-4-6", "Claude Sonnet 4.6"), messagesModel("claude-sonnet-4-5", "Claude Sonnet 4.5"), messagesModel("claude-sonnet-4", "Claude Sonnet 4"), messagesModel("claude-haiku-4-5", "Claude Haiku 4.5"), geminiModel("gemini-3.6-flash", "Gemini 3.6 Flash"), geminiModel("gemini-3.5-flash-lite", "Gemini 3.5 Flash Lite"), geminiModel("gemini-3.5-flash", "Gemini 3.5 Flash"), geminiModel("gemini-3.1-pro", "Gemini 3.1 Pro"), geminiModel("gemini-3-flash", "Gemini 3 Flash"), responsesModel("gpt-5.6-sol", "GPT 5.6 Sol"), responsesModel("gpt-5.6-terra", "GPT 5.6 Terra"), responsesModel("gpt-5.6-luna", "GPT 5.6 Luna"), responsesModel("gpt-5.5", "GPT 5.5"), responsesModel("gpt-5.5-pro", "GPT 5.5 Pro"), responsesModel("gpt-5.4", "GPT 5.4"), responsesModel("gpt-5.4-pro", "GPT 5.4 Pro"), responsesModel("gpt-5.4-mini", "GPT 5.4 Mini"), responsesModel("gpt-5.4-nano", "GPT 5.4 Nano"), responsesModel("gpt-5.3-codex-spark", "GPT 5.3 Codex Spark"), responsesModel("gpt-5.3-codex", "GPT 5.3 Codex"), responsesModel("gpt-5.2", "GPT 5.2"), responsesModel("gpt-5.2-codex", "GPT 5.2 Codex"), responsesModel("gpt-5.1", "GPT 5.1"), responsesModel("gpt-5.1-codex-max", "GPT 5.1 Codex Max"), responsesModel("gpt-5.1-codex", "GPT 5.1 Codex"), responsesModel("gpt-5.1-codex-mini", "GPT 5.1 Codex Mini"), responsesModel("gpt-5", "GPT 5"), responsesModel("gpt-5-codex", "GPT 5 Codex"), responsesModel("gpt-5-nano", "GPT 5 Nano"), responsesModel("grok-build-0.1", "Grok Build 0.1"), responsesModel("grok-4.5", "Grok 4.5"), {
  id: "deepseek-v4-pro",
  name: "DeepSeek V4 Pro"
}, {
  id: "deepseek-v4-flash",
  name: "DeepSeek V4 Flash"
}, {
  id: "glm-5.2",
  name: "GLM 5.2"
}, {
  id: "glm-5.1",
  name: "GLM 5.1"
}, {
  id: "glm-5",
  name: "GLM 5"
}, {
  id: "minimax-m3",
  name: "MiniMax M3"
}, {
  id: "minimax-m2.7",
  name: "MiniMax M2.7"
}, {
  id: "minimax-m2.5",
  name: "MiniMax M2.5"
}, {
  id: "kimi-k3",
  name: "Kimi K3"
}, {
  id: "kimi-k2.7-code",
  name: "Kimi K2.7 Code"
}, {
  id: "kimi-k2.6",
  name: "Kimi K2.6"
}, {
  id: "kimi-k2.5",
  name: "Kimi K2.5"
}, messagesModel("qwen3.6-plus", "Qwen3.6 Plus"), messagesModel("qwen3.5-plus", "Qwen3.5 Plus"), {
  "id": "big-pickle",
  "name": "Big Pickle",
  "supportsReasoning": true,
  "interleavedField": "reasoning_content"
}, {
  "id": "claude-opus-4-1",
  "name": "Claude Opus 4.1"
}, {
  "id": "deepseek-v4-flash-free",
  "name": "DeepSeek V4 Flash Free",
  "supportsReasoning": true
}, {
  "id": "minimax-m2.5-free",
  "name": "MiniMax M2.5 Free",
  "contextLength": 204800
}, {
  "id": "nemotron-3-super-free",
  "name": "Nemotron 3 Super Free",
  "contextLength": 1000000
}, {
  "id": "qwen3.6-plus-free",
  "name": "Qwen3.6 Plus Free",
  "targetFormat": "claude",
  "contextLength": 200000
}],
};
