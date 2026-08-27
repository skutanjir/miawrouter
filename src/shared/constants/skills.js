// Agent Skills metadata — single source of truth for /dashboard/skills page.
// Each skill = 1 raw URL the user copies and pastes to any AI agent.
// ponytail: repo is local-only (no remote), so skill URLs point at the product
// domain; switch to a real repo base when one is published.

const DOMAIN = "miawrouter.web.id";
const SKILL_PATH = "skills";

export const SKILLS_REPO_URL = `https://${DOMAIN}`;
export const SKILLS_RAW_BASE = `https://${DOMAIN}/${SKILL_PATH}`;
export const SKILLS_BLOB_BASE = `https://${DOMAIN}/${SKILL_PATH}`;

export const SKILLS = [
  {
    id: "miawrouter",
    name: "MiawRouter (Entry)",
    description: "Setup + index of all capabilities. Start here — covers base URL, auth, model discovery, and links to every capability skill.",
    endpoint: null,
    icon: "hub",
    isEntry: true,
  },
  {
    id: "miawrouter-chat",
    name: "Chat",
    description: "Chat / code-gen via OpenAI or Anthropic format with streaming.",
    endpoint: "/v1/chat/completions",
    icon: "chat",
  },
  {
    id: "miawrouter-image",
    name: "Image Generation",
    description: "Text-to-image via DALL-E, Imagen, FLUX, MiniMax, SDWebUI…",
    endpoint: "/v1/images/generations",
    icon: "image",
  },
  {
    id: "miawrouter-tts",
    name: "Text-to-Speech",
    description: "OpenAI / ElevenLabs / Edge / Google / Deepgram voices.",
    endpoint: "/v1/audio/speech",
    icon: "record_voice_over",
  },
  {
    id: "miawrouter-stt",
    name: "Speech-to-Text",
    description: "Transcribe audio via OpenAI Whisper, Groq, Gemini, Deepgram, AssemblyAI…",
    endpoint: "/v1/audio/transcriptions",
    icon: "mic",
  },
  {
    id: "miawrouter-embeddings",
    name: "Embeddings",
    description: "Vectors for RAG / semantic search via OpenAI, Gemini, Mistral…",
    endpoint: "/v1/embeddings",
    icon: "scatter_plot",
  },
  {
    id: "miawrouter-web-search",
    name: "Web Search",
    description: "Tavily / Exa / Brave / Serper / SearXNG / Google PSE / You.com.",
    endpoint: "/v1/search",
    icon: "search",
  },
  {
    id: "miawrouter-web-fetch",
    name: "Web Fetch",
    description: "URL → markdown / text / HTML via Firecrawl, Jina, Tavily, Exa.",
    endpoint: "/v1/web/fetch",
    icon: "language",
  },
  // ── Anti-Slop Suite (miqdadbadjuber/anti-slop) ──────────────────────────
  {
    id: "antislop",
    name: "Anti-Slop (Core Filter)",
    description: "Anti-Slop core rules (R-01 to R-38). Prevents generic AI-generated slop UI, copy, and code without making designs sterile.",
    endpoint: null,
    icon: "filter_alt",
    sourceRef: "miqdadbadjuber/anti-slop",
    installCommand: "npx skills add miqdadbadjuber/anti-slop --skill antislop",
    rawUrl: "https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/skills/antislop/SKILL.md",
  },
  {
    id: "antislop-ui",
    name: "Anti-Slop UI / UX",
    description: "UI and visual design filter: layout, rhythm, distinctive color schemes, intentional motion, no cookie-cutter templates.",
    endpoint: null,
    icon: "palette",
    sourceRef: "miqdadbadjuber/anti-slop",
    installCommand: "npx skills add miqdadbadjuber/anti-slop --skill antislop-ui",
    rawUrl: "https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/skills/antislop-ui/SKILL.md",
  },
  {
    id: "antislop-copywriting",
    name: "Anti-Slop Copywriting",
    description: "De-slop text, headlines, CTAs, tone, and markdown hygiene. Erases negative parallelism, puffery, and robotic phrasing.",
    endpoint: null,
    icon: "edit_note",
    sourceRef: "miqdadbadjuber/anti-slop",
    installCommand: "npx skills add miqdadbadjuber/anti-slop --skill antislop-copywriting",
    rawUrl: "https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/skills/antislop-copywriting/SKILL.md",
  },
  {
    id: "antislop-human",
    name: "Anti-Slop Human / A11y",
    description: "WCAG AAA contrast verification, keyboard navigation, focus states, and real human usability checks.",
    endpoint: null,
    icon: "accessibility_new",
    sourceRef: "miqdadbadjuber/anti-slop",
    installCommand: "npx skills add miqdadbadjuber/anti-slop --skill antislop-human",
    rawUrl: "https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/skills/antislop-human/SKILL.md",
  },
  {
    id: "antislop-layoutmobile",
    name: "Anti-Slop Mobile Layout",
    description: "Fluid responsive breakpoints, mobile viewport handling, tap target ergonomics, and navigation drawer layout.",
    endpoint: null,
    icon: "smartphone",
    sourceRef: "miqdadbadjuber/anti-slop",
    installCommand: "npx skills add miqdadbadjuber/anti-slop --skill antislop-layoutmobile",
    rawUrl: "https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/skills/antislop-layoutmobile/SKILL.md",
  },
  {
    id: "antislop-code",
    name: "Anti-Slop Code Comments",
    description: "Clean up repetitive or obvious AI comments in code while preserving meaningful architectural notes.",
    endpoint: null,
    icon: "code_off",
    sourceRef: "miqdadbadjuber/anti-slop",
    installCommand: "npx skills add miqdadbadjuber/anti-slop --skill antislop-code",
    rawUrl: "https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/skills/antislop-code/SKILL.md",
  },
  // ── Hermes Autonomous Agent Capabilities ──────────────────────────────
  {
    id: "hermes-agent",
    name: "Hermes Autonomous Agent",
    description: "Nous Hermes-inspired structured multi-step reasoning, goal decomposition, and autonomous execution.",
    endpoint: null,
    icon: "psychology",
    isHermes: true,
  },
  {
    id: "hermes-subagent",
    name: "Hermes Subagent Spawner",
    description: "Autonomously spawns and orchestrates specialized domain subagents with dedicated personas and guardrails.",
    endpoint: null,
    icon: "account_tree",
    isHermes: true,
  },
  {
    id: "hermes-memory",
    name: "Hermes Cross-Session Memory",
    description: "Autonomous fact distillation, persistent cross-session memory synthesis, and directive recall injection.",
    endpoint: null,
    icon: "memory",
    isHermes: true,
  },
  {
    id: "hermes-skill-builder",
    name: "Hermes Skill Builder",
    description: "On-the-fly Agent Skill synthesis in open standard SKILL.md format for new workflows and libraries.",
    endpoint: null,
    icon: "handyman",
    isHermes: true,
  },
  {
    id: "hermes-lsp",
    name: "Hermes LSP Bridge",
    description: "Automatic language server diagnostics, symbol indexing, and typecheck verification across CLI targets.",
    endpoint: null,
    icon: "terminal",
    isHermes: true,
  },
  {
    id: "hermes-plugins",
    name: "Hermes Plugin Manager",
    description: "Autonomous discovery, installation, and configuration of MCP servers and workspace plugins.",
    endpoint: null,
    icon: "extension",
    isHermes: true,
  },
];

export function getSkillRawUrl(id) {
  const skill = SKILLS.find((s) => s.id === id);
  if (skill?.rawUrl) return skill.rawUrl;
  return `${SKILLS_RAW_BASE}/${id}/SKILL.md`;
}

export function getSkillBlobUrl(id) {
  const skill = SKILLS.find((s) => s.id === id);
  if (skill?.rawUrl) return skill.rawUrl.replace("raw.githubusercontent.com", "github.com").replace("/main/", "/blob/main/");
  return `${SKILLS_BLOB_BASE}/${id}/SKILL.md`;
}
