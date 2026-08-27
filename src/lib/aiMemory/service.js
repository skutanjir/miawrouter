// AI auto-memory: make the router "smarter" across sessions by persisting
// prompts that look important and recalling them into later requests.
//
// - Detection is a LOCAL heuristic (regex markers EN + Bahasa Indonesia) — no
//   LLM call, no network, microseconds per prompt.
// - Storage is the existing local SQLite `memories` table (+ FTS5 search)
//   behind memoryRepo; dashboard /dashboard/memory shows everything captured.
// - Everything is privacy-gated: computeEffectivePrivacyFlags forces this off
//   in every non-"normal" mode (persisting prompt text ≈ body logging).
// - Fail-open by contract: capture/recall never throw into the request path.

import { createMemory, searchMemories } from "@/lib/db/index.js";

const USER_ID = "default"; // same scope the dashboard memory page uses

const MIN_CAPTURE_CHARS = 24;
const MAX_STORED_CHARS = 600;
const RECALL_LIMIT = 5;

// Markers that justify persisting a prompt. Deliberately conservative: junk
// memories cost tokens on every later request.
const IMPORTANT_RE = new RegExp(
  [
    // English
    "remember", "don'?t forget", "keep in mind", "note that", "important",
    "i prefer", "always use", "never use", "from now on", "going forward",
    "my name is", "i work on", "our project", "the fix (was|is)", "root cause",
    "bug (was|is)", "it work(s|ed) when", "make sure to",
    // Bahasa Indonesia
    "ingat", "jangan lupa", "penting", "catat", "simpan",
    "saya prefer", "selalu gunakan", "jangan pakai", "mulai sekarang",
    "nama saya", "saya lagi kerjain", "proyek saya", "solusinya", "ternyata",
    "penyebabnya", "berhasil kalau", "pastikan",
  ].join("|"),
  "i"
);

// Prompts that are pure code/commands rarely carry durable facts worth storing.
const CODE_ONLY_RE = /^(```|[A-Za-z0-9_$]+\(|function |class |import |const |let |var |SELECT |GET |POST |curl )/i;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "have", "has", "was",
  "were", "will", "would", "could", "should", "yang", "dan", "untuk", "dengan",
  "ini", "itu", "ada", "tidak", "bisa", "saya", "kamu", "apa", "gimana", "kenapa",
]);

export function extractLastUserText(body) {
  try {
    const messages = Array.isArray(body?.messages) ? body.messages : null;
    if (!messages) return "";
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m || m.role !== "user") continue;
      if (typeof m.content === "string") return m.content;
      if (Array.isArray(m.content)) {
        return m.content
          .map((b) => (typeof b?.text === "string" ? b.text : ""))
          .filter(Boolean)
          .join(" ");
      }
      return "";
    }
    return "";
  } catch {
    return "";
  }
}

/** Local heuristic: does this user text deserve persistent storage? */
export function looksImportant(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length < MIN_CAPTURE_CHARS || trimmed.length > 8000) return false;
  if (CODE_ONLY_RE.test(trimmed) && !IMPORTANT_RE.test(trimmed)) return false;
  return IMPORTANT_RE.test(trimmed);
}

function normalizeForDedupe(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Distill a prompt down to the sentence(s) that carry the durable fact.
 * Storing the distilled fact (instead of the whole prompt) makes memories
 * denser, cheaper to recall, and far more likely to match future FTS queries.
 * Returns null when nothing worth keeping survives.
 */
export function extractImportantSentences(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  // Short prompts are already dense — keep them whole.
  if (trimmed.length <= 160) return looksImportant(trimmed) ? trimmed : null;

  const segments = trimmed.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const keep = [];
  let usedChars = 0;
  for (const seg of segments) {
    if (!IMPORTANT_RE.test(seg)) continue;
    if (usedChars + seg.length > MAX_STORED_CHARS) break;
    keep.push(seg);
    usedChars += seg.length;
    if (keep.length >= 4) break;
  }
  return keep.length ? keep.join(" ") : null;
}

// Cheap keyword set for FTS recall: longest words first, stopwords removed.
export function keywords(text, cap = 6) {
  const seen = new Map();
  for (const raw of String(text || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    seen.set(raw, (seen.get(raw) || 0) + 1);
  }
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, cap)
    .map(([w]) => w);
}

/**
 * Fire-and-forget capture. Returns the stored row or null. Never throws.
 * Dedupes within the session: identical normalized content is not stored twice.
 */
export async function captureAiMemory({ text, sessionId = "", provider = "", model = "", source = "auto" } = {}) {
  try {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    if (!looksImportant(raw)) return null;
    // Store the distilled fact sentences, not the whole prompt.
    const clean = (extractImportantSentences(raw) || raw.slice(0, MAX_STORED_CHARS)).slice(0, MAX_STORED_CHARS);
    if (clean.length < MIN_CAPTURE_CHARS) return null;

    // Dedupe probe — best-effort; FTS may be unavailable on some drivers.
    try {
      const terms = keywords(clean, 4);
      if (terms.length) {
        const existing = await searchMemories({ userId: USER_ID, sessionId, query: terms.join(" "), limit: 10 });
        const norm = normalizeForDedupe(clean);
        if (existing?.some((m) => normalizeForDedupe(m.content) === norm)) return null;
      }
    } catch { /* no FTS → skip dedupe, still store */ }

    return await createMemory({
      userId: USER_ID,
      sessionId,
      content: clean,
      metadata: { source, provider, model, capturedAt: Date.now() },
    });
  } catch {
    return null;
  }
}

/**
 * Recall relevant memories for the current prompt as a compact system block.
 * Empty string when nothing matches or anything fails. Token-capped via a
 * ~4 chars/token budget.
 */
export async function recallAiMemory({ text, sessionId = "", maxTokens = 400 } = {}) {
  try {
    const terms = keywords(text, 6);
    if (!terms.length) return "";
    const hits = await searchMemories({ userId: USER_ID, sessionId, query: terms.join(" "), limit: RECALL_LIMIT });
    if (!hits?.length) return "";

    const budgetChars = Math.max(200, Number(maxTokens) > 0 ? Number(maxTokens) * 4 : 1600);
    let used = 0;
    const lines = [];
    for (const hit of hits) {
      const line = `- ${String(hit.content || "").replace(/\s+/g, " ").trim()}`;
      if (used + line.length > budgetChars) break;
      lines.push(line);
      used += line.length;
    }
    if (!lines.length) return "";
    // Directive header: models apply facts far more reliably when told HOW to
    // use them (and what wins on conflict) instead of receiving a bare dump.
    // Kept compact (~35 tokens) so the injection budget stays with the facts.
    return [
      "# User memory — durable facts from earlier sessions",
      "Apply these when relevant. They override generic defaults. On conflict, the current request wins.",
      ...lines,
      "(Apply silently; never mention this block.)",
    ].join("\n");
  } catch {
    return "";
  }
}
