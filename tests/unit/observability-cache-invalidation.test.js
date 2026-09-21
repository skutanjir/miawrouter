import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

let tempDir;
const origDataDir = process.env.DATA_DIR;
const origEnableLogs = process.env.ENABLE_REQUEST_LOGS;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "miawrouter-obs-cache-"));
  process.env.DATA_DIR = tempDir;
  delete process.env.ENABLE_REQUEST_LOGS;
  delete global._dbAdapter;
});

afterEach(() => {
  try { global._dbAdapter?.instance?.close?.(); } catch {}
  delete global._dbAdapter;
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  if (origDataDir !== undefined) process.env.DATA_DIR = origDataDir;
  else delete process.env.DATA_DIR;
  if (origEnableLogs !== undefined) process.env.ENABLE_REQUEST_LOGS = origEnableLogs;
  else delete process.env.ENABLE_REQUEST_LOGS;
});

describe("observability config cache invalidation", () => {
  it("immediately reflects updateSettings changes in getObservabilityConfig without waiting 5s", async () => {
    const { getObservabilityConfig, invalidateObservabilityConfigCache } = await import("@/lib/db/repos/requestDetailsRepo.js");
    const { updateSettings } = await import("@/lib/db/repos/settingsRepo.js");

    // Initial state: default disabled
    const initialConfig = await getObservabilityConfig();
    expect(initialConfig.enabled).toBe(false);
    expect(initialConfig.privacyMode).toBe("normal");

    // Update settings via settingsRepo
    await updateSettings({
      enableObservability: true,
      privacyMode: "anonymized",
      observabilityBatchSize: 42,
    });

    // Must immediately reflect new values without waiting 5000ms TTL
    const updatedConfig = await getObservabilityConfig();
    expect(updatedConfig.enabled).toBe(true);
    expect(updatedConfig.privacyMode).toBe("anonymized");
    expect(updatedConfig.batchSize).toBe(42);

    // Verify manual invalidation function clears cache cleanly
    await updateSettings({ privacyMode: "paranoid" });
    if (typeof invalidateObservabilityConfigCache === "function") {
      invalidateObservabilityConfigCache();
    }
    const flushedConfig = await getObservabilityConfig();
    expect(flushedConfig.privacyMode).toBe("paranoid");
  });

  it("exports invalidateObservabilityConfigCache and getObservabilityConfig from db barrel", async () => {
    const db = await import("@/lib/db/index.js");
    expect(typeof db.invalidateObservabilityConfigCache).toBe("function");
    expect(typeof db.getObservabilityConfig).toBe("function");
  });
});
