/**
 * OpenAI → CommandCode request translator
 *
 * Upstream `/alpha/generate` schema (verified live with curl 2026-05-07):
 *  - params.system: STRING at top level (Anthropic-style; system messages NOT allowed in messages[])
 *  - params.messages[*].role ∈ {"user","assistant","tool"}
 *  - params.messages[*].content: Array of content blocks (NEVER a string)
 *  - tool_use blocks (assistant): {type:"tool-call", toolCallId, toolName, input}
 *  - tool_result blocks (role=user): {type:"tool-result", toolCallId, toolName, output}
 *  - tools[*]: Anthropic plain {name, description, input_schema}
 */
import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { randomUUID } from "crypto";
import { ROLE, OPENAI_BLOCK } from "../schema/index.js";
import { DEFAULT_MAX_TOKENS } from "../../config/runtimeConfig.js";

function flattenText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const p of content) {
      if (typeof p === "string") parts.push(p);
      else if (p && typeof p === "object" && typeof p.text === "string") parts.push(p.text);
    }
    return parts.join("\n");
  }
  return String(content);
}

function toContentBlocks(content) {
  if (content == null) return [{ type: OPENAI_BLOCK.TEXT, text: "" }];
  if (typeof content === "string") return [{ type: OPENAI_BLOCK.TEXT, text: content }];
  if (Array.isArray(content)) {
    const blocks = [];
    for (const part of content) {
      if (typeof part === "string") {
        blocks.push({ type: OPENAI_BLOCK.TEXT, text: part });
      } else if (part && typeof part === "object") {
        if (part.type === OPENAI_BLOCK.TEXT && typeof part.text === "string") {
          blocks.push({ type: OPENAI_BLOCK.TEXT, text: part.text });
        } else if (part.type === OPENAI_BLOCK.IMAGE_URL || part.type === OPENAI_BLOCK.IMAGE) {
          blocks.push({ type: OPENAI_BLOCK.TEXT, text: "[image omitted]" });
        } else if (typeof part.text === "string") {
          blocks.push({ type: OPENAI_BLOCK.TEXT, text: part.text });
        }
      }
    }
    return blocks.length ? blocks : [{ type: OPENAI_BLOCK.TEXT, text: "" }];
  }
  return [{ type: OPENAI_BLOCK.TEXT, text: String(content) }];
}

function safeParseJson(s) {
  if (s == null) return {};
  if (typeof s !== "string") return s;
  try { return JSON.parse(s); } catch { return {}; }
}

