import { describe, it, expect, vi } from "vitest";
vi.mock("../../src/lib/headroom/process.js", () => ({ installHeadroomExtras: vi.fn() }));
import { getHeadroomInstallJob, startHeadroomInstallJob } from "../../src/lib/headroom/installJob.js";
import { waitForHeadroomInstall } from "../../src/shared/utils/headroomInstall.js";

describe("background Headroom setup", () => {
  it("returns immediately, reuses a running job and records completion", async () => {
    let complete;
    const install = vi.fn(() => new Promise((resolve) => { complete = resolve; }));
    const first = startHeadroomInstallJob([], { installer: "uv" }, { install });
    expect(first.status).toBe("running");
    expect(startHeadroomInstallJob(["ml"], {}, { install }).id).toBe(first.id);
    await Promise.resolve();
    expect(install).toHaveBeenCalledTimes(1);
    complete({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getHeadroomInstallJob()).toMatchObject({ id: first.id, status: "completed", result: { success: true } });
  });
  it("records installation failure without an unhandled rejection", async () => {
    startHeadroomInstallJob([], {}, { install: async () => { throw new Error("download failed"); } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getHeadroomInstallJob()).toMatchObject({ status: "failed", error: "download failed" });
  });
  it("waits across multiple progress requests and reports the final result", async () => {
    const onProgress = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValueOnce(Response.json({ log: "Downloading", job: { id: "job", status: "running" } })).mockResolvedValueOnce(Response.json({ log: "Done", job: { id: "job", status: "completed", result: { version: "test" } } }));
    expect(await waitForHeadroomInstall({ id: "job", status: "running" }, { fetchImpl, onProgress, wait: async () => {} })).toEqual({ version: "test" });
    expect(onProgress).toHaveBeenCalledTimes(2);
  });
  it("does not treat a failed background job as successful setup", async () => {
    await expect(waitForHeadroomInstall({ status: "failed", error: "failed" })).rejects.toThrow("failed");
  });
});
