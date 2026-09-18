import https from "https";
import fs from "fs";
import path from "path";
import pkg from "../../../../package.json" with { type: "json" };

const NPM_PACKAGE_NAME = "miawrouter";
const VERSION_CACHE_TTL_MS = 3600000; // cache npm latest lookup for 1h

// Survive hot reload; one cache per process
const versionCache = (global.__npmVersionCache ??= {
  value: null,
  fetchedAt: 0,
  inFlight: false,
});

function skipUpdateCheck() {
  // CLI --skip-update and common env gates — never block the dashboard on npm.
  if (process.env.MIAWROUTER_SKIP_UPDATE === "1") return true;
  if (process.env.SKIP_UPDATE === "1") return true;
  if (process.argv.includes("--skip-update")) return true;
  return false;
}

// Fetch latest version from npm registry (never awaited on the request path)
function fetchLatestVersion() {
  return new Promise((resolve) => {
    const req = https.get(
      `https://registry.npmjs.org/${NPM_PACKAGE_NAME}/latest`,
      { timeout: 4000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data).version || null);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function scheduleNpmLookup() {
  if (skipUpdateCheck()) return;
  if (versionCache.inFlight) return;
  const fresh =
    versionCache.value &&
    Date.now() - versionCache.fetchedAt < VERSION_CACHE_TTL_MS;
  if (fresh) return;

  versionCache.inFlight = true;
  fetchLatestVersion()
    .then((latest) => {
      if (latest) {
        versionCache.value = latest;
        versionCache.fetchedAt = Date.now();
      }
    })
    .finally(() => {
      versionCache.inFlight = false;
    });
}

function resolveCurrentVersion() {
  try {
    const candidates = [
      path.join(process.cwd(), "package.json"),
      path.join(process.cwd(), "..", "package.json"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf8"));
        if (data.version) return data.version;
      }
    }
  } catch {
    /* fall through to pkg.version */
  }
  return pkg.version;
}

/**
 * Always return immediately with currentVersion (+ cached latest if any).
 * npm registry lookup runs in the background and never blocks refresh.
 */
export async function GET() {
  const currentVersion = resolveCurrentVersion();
  scheduleNpmLookup();

  const latestVersion = versionCache.value;
  const hasUpdate = latestVersion
    ? compareVersions(latestVersion, currentVersion) > 0
    : false;

  return Response.json({
    currentVersion,
    latestVersion,
    hasUpdate,
    checking: versionCache.inFlight === true,
  });
}
