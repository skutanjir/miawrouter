export default {
  id: "pollinations",
  alias: "pol",
  uiAlias: "pol",
  display: {
    name: "Pollinations AI",
    icon: "local_florist",
    color: "#4CAF50",
    textIcon: "PO",
    website: "https://pollinations.ai",
    notice: {
      text: "Free keyless tier (anonymous): openai-fast and similar community models. Premium models (claude, gemini, midijourney…) require an optional API token from enter.pollinations.ai. Rate limits apply.",
      signupUrl: "https://enter.pollinations.ai",
    },
  },
  category: "freeTier",
  authType: "apikey",
  authModes: ["apikey"],
  noAuth: true,
  hasFree: true,
  transport: {
    baseUrl: "https://text.pollinations.ai/openai/v1/chat/completions",
    validateUrl: "https://text.pollinations.ai/openai/v1/models",
    noAuth: true,
  },
  modelsFetcher: { url: "https://text.pollinations.ai/models", type: "openai" },
  models: [
    {
      id: "openai-fast",
      name: "OpenAI Fast (GPT-OSS 20B)",
      contextLength: 131072,
      supportsReasoning: true,
      isFreeTier: true
    }
  ],
  passthroughModels: true,
};
