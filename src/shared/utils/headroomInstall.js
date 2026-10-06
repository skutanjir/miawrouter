export async function waitForHeadroomInstall(job, { fetchImpl = fetch, onProgress = () => {}, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  while (job?.status === "running") {
    await wait(2000);
    const response = await fetchImpl("/api/headroom/extras?log=1", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not read setup progress. Reopen setup to check the ongoing installation.");
    const data = await response.json();
    onProgress(data);
    if (!data.job || data.job.id !== job.id) throw new Error("Setup status changed. Recheck Headroom before retrying.");
    job = data.job;
  }
  if (job?.status === "failed") throw new Error(job.error || "Headroom setup failed");
  return job?.result || {};
}
