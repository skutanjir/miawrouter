// Provider icon paths under /public/providers.
// Alias related brands; session-cache 404s so one miss never spams again.

const ICON_ALIASES = {
  "perplexity-agent": "perplexity",
  "perplexity-web": "perplexity",
  "gitlab-duo": "gitlab",
  "vercel-ai-gateway": "vercel",
  "v0-vercel-web": "vercel",
  "github-models": "github",
  "huggingface-router": "huggingface",
  "alims-intl": "alicode",
  "chatgpt-web": "openai",
  "claude-web": "claude",
  "gemini-web": "gemini",
  "deepseek-web": "deepseek",
  "kimi-web": "kimi",
  "qwen-web": "qwen",
  "zai-web": "glm",
  "venice-web": "venice",
  "nous": "nous-research",
  "friendli": "friendliai",
  "xiaomi-mimo-tts": "xiaomi-mimo",
  "openai-tts": "openai",
  "openrouter-tts": "openrouter",
  "gemini-tts": "gemini",
  "selfhosted-embedding": "local-device",
  "selfhosted-stt": "local-device",
  "selfhosted-tts": "local-device",
};

const ICON_EXTENSIONS = {
  modelscope: "ico",
  zenmux: "svg",
  "ovh-ai-endpoints": "svg",
};

const KNOWN_EXISTING_ICONS = new Set([
  "openai",
  "claude",
  "gemini",
  "deepseek",
  "kimi",
  "qwen",
  "glm",
  "groq",
  "minimax",
  "mistral",
  "together",
  "siliconflow",
  "cerebras",
  "openrouter",
  "github",
  "gitlab",
  "codex",
  "cline",
  "clinepass",
  "kilocode",
  "hermes",
  "droid",
  "commandcode",
  "opencode",
  "opencode-go",
  "opencode-zen",
  "jcode",
  "openclaw",
  "copilot",
  "kimchi",
  "trae",
  "windsurf",
  "zed",
  "navy",
]);

// Runtime only — first 404 remembers id for the whole session
const failedIds = new Set();

export function clearFailedProviderIcons() {
  failedIds.clear();
}

function normalizeId(providerId) {
  if (!providerId || typeof providerId !== "string") return "";
  return providerId.trim().toLowerCase();
}

/** Resolve icon file id (after alias). Empty if previously failed this session. */
export function resolveProviderIconId(providerId) {
  const id = normalizeId(providerId);
  if (!id) return "";
  const aliased = ICON_ALIASES[id] || id;
  if (KNOWN_EXISTING_ICONS.has(id) || KNOWN_EXISTING_ICONS.has(aliased)) {
    return aliased;
  }
  if (failedIds.has(id) || failedIds.has(aliased)) return "";
  return aliased;
}

/** `/providers/{id}.png` or null when previously failed. */
export function getProviderIconSrc(providerId) {
  const id = resolveProviderIconId(providerId);
  return id ? `/providers/${id}.${ICON_EXTENSIONS[id] || "png"}` : null;
}

/** Call from img onError so later mounts skip the request. */
export function markProviderIconMissing(providerId) {
  const id = normalizeId(providerId);
  const aliased = ICON_ALIASES[id] || id;
  if (KNOWN_EXISTING_ICONS.has(id) || KNOWN_EXISTING_ICONS.has(aliased)) {
    return;
  }
  if (id) failedIds.add(id);
  if (aliased) failedIds.add(aliased);
}
