import { randomUUID } from "node:crypto";
import { installHeadroomExtras } from "./process.js";

const state = globalThis.__miawHeadroomInstallJob ||= { job: null };

export function getHeadroomInstallJob() {
  if (!state.job) return null;
  return { ...state.job, elapsedSeconds: Math.round(((state.job.finishedAt || Date.now()) - state.job.startedAt) / 1000) };
}

// Keep setup alive independently of the request and avoid competing pip/uv writes.
export function startHeadroomInstallJob(extras, options, { install = installHeadroomExtras } = {}) {
  if (state.job?.status === "running") return getHeadroomInstallJob();
  const job = { id: randomUUID(), status: "running", startedAt: Date.now(), finishedAt: null };
  state.job = job;
  Promise.resolve().then(() => install(extras, options)).then(
    (result) => { Object.assign(job, { status: "completed", result, finishedAt: Date.now() }); },
    (error) => { Object.assign(job, { status: "failed", error: error.message, code: error.code || "INSTALL_FAILED", finishedAt: Date.now() }); },
  );
  return getHeadroomInstallJob();
}
