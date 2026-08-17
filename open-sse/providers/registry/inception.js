export default {
  id: "inception",
  alias: "inception",
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  display: {
    name: "Inception",
    icon: "auto_awesome",
    color: "#F97316",
    textIcon: "IN",
    website: "https://docs.inceptionlabs.ai",
  },
  transport: { baseUrl: "https://api.inceptionlabs.ai/v1/chat/completions" },
  models: [
    { id: "mercury-2", name: "Mercury 2", contextLength: 128000, maxOutputTokens: 50000 },
  ],
};
