import { describe, it, expect, vi, beforeEach } from "vitest";

const { createMemoryMock, listMemoriesMock } = vi.hoisted(() => ({
  createMemoryMock: vi.fn(async ({ content, metadata, sessionId }) => ({
    id: "mem-test-1",
    content,
    metadata,
    sessionId,
  })),
  listMemoriesMock: vi.fn(async () => [
    { id: "mem-1", content: "Test memory" },
  ]),
}));

vi.mock("@/lib/db/index.js", () => ({
  createMemory: createMemoryMock,
  listMemories: listMemoriesMock,
  searchMemories: vi.fn(async () => []),
  deleteMemory: vi.fn(async () => true),
}));

const {
  saveHermesMemory,
  createHermesSkill,
  createHermesSubagent,
  detectWorkspaceLsp,
  getHermesAutonomyOverview,
} = await import("../../src/lib/hermes/autonomy.js");

const { SKILLS } = await import("../../src/shared/constants/skills.js");

describe("Hermes Agent Autonomy System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes Anti-Slop suite skills and Hermes autonomous capabilities in catalog", () => {
    const ids = SKILLS.map((s) => s.id);
    expect(ids).toContain("antislop");
    expect(ids).toContain("antislop-ui");
    expect(ids).toContain("antislop-copywriting");
    expect(ids).toContain("antislop-human");
    expect(ids).toContain("antislop-layoutmobile");
    expect(ids).toContain("antislop-code");
    expect(ids).toContain("hermes-agent");
    expect(ids).toContain("hermes-subagent");
    expect(ids).toContain("hermes-memory");
    expect(ids).toContain("hermes-skill-builder");
    expect(ids).toContain("hermes-lsp");
    expect(ids).toContain("hermes-plugins");
  });

  it("persists structured long-term memory via saveHermesMemory", async () => {
    const res = await saveHermesMemory({
      key: "user_style",
      value: { framework: "Laravel", indentation: "spaces" },
      scope: "global",
      tags: ["preferences"],
    });

    expect(res.ok).toBe(true);
    expect(createMemoryMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "default",
      sessionId: "global",
      metadata: expect.objectContaining({
        key: "user_style",
        source: "hermes-autonomy",
      }),
    }));
  });

  it("detects workspace language environments for automatic LSP configuration", () => {
    const lsp = detectWorkspaceLsp(process.cwd());
    expect(Array.isArray(lsp)).toBe(true);
    // MiawRouter is a TypeScript/JavaScript project with package.json
    expect(lsp.some((l) => l.language === "typescript")).toBe(true);
  });

  it("generates valid autonomy status overview", async () => {
    const overview = await getHermesAutonomyOverview();
    expect(overview.ok).toBe(true);
    expect(overview.agent).toContain("Hermes");
    expect(overview.capabilities).toContain("autonomous_memory_synthesis");
    expect(overview.capabilities).toContain("anti_slop_gate");
  });
});
