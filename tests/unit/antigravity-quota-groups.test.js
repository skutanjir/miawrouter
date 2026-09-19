import { describe, expect, it, vi } from "vitest";
import {
  ANTIGRAVITY_TARGET_ROWS,
  getAntigravityExplicitRows,
  getAntigravityFamily,
  hasAntigravityGroupedBuckets,
  matchAntigravityBucket,
} from "@/app/(dashboard)/dashboard/usage/components/ProviderLimits/QuotaTable.js";

describe("Antigravity Quota Table rows and grouping", () => {
  it("defines the 4 explicit target rows in correct order", () => {
    expect(ANTIGRAVITY_TARGET_ROWS.map((r) => r.key)).toEqual([
      "gemini_5h",
      "gemini_weekly",
      "claude_gpt_5h",
      "claude_gpt_weekly",
    ]);

    expect(ANTIGRAVITY_TARGET_ROWS.map((r) => r.label)).toEqual([
      "Gemini 5 hour",
      "Gemini weekly",
      "Claude 5 hour",
      "Claude weekly",
    ]);
  });

  it("identifies families accurately via getAntigravityFamily", () => {
    expect(getAntigravityFamily({ name: "Gemini 3.1 Pro" })).toBe("gemini");
    expect(getAntigravityFamily({ modelKey: "gemini_5h" })).toBe("gemini");
    expect(getAntigravityFamily({ name: "Claude 3.7 Sonnet" })).toBe("claude");
    expect(getAntigravityFamily({ modelKey: "claude_gpt_weekly" })).toBe("claude");
    expect(getAntigravityFamily({ name: "GPT-4o" })).toBe("claude");
    expect(getAntigravityFamily({ name: "Unknown" })).toBe("other");
    expect(getAntigravityFamily(null)).toBe("other");
  });

  it("matches buckets by normalized keys, candidate strings, or family+window", () => {
    const specGemini5h = ANTIGRAVITY_TARGET_ROWS.find((r) => r.key === "gemini_5h");
    const specClaudeWeekly = ANTIGRAVITY_TARGET_ROWS.find((r) => r.key === "claude_gpt_weekly");

    // Exact key
    expect(matchAntigravityBucket({ modelKey: "gemini_5h" }, specGemini5h)).toBe(true);
    // Alias / display name
    expect(matchAntigravityBucket({ name: "Gemini 5 hour" }, specGemini5h)).toBe(true);
    // Family + window
    expect(matchAntigravityBucket({ family: "gemini", window: "5h" }, specGemini5h)).toBe(true);
    expect(matchAntigravityBucket({ family: "claude", window: "weekly" }, specClaudeWeekly)).toBe(true);
    expect(matchAntigravityBucket({ modelKey: "3p-weekly" }, specClaudeWeekly)).toBe(false); // 3p needs family/window or matchKeys
    expect(matchAntigravityBucket({ modelKey: "3p-weekly", family: "claude", window: "weekly" }, specClaudeWeekly)).toBe(true);
  });

  it("detects whether grouped buckets exist", () => {
    expect(hasAntigravityGroupedBuckets([])).toBe(false);
    expect(hasAntigravityGroupedBuckets(null)).toBe(false);

    // Only raw models
    const rawQuotas = [
      { modelKey: "gemini-3.6-flash-high", name: "Gemini 3.6 Flash" },
      { modelKey: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet" },
    ];
    expect(hasAntigravityGroupedBuckets(rawQuotas)).toBe(false);

    // With grouped bucket
    const groupedQuotas = [
      { modelKey: "gemini_5h", name: "Gemini 5 hour", used: 10, total: 100 },
    ];
    expect(hasAntigravityGroupedBuckets(groupedQuotas)).toBe(true);
  });

  it("produces 4 explicit rows with honest unavailable state when weekly buckets are missing", () => {
    const inputQuotas = [
      {
        modelKey: "gemini_5h",
        name: "Gemini 5 hour",
        used: 200,
        total: 1000,
        remaining: 80,
        resetAt: "2026-07-25T15:00:00Z",
      },
      {
        modelKey: "claude_gpt_5h",
        name: "Claude 5 hour",
        used: 500,
        total: 1000,
        remaining: 50,
        resetAt: "2026-07-25T16:00:00Z",
      },
    ];

    const rows = getAntigravityExplicitRows(inputQuotas);
    expect(rows).toHaveLength(4);

    // Available 5h rows
    expect(rows[0]).toMatchObject({
      key: "gemini_5h",
      name: "Gemini 5 hour",
      isAvailable: true,
      remaining: 80,
      resetAt: "2026-07-25T15:00:00Z",
    });
    expect(rows[2]).toMatchObject({
      key: "claude_gpt_5h",
      name: "Claude 5 hour",
      isAvailable: true,
      remaining: 50,
      resetAt: "2026-07-25T16:00:00Z",
    });

    // Honest unavailable weekly rows
    expect(rows[1]).toMatchObject({
      key: "gemini_weekly",
      name: "Gemini weekly",
      isAvailable: false,
      remaining: null,
      used: null,
      total: null,
      resetAt: null,
    });
    expect(rows[3]).toMatchObject({
      key: "claude_gpt_weekly",
      name: "Claude weekly",
      isAvailable: false,
      remaining: null,
      used: null,
      total: null,
      resetAt: null,
    });
  });

  it("maps all 4 rows when all buckets are present", () => {
    const inputQuotas = [
      { modelKey: "gemini_5h", name: "Gemini 5 hour", used: 150, total: 1000, resetAt: "2026-07-25T15:00:00Z" },
      { modelKey: "gemini_weekly", name: "Gemini weekly", used: 350, total: 1000, resetAt: "2026-08-01T12:00:00Z" },
      { modelKey: "claude_gpt_5h", name: "Claude 5 hour", used: 500, total: 1000, resetAt: "2026-07-25T16:00:00Z" },
      { modelKey: "claude_gpt_weekly", name: "Claude weekly", used: 600, total: 1000, resetAt: "2026-08-01T12:00:00Z" },
    ];

    const rows = getAntigravityExplicitRows(inputQuotas);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.isAvailable)).toBe(true);
    expect(rows.map((r) => r.remaining)).toEqual([85, 65, 50, 40]);
  });
});
