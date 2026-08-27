// Anti-Slop injector: appends Anti-Slop filter instructions into the system message
// of the final request body, dispatching by format across Claude, OpenAI, Gemini, Codex, Antigravity, Kiro.
import { injectSystemPrompt } from "./systemInject.js";
import { ANTISLOP_PROMPTS } from "./antislopPrompts.js";

export function injectAntiSlop(body, format, level = "full") {
  const prompt = ANTISLOP_PROMPTS[level] || ANTISLOP_PROMPTS.full;
  injectSystemPrompt(body, format, prompt);
}
