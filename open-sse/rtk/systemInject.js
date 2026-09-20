// Shared system-prompt injector: appends an instruction into the system message of
// the final request body, dispatching by format so it works for translated and
// native-passthrough flows. Used by caveman.js and ponytail.js.

import { FORMATS } from "../translator/formats.js";

const SEP = "\n\n";

export function injectSystemPrompt(body, format, prompt) {
  if (!body || !prompt) return;

  switch (format) {
    case FORMATS.CLAUDE:
      injectClaudeSystem(body, prompt);
      return;
    case FORMATS.COMMANDCODE:
      injectCommandCodeSystem(body, prompt);
      return;
    case FORMATS.GEMINI:
    case FORMATS.GEMINI_CLI:
    case FORMATS.VERTEX:
    case FORMATS.ANTIGRAVITY:
      // Antigravity wraps Gemini shape in body.request → injectGeminiSystem handles it
      injectGeminiSystem(body, prompt);
      return;
    case FORMATS.OPENAI_RESPONSES:
    case FORMATS.OPENAI_RESPONSE:
    case FORMATS.CODEX:
      // messages[] precedence: if messages[] is present, treat as chat completions
      if (Array.isArray(body.messages)) {
        injectMessagesSystem(body, prompt);
        return;
      }
      injectResponsesSystem(body, prompt);
      return;
    default:
      // messages[] precedence: if messages[] is present, treat as chat completions
      if (Array.isArray(body.messages)) {
        injectMessagesSystem(body, prompt);
        return;
      }
      // If body has Responses shape (input array or instructions field), use instructions
      if (typeof body.instructions === "string" || Array.isArray(body.input)) {
        injectResponsesSystem(body, prompt);
        return;
      }
      injectMessagesSystem(body, prompt);
  }
}

function injectResponsesSystem(body, prompt) {
  if (Array.isArray(body.messages)) {
    injectMessagesSystem(body, prompt);
    return;
  }
  if (typeof body.instructions === "string") {
    body.instructions = body.instructions
      ? `${body.instructions}${SEP}${prompt}`
      : prompt;
  } else {
    body.instructions = prompt;
  }
}

// OpenAI-shaped: messages[] (chat)
function injectMessagesSystem(body, prompt) {
  const arr = Array.isArray(body.messages) ? body.messages : null;
  if (!arr) return;

  const idx = arr.findIndex(m => m && (m.role === "system" || m.role === "developer"));
  if (idx >= 0) {
    appendToOpenAIMessage(arr[idx], prompt);
  } else {
    arr.unshift({ role: "system", content: prompt });
  }
}

function appendToOpenAIMessage(msg, prompt) {
  if (typeof msg.content === "string") {
    msg.content = `${msg.content}${SEP}${prompt}`;
  } else if (Array.isArray(msg.content)) {
    // Responses-style array of parts {type:"input_text"|"text", text}
    msg.content.push({ type: "input_text", text: prompt });
  } else {
    msg.content = prompt;
  }
}

// Claude shape: body.system as string | array of {type:"text", text}
// Insert before the last cache_control block to keep injection inside the cached prefix.
function injectClaudeSystem(body, prompt) {
  if (typeof body.system === "string" && body.system.length > 0) {
    body.system = `${body.system}${SEP}${prompt}`;
    return;
  }
  if (Array.isArray(body.system)) {
    const block = { type: "text", text: prompt };
    let lastCacheIdx = -1;
    for (let i = body.system.length - 1; i >= 0; i--) {
      if (body.system[i]?.cache_control) { lastCacheIdx = i; break; }
    }
    if (lastCacheIdx >= 0) {
      body.system.splice(lastCacheIdx, 0, block);
    } else {
      body.system.push(block);
    }
    return;
  }
  body.system = prompt;
}

// CommandCode shape: string at top-level body.system (and body.params.system if envelope present)
// NEVER insert role:system into messages[]
function injectCommandCodeSystem(body, prompt) {
  if (typeof body.system === "string" && body.system.length > 0) {
    body.system = `${body.system}${SEP}${prompt}`;
  } else {
    body.system = prompt;
  }

  if (body.params && typeof body.params === "object") {
    if (typeof body.params.system === "string" && body.params.system.length > 0) {
      body.params.system = `${body.params.system}${SEP}${prompt}`;
    } else {
      body.params.system = prompt;
    }
  }
}

// Gemini shape: body.system_instruction | body.systemInstruction | body.request.systemInstruction
// Each shape: { parts: [{ text }] }
function injectGeminiSystem(body, prompt) {
  const target = body.request && typeof body.request === "object" ? body.request : body;
  const useSnake = Object.prototype.hasOwnProperty.call(target, "system_instruction");
  const key = useSnake ? "system_instruction" : "systemInstruction";
  const sys = target[key];
  if (sys && Array.isArray(sys.parts)) {
    sys.parts.push({ text: prompt });
    return;
  }
  target[key] = { parts: [{ text: prompt }] };
}