function convertMessages(messages = []) {
  const out = [];
  const systemTexts = [];
  const toolCallIdToName = new Map();

  // First pass: collect tool call id -> tool name mappings from assistant tool_calls
  for (const m of messages) {
    if (m?.role === ROLE.ASSISTANT && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        const id = tc?.id;
        const name = tc?.function?.name || tc?.name;
        if (id && name) toolCallIdToName.set(id, name);
      }
    }
  }

  for (const m of messages) {
    if (!m) continue;
    const role = m.role;

    if (role === ROLE.SYSTEM) {
      const t = flattenText(m.content);
      if (t) systemTexts.push(t);
      continue;
    }

    if (role === ROLE.TOOL) {
      const callId = m.tool_call_id || "";
      const toolName = m.name || toolCallIdToName.get(callId) || "";
      const value = typeof m.content === "string" ? m.content : flattenText(m.content);
      out.push({
        role: ROLE.TOOL,
        content: [{
          type: "tool-result",
          toolCallId: callId,
          toolName,
          output: { type: "text", value },
          result: value,
        }],
      });
      continue;
    }

    if (role === ROLE.ASSISTANT) {
      const blocks = [];
      const text = flattenText(m.content);
      if (text) blocks.push({ type: OPENAI_BLOCK.TEXT, text });
      if (Array.isArray(m.tool_calls)) {
        for (const tc of m.tool_calls) {
          const fn = tc.function || {};
          const callId = tc.id || "";
          const name = fn.name || tc.name || "";
          if (callId && name) toolCallIdToName.set(callId, name);
          blocks.push({
            type: "tool-call",
            toolCallId: callId,
            toolName: name,
            input: safeParseJson(fn.arguments ?? tc.arguments),
          });
        }
      }
      out.push({ role: ROLE.ASSISTANT, content: blocks.length ? blocks : [{ type: OPENAI_BLOCK.TEXT, text: "" }] });
      continue;
    }

    // Role user: support Anthropic/AI SDK tool_result blocks embedded in content array
    if (role === ROLE.USER && Array.isArray(m.content)) {
      const blocks = [];
      for (const part of m.content) {
        if (!part) continue;
        if (typeof part === "string") {
          blocks.push({ type: OPENAI_BLOCK.TEXT, text: part });
        } else if (typeof part === "object") {
          if (part.type === "tool_result" || part.type === "tool-result") {
            const callId = part.tool_use_id || part.toolCallId || part.tool_call_id || "";
            const toolName = part.toolName || toolCallIdToName.get(callId) || "";
            const val = typeof part.content === "string" ? part.content : (part.output?.value ?? flattenText(part.content));
            blocks.push({
              type: "tool-result",
              toolCallId: callId,
              toolName,
              output: { type: "text", value: val },
              result: val,
            });
          } else if (part.type === OPENAI_BLOCK.TEXT && typeof part.text === "string") {
            blocks.push({ type: OPENAI_BLOCK.TEXT, text: part.text });
          } else if (part.type === OPENAI_BLOCK.IMAGE_URL || part.type === OPENAI_BLOCK.IMAGE) {
            blocks.push({ type: OPENAI_BLOCK.TEXT, text: "[image omitted]" });
          } else if (typeof part.text === "string") {
            blocks.push({ type: OPENAI_BLOCK.TEXT, text: part.text });
          }
        }
      }
      out.push({ role: ROLE.USER, content: blocks.length ? blocks : [{ type: OPENAI_BLOCK.TEXT, text: "" }] });
      continue;
    }

    out.push({ role: ROLE.USER, content: toContentBlocks(m.content) });
  }

  return { messages: out, system: systemTexts.join("\n\n") };
}

function convertTools(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  const result = [];
  for (const t of tools) {
    if (!t) continue;
    if (t.type === OPENAI_BLOCK.FUNCTION && t.function) {
      const schema = t.function.parameters || { type: "object" };
      result.push({
        name: t.function.name,
        description: t.function.description,
        parameters: schema,
        input_schema: schema,
      });
    } else if (t.name && (t.input_schema || t.parameters)) {
      const schema = t.input_schema || t.parameters || { type: "object" };
      result.push({
        name: t.name,
        description: t.description,
        parameters: schema,
        input_schema: schema,
      });
    }
  }
  return result.length ? result : undefined;
}

export function openaiToCommandCodeRequest(model, body, stream /* , credentials */) {
  const { messages, system } = convertMessages(body.messages);
  const params = {
    model,
    messages,
    stream: stream !== false,
    max_tokens: body.max_tokens ?? body.max_output_tokens ?? DEFAULT_MAX_TOKENS,
    temperature: body.temperature ?? 0.3,
  };

  if (system) params.system = system;

  const tools = convertTools(body.tools);
  if (tools) params.tools = tools;
  if (body.top_p != null) params.top_p = body.top_p;

  const today = new Date().toISOString().slice(0, 10);

  return {
    threadId: randomUUID(),
    memory: "",
    config: {
      workingDir: process.cwd(),
      date: today,
      environment: process.platform,
      structure: [],
      isGitRepo: false,
      currentBranch: "",
      mainBranch: "",
      gitStatus: "",
      recentCommits: [],
    },
    params,
  };
}

register(FORMATS.OPENAI, FORMATS.COMMANDCODE, openaiToCommandCodeRequest, null);
