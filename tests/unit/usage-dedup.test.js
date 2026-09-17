// Regression: per-request usage ids. The usage history used to dedupe on
// (timestamp, provider, model, connectionId, apiKey, token counts) — so two
// genuinely distinct requests that landed in the same millisecond with equal
// token counts collapsed into ONE row and the router undercounted usage.
// A stable per-request id removes the guesswork.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const originalDataDir = process.env.DATA_DIR;
let tempDir;
let db;

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miawrouter-usage-dedup-"));
  process.env.DATA_DIR = tempDir;
  vi.resetModules();
  db = await import("@/lib/db/index.js");
  await db.initDb();
});

afterAll(() => {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
});

const usage = (overrides) => ({
  provider: "openai",
  model: "gpt-4",
  connectionId: "conn-a",
  tokens: { prompt_tokens: 10, completion_tokens: 5 },
  status: "ok",
  ...overrides,
});

describe("saveRequestUsage dedup", () => {
  it("counts two distinct requests sharing a millisecond and identical tokens", async () => {
    const timestamp = "2026-01-01T00:00:00.000Z";

    await db.saveRequestUsage(usage({ timestamp, requestId: "req-a" }));
    await db.saveRequestUsage(usage({ timestamp, requestId: "req-b" }));

    const hist = await db.getUsageHistory({ provider: "openai", limit: 100 });
    const rows = hist.filter((r) => r.timestamp === timestamp);
    expect(rows.length).toBe(2);
  });

  it("collapses a repeated write of the SAME request id to one row", async () => {
    const timestamp = "2026-01-02T00:00:00.000Z";

    await db.saveRequestUsage(usage({ timestamp, requestId: "req-dup", endpoint: null }));
    await db.saveRequestUsage(
      usage({ timestamp, requestId: "req-dup", endpoint: "/v1/chat/completions" })
    );

    const hist = await db.getUsageHistory({ provider: "openai", limit: 100 });
    const rows = hist.filter((r) => r.timestamp === timestamp);
    expect(rows.length).toBe(1);
    // The second write enriches the existing row instead of adding a new one.
    expect(rows[0].endpoint).toBe("/v1/chat/completions");
  });

  it("keeps the legacy content-based dedup for callers without a request id", async () => {
    const timestamp = "2026-01-03T00:00:00.000Z";

    await db.saveRequestUsage(usage({ timestamp }));
    await db.saveRequestUsage(usage({ timestamp }));

    const hist = await db.getUsageHistory({ provider: "openai", limit: 100 });
    const rows = hist.filter((r) => r.timestamp === timestamp);
    expect(rows.length).toBe(1);
  });

  it("aggregates the daily bucket once per distinct request", async () => {
    const before = await db.getUsageStats("all");
    const timestamp = "2026-02-01T00:00:00.000Z";

    await db.saveRequestUsage(usage({ timestamp, requestId: "agg-a" }));
    await db.saveRequestUsage(usage({ timestamp, requestId: "agg-b" }));

    const after = await db.getUsageStats("all");
    expect(after.totalRequests - before.totalRequests).toBe(2);
    expect(after.totalPromptTokens - before.totalPromptTokens).toBe(20);
  });
});
