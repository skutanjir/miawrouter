import { describe, it, expect, vi, beforeEach } from "vitest";

const { createMemoryMock, searchMemoriesMock } = vi.hoisted(() => ({
  createMemoryMock: vi.fn(async ({ content }) => ({ id: "m1", content })),
  searchMemoriesMock: vi.fn(async () => []),
}));

vi.mock("@/lib/db/index.js", () => ({
  createMemory: createMemoryMock,
  searchMemories: searchMemoriesMock,
}));

const { looksImportant, extractLastUserText, keywords, captureAiMemory, recallAiMemory, extractImportantSentences } = await import(
  "../../src/lib/aiMemory/service.js"
);

describe("aiMemory heuristics", () => {
  it("flags explicit remember-markers (EN + ID)", () => {
    expect(looksImportant("Remember that I prefer bun over npm for this project")).toBe(true);
    expect(looksImportant("Ingat ya, jangan pakai npm, selalu gunakan pnpm di proyek saya")).toBe(true);
    expect(looksImportant("Root cause was a stale dispatcher cache; the fix is to clear it per origin")).toBe(true);
  });

  it("rejects short or plain prompts", () => {
    expect(looksImportant("hi")).toBe(false);
    expect(looksImportant("hello world this is just a normal test message")).toBe(false);
    expect(looksImportant(null)).toBe(false);
  });

  it("extracts last user text from Claude-shaped bodies", () => {
    const body = { messages: [{ role: "user", content: [{ type: "text", text: "halo dunia" }] }] };
    expect(extractLastUserText(body)).toBe("halo dunia");
    expect(extractLastUserText({ messages: [] })).toBe("");
  });

  it("picks salient keywords for FTS recall", () => {
    const kw = keywords("Fix the router memory leak in the proxyFetch handler");
    expect(kw).toContain("router");
    expect(kw).toContain("memory");
    expect(kw).not.toContain("the");
  });

  it("distills long prompts down to the important sentences", () => {
    const prompt = "Can you check the build? Remember that the router always deploys through Cloudflare. " +
      "Also look at src/index.js and tell me why tests fail. It worked when I pinned undici to v6.";
    const distilled = extractImportantSentences(prompt);
    expect(distilled).toContain("deploys through Cloudflare");
    expect(distilled).toContain("worked when I pinned undici");
    expect(distilled).not.toContain("look at src/index.js");
  });

  it("keeps short important prompts whole", () => {
    expect(extractImportantSentences("Remember that I prefer bun over npm")).toBe("Remember that I prefer bun over npm");
  });
});

describe("captureAiMemory", () => {
  beforeEach(() => {
    createMemoryMock.mockClear();
    searchMemoriesMock.mockClear();
    searchMemoriesMock.mockResolvedValue([]);
  });

  it("stores important prompts into the dashboard-scoped memories table", async () => {
    const row = await captureAiMemory({ text: "Remember that I prefer bun over npm for this project", sessionId: "s1", provider: "openai", model: "gpt-4o" });
    expect(row?.id).toBe("m1");
    expect(createMemoryMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "default",
      sessionId: "s1",
      metadata: expect.objectContaining({ source: "auto", provider: "openai", model: "gpt-4o" }),
    }));
  });

  it("skips unimportant prompts without touching the DB", async () => {
    const row = await captureAiMemory({ text: "just a normal question about nothing much really" });
    expect(row).toBeNull();
    expect(createMemoryMock).not.toHaveBeenCalled();
  });

  it("dedupes identical content within a session", async () => {
    searchMemoriesMock.mockResolvedValueOnce([
      { id: "old", content: "Remember that I prefer bun over npm for this project" },
    ]);
    const row = await captureAiMemory({ text: "REMEMBER that I prefer bun over npm for this project!!", sessionId: "s1" });
    expect(row).toBeNull();
    expect(createMemoryMock).not.toHaveBeenCalled();
  });
});

describe("recallAiMemory", () => {
  it("formats matching memories as an actionable system block", async () => {
    searchMemoriesMock.mockResolvedValue([
      { id: "a", content: "User prefers bun over npm" },
      { id: "b", content: "Project uses pnpm workspaces" },
    ]);
    const block = await recallAiMemory({ text: "add a script with bun to the router project", sessionId: "s1", maxTokens: 400 });
    expect(block).toContain("# User memory");
    expect(block).toContain("Apply these when relevant");
    expect(block).toContain("- User prefers bun over npm");
    expect(block).toContain("- Project uses pnpm workspaces");
    expect(block).toContain("never mention this block");
  });

  it("returns empty string when nothing matches", async () => {
    searchMemoriesMock.mockResolvedValue([]);
    expect(await recallAiMemory({ text: "completely unrelated query text here" })).toBe("");
  });

  it("fails open when FTS is unavailable", async () => {
    searchMemoriesMock.mockRejectedValue(new Error("FTS5_UNAVAILABLE"));
    expect(await recallAiMemory({ text: "anything at all" })).toBe("");
  });
});
