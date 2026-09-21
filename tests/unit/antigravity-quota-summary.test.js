import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { getAntigravityUsage } from "../../open-sse/services/usage/google.js";
import { parseQuotaData } from "@/app/(dashboard)/dashboard/usage/components/ProviderLimits/utils.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

const MOCK_LOAD_CODE_ASSIST = {
  cloudaicompanionProject: "projects/test-project-123",
  currentTier: { name: "Pro" },
};

const MOCK_FETCH_AVAILABLE_MODELS = {
  models: {
    "gemini-3.6-flash-high": {
      displayName: "Gemini 3.6 Flash (High)",
      quotaInfo: { remainingFraction: 0.8, resetTime: "2026-07-25T12:00:00Z" },
    },
    "gemini-3.6-flash-low": {
      displayName: "Gemini 3.6 Flash (Low)",
      quotaInfo: { remainingFraction: 0.2, resetTime: "2026-07-25T12:00:00Z" },
    },
  },
};

const MOCK_QUOTA_SUMMARY_VALID = {
  groups: [
    {
      displayName: "Gemini Models",
      description: "Google Gemini family quota",
      buckets: [
        {
          bucketId: "gemini-5h",
          window: "5h",
          remainingFraction: 0.85,
          resetTime: "2026-07-25T15:00:00Z",
        },
        {
          bucketId: "gemini-weekly",
          window: "weekly",
          remainingFraction: 0.65,
          resetTime: "2026-08-01T12:00:00Z",
        },
      ],
    },
    {
      displayName: "Claude and GPT Models",
      description: "Anthropic Claude and OpenAI GPT family quota",
      buckets: [
        {
          bucketId: "3p-5h",
          window: "5h",
          remainingFraction: 0.5,
          resetTime: "2026-07-25T16:00:00Z",
        },
        {
          bucketId: "3p-weekly",
          window: "weekly",
          remainingFraction: 0.4,
          resetTime: "2026-08-01T12:00:00Z",
        },
      ],
    },
  ],
};

