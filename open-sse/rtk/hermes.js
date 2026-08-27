// Hermes Agent Autonomy injector: injects structured reasoning & CLI-tailored
// autonomy instructions into the system message across Claude, OpenAI, Gemini, Codex, Antigravity, Kiro.
import { injectSystemPrompt } from "./systemInject.js";
import { getHermesSystemPrompt } from "./hermesPrompts.js";

export function injectHermes(body, format, clientTool = null, mode = "full") {
  const prompt = getHermesSystemPrompt(clientTool, mode);
  injectSystemPrompt(body, format, prompt);
}
