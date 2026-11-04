export default {
  id: "github-models",
  alias: "ghm",
  category: "freeTier",
  hasFree: true,
  authType: "apikey",
  authHint: "Create a GitHub PAT with 'models: read' scope at github.com/settings/tokens",
  display: {
    name: "GitHub Models",
    icon: "code",
    color: "#238636",
    textIcon: "GH",
    website: "https://github.com/marketplace/models",
    deprecated: true,
    deprecationNotice: "GitHub Models was retired Jul 30, 2026.",
  },
  transport: {
    baseUrl: "https://models.github.ai/inference/chat/completions",
    validateUrl: "https://models.github.ai/catalog/models",
    headers: {
      "X-GitHub-Api-Version": "2026-03-10",
      Accept: "application/vnd.github+json",
    },
  },
};