describe("Antigravity Quota Summary: 5h and Weekly Family Quotas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and normalizes retrieveUserQuotaSummary with exact keys, display names, and percentage conversion", async () => {
    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) {
        return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      }
      if (url.includes(":fetchAvailableModels")) {
        return jsonResponse(MOCK_FETCH_AVAILABLE_MODELS);
      }
      if (url.includes(":retrieveUserQuotaSummary")) {
        return jsonResponse(MOCK_QUOTA_SUMMARY_VALID);
      }
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    expect(usage.plan).toBe("Pro");

    // 1. Grouped quota keys present
    expect(usage.quotas).toHaveProperty("gemini_5h");
    expect(usage.quotas).toHaveProperty("gemini_weekly");
    expect(usage.quotas).toHaveProperty("claude_gpt_5h");
    expect(usage.quotas).toHaveProperty("claude_gpt_weekly");

    // 2. Display names
    expect(usage.quotas.gemini_5h.displayName).toBe("Gemini 5 hour");
    expect(usage.quotas.gemini_weekly.displayName).toBe("Gemini weekly");
    expect(usage.quotas.claude_gpt_5h.displayName).toBe("Claude 5 hour");
    expect(usage.quotas.claude_gpt_weekly.displayName).toBe("Claude weekly");

    // 3. Percentage and used/total conversion
    expect(usage.quotas.gemini_5h.remainingPercentage).toBe(85);
    expect(usage.quotas.gemini_5h.used).toBe(150);
    expect(usage.quotas.gemini_5h.total).toBe(1000);
    expect(usage.quotas.gemini_5h.resetAt).toBe("2026-07-25T15:00:00.000Z");

    expect(usage.quotas.gemini_weekly.remainingPercentage).toBe(65);
    expect(usage.quotas.gemini_weekly.used).toBe(350);
    expect(usage.quotas.gemini_weekly.total).toBe(1000);
    expect(usage.quotas.gemini_weekly.resetAt).toBe("2026-08-01T12:00:00.000Z");

    expect(usage.quotas.claude_gpt_5h.remainingPercentage).toBe(50);
    expect(usage.quotas.claude_gpt_5h.used).toBe(500);
    expect(usage.quotas.claude_gpt_5h.total).toBe(1000);

    expect(usage.quotas.claude_gpt_weekly.remainingPercentage).toBe(40);
    expect(usage.quotas.claude_gpt_weekly.used).toBe(600);
    expect(usage.quotas.claude_gpt_weekly.total).toBe(1000);

    // 4. Secondary metadata for Claude/GPT family
    expect(
      usage.quotas.claude_gpt_5h.rawGroup ||
      usage.quotas.claude_gpt_5h.description ||
      usage.quotas.claude_gpt_5h.secondaryMetadata?.groupName
    ).toMatch(/GPT/i);

    // 5. Preserves backward compatibility: per-model entries still exist in API response
    expect(usage.quotas).toHaveProperty("gemini-3.6-flash-high");
    expect(usage.quotas["gemini-3.6-flash-high"].remainingPercentage).toBe(80);
  });

  it("handles alternative upstream shapes and never treats available:true as full quota", async () => {
    const alternativePayload = {
      response: {
        groups: [
          {
            name: "gemini",
            buckets: [
              {
                bucketId: "gemini_5h",
                remaining_fraction: 0.9,
                reset_time: "2026-07-25T17:00:00Z",
              },
              {
                bucketId: "gemini_weekly",
                remaining: { remaining_fraction: 0.75 },
                reset_time: "2026-08-01T12:00:00Z",
              },
            ],
          },
          {
            name: "claude-and-gpt",
            buckets: [
              {
                bucketId: "3p_5h",
                remaining: { case: "remainingFraction", value: 0.3 },
                reset_time: "2026-07-25T17:00:00Z",
              },
              {
                bucketId: "3p_weekly",
                available: true,
                reset_time: "2026-08-01T12:00:00Z",
              },
            ],
          },
        ],
      },
    };

    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) return jsonResponse({ models: {} });
      if (url.includes(":retrieveUserQuotaSummary")) return jsonResponse(alternativePayload);
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    expect(usage.quotas.gemini_5h.remainingPercentage).toBe(90);
    expect(usage.quotas.gemini_weekly.remainingPercentage).toBe(75);
    expect(usage.quotas.claude_gpt_5h.remainingPercentage).toBe(30);
    expect(usage.quotas.claude_gpt_weekly).toBeUndefined();
  });

  it("handles exhausted quota (remainingFraction === 0) correctly and skips invalid remainingFraction", async () => {
    const edgePayload = {
      groups: [
        {
          displayName: "Gemini Models",
          buckets: [
            {
              bucketId: "gemini-5h",
              remainingFraction: 0,
              resetTime: "2026-07-25T12:00:00Z",
            },
            {
              bucketId: "gemini-weekly",
              remainingFraction: null, // missing/invalid
              resetTime: "2026-08-01T12:00:00Z",
            },
          ],
        },
      ],
    };

    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) return jsonResponse(MOCK_FETCH_AVAILABLE_MODELS);
      if (url.includes(":retrieveUserQuotaSummary")) return jsonResponse(edgePayload);
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    // Exhausted
    expect(usage.quotas.gemini_5h.remainingPercentage).toBe(0);
    expect(usage.quotas.gemini_5h.used).toBe(1000);
    expect(usage.quotas.gemini_5h.total).toBe(1000);

    // Missing remainingFraction must not be added with NaN
    expect(usage.quotas.gemini_weekly).toBeUndefined();
  });

  it("prefers daily Cloud Code quota over stale prod 100%", async () => {
    const modelCalls = [];
    const summaryCalls = [];

    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) {
        modelCalls.push(url);
        if (url.includes("daily-cloudcode-pa")) {
          return jsonResponse({
            models: {
              "gemini-3.8-flash-high": {
                displayName: "Gemini 3.8 Flash (High)",
                quotaInfo: { remainingFraction: 0.42, resetTime: "2026-09-21T12:00:00Z" },
              },
            },
          });
        }
        return jsonResponse({
          models: {
            "gemini-3.8-flash-high": {
              displayName: "Gemini 3.8 Flash (High)",
              quotaInfo: { remainingFraction: 1, resetTime: "2026-09-21T12:00:00Z" },
            },
          },
        });
      }
      if (url.includes(":retrieveUserQuotaSummary")) {
        summaryCalls.push(url);
        if (url.includes("daily-cloudcode-pa")) {
          return jsonResponse({
            groups: [{
              displayName: "Gemini Models",
              buckets: [{
                bucketId: "gemini-5h",
                window: "5h",
                remainingFraction: 0.42,
                resetTime: "2026-09-21T12:00:00Z",
              }],
            }],
          });
        }
        return jsonResponse({
          groups: [{
            displayName: "Gemini Models",
            buckets: [{
              bucketId: "gemini-5h",
              window: "5h",
              remainingFraction: 1,
              resetTime: "2026-09-21T12:00:00Z",
            }],
          }],
        });
      }
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    expect(modelCalls[0]).toContain("daily-cloudcode-pa.googleapis.com");
    expect(summaryCalls[0]).toContain("daily-cloudcode-pa.googleapis.com");
    expect(usage.quotas["gemini-3.8-flash-high"].remainingPercentage).toBe(42);
    expect(usage.quotas.gemini_5h.remainingPercentage).toBe(42);
  });

  it("falls back to prod when daily quota endpoints fail", async () => {
    const summaryCalls = [];

    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) return jsonResponse(MOCK_FETCH_AVAILABLE_MODELS);
      if (url.includes(":retrieveUserQuotaSummary")) {
        summaryCalls.push(url);
        if (url.includes("daily-cloudcode-pa")) {
          return jsonResponse({ error: "Unavailable" }, 503);
        }
        return jsonResponse(MOCK_QUOTA_SUMMARY_VALID);
      }
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    expect(summaryCalls[0]).toContain("daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary");
    expect(summaryCalls[1]).toContain("cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary");
    expect(usage.quotas).toHaveProperty("gemini_5h");
  });

  it("preserves per-model 5h quotas if retrieveUserQuotaSummary completely fails", async () => {
    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) return jsonResponse(MOCK_FETCH_AVAILABLE_MODELS);
      if (url.includes(":retrieveUserQuotaSummary")) {
        return jsonResponse({ error: "Not Found" }, 404);
      }
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    expect(usage.plan).toBe("Pro");
    expect(usage.quotas).toHaveProperty("gemini-3.6-flash-high");
    expect(usage.quotas["gemini-3.6-flash-high"].remainingPercentage).toBe(80);
    expect(usage.quotas.gemini_5h).toBeUndefined();
  });

  it("reconciles stale 100% summary 5h quota when active per-model quota is consumed", async () => {
    const mockModelsWithUsage = {
      models: {
        "gemini-3.6-flash-high": {
          displayName: "Gemini 3.6 Flash (High)",
          quotaInfo: { remainingFraction: 0.6, resetTime: "2026-07-25T14:00:00Z" },
        },
        "gemini-3.6-flash-medium": {
          displayName: "Gemini 3.6 Flash (Medium)",
          quotaInfo: { remainingFraction: 0.8, resetTime: "2026-07-25T14:00:00Z" },
        },
      },
    };

    const mockSummaryStale100 = {
      groups: [
        {
          displayName: "Gemini Models",
          buckets: [
            {
              bucketId: "gemini-5h",
              window: "5h",
              remainingFraction: 1.0, // Stale 100% despite models being at 0.6 and 0.8
              resetTime: "2026-07-25T15:00:00Z",
            },
            {
              bucketId: "gemini-weekly",
              window: "weekly",
              remainingFraction: 0.95,
              resetTime: "2026-08-01T12:00:00Z",
            },
          ],
        },
      ],
    };

    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) return jsonResponse(mockModelsWithUsage);
      if (url.includes(":retrieveUserQuotaSummary")) return jsonResponse(mockSummaryStale100);
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});

    // Weekly bucket is trusted from summary
    expect(usage.quotas.gemini_weekly).toBeDefined();
    expect(usage.quotas.gemini_weekly.remainingPercentage).toBe(95);

    // Stale 5h 100% must track the most-consumed model in the family, not vanish
    // (vanishing leaves weekly grouped mode which hides per-model bars).
    expect(usage.quotas.gemini_5h.remainingPercentage).toBe(60);
    expect(usage.quotas.gemini_5h.used).toBe(400);
  });

  it("reads nested quotaInfo remainingFraction from fetchAvailableModels", async () => {
    proxyAwareFetch.mockImplementation(async (url) => {
      if (url.includes(":loadCodeAssist")) return jsonResponse(MOCK_LOAD_CODE_ASSIST);
      if (url.includes(":fetchAvailableModels")) {
        return jsonResponse({
          models: {
            "gemini-3.8-flash-high": {
              displayName: "Gemini 3.8 Flash (High)",
              quotaInfo: {
                remaining: { remainingFraction: 0.3 },
                resetTime: "2026-09-21T12:00:00Z",
              },
            },
          },
        });
      }
      if (url.includes(":retrieveUserQuotaSummary")) return jsonResponse({ error: "Not Found" }, 404);
      return jsonResponse({}, 404);
    });

    const usage = await getAntigravityUsage("test-access-token", {});
    expect(usage.quotas["gemini-3.8-flash-high"].remainingPercentage).toBe(30);
    expect(usage.quotas["gemini-3.8-flash-high"].used).toBe(700);
  });

  describe("parseQuotaData normalization in UI utils", () => {
    it("normalizes grouped quotas and hides raw model entries when grouped windows exist", () => {
      const apiData = {
        quotas: {
          gemini_5h: {
            displayName: "Gemini 5 hour",
            used: 150,
            total: 1000,
            resetAt: "2026-07-25T15:00:00Z",
            remainingPercentage: 85,
            window: "hourly",
            family: "gemini",
          },
          gemini_weekly: {
            displayName: "Gemini weekly",
            used: 350,
            total: 1000,
            resetAt: "2026-08-01T12:00:00Z",
            remainingPercentage: 65,
            window: "weekly",
            family: "gemini",
          },
          claude_gpt_5h: {
            displayName: "Claude 5 hour",
            used: 500,
            total: 1000,
            resetAt: "2026-07-25T16:00:00Z",
            remainingPercentage: 50,
            window: "hourly",
            family: "claude",
          },
          claude_gpt_weekly: {
            displayName: "Claude weekly",
            used: 600,
            total: 1000,
            resetAt: "2026-08-01T12:00:00Z",
            remainingPercentage: 40,
            window: "weekly",
            family: "claude",
          },
          "gemini-3.6-flash-high": {
            displayName: "Gemini 3.6 Flash (High)",
            used: 200,
            total: 1000,
            resetAt: "2026-07-25T12:00:00Z",
            remainingPercentage: 80,
          },
        },
      };

      const rows = parseQuotaData("antigravity", apiData);

      expect(rows).toHaveLength(4);
      expect(rows.map((r) => r.modelKey)).toEqual([
        "gemini_5h",
        "gemini_weekly",
        "claude_gpt_5h",
        "claude_gpt_weekly",
      ]);
      expect(rows.map((r) => r.name)).toEqual([
        "Gemini 5 hour",
        "Gemini weekly",
        "Claude 5 hour",
        "Claude weekly",
      ]);
    });

    it("keeps raw model entries when no grouped windows are present (backward compatibility)", () => {
      const legacyData = {
        quotas: {
          "gemini-3.6-flash-high": {
            displayName: "Gemini 3.6 Flash (High)",
            used: 200,
            total: 1000,
            resetAt: "2026-07-25T12:00:00Z",
            remainingPercentage: 80,
          },
        },
      };

      const rows = parseQuotaData("antigravity", legacyData);
      expect(rows).toHaveLength(1);
      expect(rows[0].modelKey).toBe("gemini-3.6-flash-high");
      expect(rows[0].name).toBe("Gemini 3.6 Flash (High)");
    });
  });
});
