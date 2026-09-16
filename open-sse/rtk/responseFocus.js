import { injectSystemPrompt } from "./systemInject.js";

const RESPONSE_FOCUS_PROMPTS = {
  code: "Response focus: code-first. Lead with the smallest working patch or exact code. Keep explanation to the fewest lines needed; preserve paths, commands, errors, and security notes.",
  explanation: "Response focus: explanation-first. State the cause, trade-offs, and next step before code. Use short paragraphs and include code only when it clarifies the solution.",
};

export function injectResponseFocus(body, format, focus) {
  const prompt = RESPONSE_FOCUS_PROMPTS[focus];
  if (!prompt) return false;
  injectSystemPrompt(body, format, prompt);
  return true;
}
