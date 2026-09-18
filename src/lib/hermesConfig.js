// Shared Hermes config.yaml helpers.
//
// Hermes resolves `model.provider` against the top-level `providers:` map, so a
// model block alone is not enough: the named provider entry must exist and must
// point at MiawRouter. Both the settings route and the subagent automator write
// this file, so the block builders and upserts live here once.

export const HERMES_PROVIDER_KEY = "miawrouter";
export const HERMES_PROVIDER_NAME = "MiawRouter";

// Match a top-level block up to the next non-indented, non-empty line.
export const MODEL_BLOCK_RE = /^model:[ \t]*\r?\n((?:[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m;
export const SUBAGENT_BLOCK_RE = /^subagents:[ \t]*\r?\n((?:[ \t]+.*\r?\n?|[ \t]*\r?\n)*)/m;

export const buildHermesModelBlock = (model, baseUrl) =>
  `model:\n  default: "${model}"\n  provider: "${HERMES_PROVIDER_KEY}"\n  base_url: "${baseUrl}"\n`;

export const buildHermesSubagentBlock = (model, subagents = {}) => {
  const explorer = subagents.explorer || model;
  const reviewer = subagents.reviewer || model;
  const planner = subagents.planner || model;
  const fast = subagents.fast || model;
  return `subagents:\n  enabled: true\n  default_model: "${model}"\n  models:\n    explorer: "${explorer}"\n    reviewer: "${reviewer}"\n    planner: "${planner}"\n    fast: "${fast}"\n`;
};

export const buildHermesProviderBlock = (model, baseUrl, apiKey) =>
  `  ${HERMES_PROVIDER_KEY}:\n    name: "${HERMES_PROVIDER_NAME}"\n    base_url: "${baseUrl}"\n    model: "${model}"\n    api_key: "${apiKey}"\n    discover_models: true\n    models:\n      "${model}": {}\n`;

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Line range of the top-level `providers:` map (header index + body end).
function providersRange(lines) {
  const start = lines.findIndex((line) => /^providers:[ \t]*$/.test(line));
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.startsWith("#")) continue;
    if (!/^[ \t]/.test(line)) { end = i; break; }
  }
  return { start, end };
}

// Line range of a single 2-space-indented entry inside the providers map.
function providerEntryRange(lines, start, end, key) {
  const headerRe = new RegExp(`^  ${escapeRegExp(key)}:[ \t]*$`);
  const entryStart = lines.findIndex((line, i) => i > start && i < end && headerRe.test(line));
  if (entryStart === -1) return null;
  let entryEnd = end;
  for (let i = entryStart + 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (!/^[ \t]{3,}/.test(line)) { entryEnd = i; break; }
  }
  return { start: entryStart, end: entryEnd };
}

// Upsert `providers.<key>` without touching sibling providers.
export function upsertHermesProviderBlock(yaml, key, block) {
  const blockLines = block.replace(/\n$/, "").split("\n");
  const lines = yaml.split("\n");
  const range = providersRange(lines);
  if (!range) {
    const base = yaml.replace(/\s*$/, "");
    return `${base}${base ? "\n" : ""}\nproviders:\n${blockLines.join("\n")}\n`;
  }
  const entry = providerEntryRange(lines, range.start, range.end, key);
  if (!entry) {
    const next = [...lines.slice(0, range.end), ...blockLines, ...lines.slice(range.end)];
    return next.join("\n");
  }
  const next = [...lines.slice(0, entry.start), ...blockLines, ...lines.slice(entry.end)];
  return next.join("\n");
}

export function removeHermesProviderBlock(yaml, key) {
  const lines = yaml.split("\n");
  const range = providersRange(lines);
  if (!range) return yaml;
  const entry = providerEntryRange(lines, range.start, range.end, key);
  if (!entry) return yaml;
  const next = [...lines.slice(0, entry.start), ...lines.slice(entry.end)];
  return next.join("\n");
}

export function upsertHermesModelBlock(yaml, newBlock) {
  if (MODEL_BLOCK_RE.test(yaml)) return yaml.replace(MODEL_BLOCK_RE, newBlock);
  return yaml.length > 0 ? `${newBlock}\n${yaml}` : newBlock;
}

export function upsertHermesSubagentBlock(yaml, newBlock) {
  if (SUBAGENT_BLOCK_RE.test(yaml)) return yaml.replace(SUBAGENT_BLOCK_RE, newBlock);
  return yaml.length > 0 ? `${yaml.trim()}\n\n${newBlock}` : newBlock;
}

export function removeHermesModelBlocks(yaml) {
  return yaml.replace(MODEL_BLOCK_RE, "").replace(SUBAGENT_BLOCK_RE, "").replace(/^\n+/, "");
}

// Parse a block's simple `key: value` fields (best effort).
function parseBlock(yaml, blockRe, keys) {
  const match = yaml.match(blockRe);
  if (!match) return null;
  const body = match[1] || "";
  const out = {};
  for (const key of keys) {
    const m = body.match(new RegExp(`^[ \\t]+${key}:[ \\t]*["']?([^"'\\r\\n]+)["']?`, "m"));
    out[key] = m ? m[1].trim() : null;
  }
  return out;
}

export const parseHermesModelBlock = (yaml) =>
  parseBlock(yaml, MODEL_BLOCK_RE, ["default", "provider", "base_url"]);

export const parseHermesSubagentBlock = (yaml) =>
  parseBlock(yaml, SUBAGENT_BLOCK_RE, ["default_model", "explorer", "reviewer", "planner", "fast"]);
