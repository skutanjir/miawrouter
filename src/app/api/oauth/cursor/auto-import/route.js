import { NextResponse } from "next/server";
import { access, constants } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const ACCESS_TOKEN_KEYS = ["cursorAuth/accessToken", "cursorAuth/token"];
const MACHINE_ID_KEYS = [
  "storage.serviceMachineId",
  "storage.machineId",
  "telemetry.machineId",
];
const LOOKUP_KEYS = [...ACCESS_TOKEN_KEYS, ...MACHINE_ID_KEYS];

/** Platform-specific candidate paths. macOS/Windows probe several installs; Linux has one. */
function getCandidatePaths(platform) {
  const home = homedir();

  if (platform === "darwin") {
    return [
      join(
        home,
        "Library/Application Support/Cursor/User/globalStorage/state.vscdb",
      ),
      join(
        home,
        "Library/Application Support/Cursor - Insiders/User/globalStorage/state.vscdb",
      ),
    ];
  }

  if (platform === "win32") {
    const appData = process.env.APPDATA || join(home, "AppData", "Roaming");
    const localAppData =
      process.env.LOCALAPPDATA || join(home, "AppData", "Local");
    return [
      join(appData, "Cursor", "User", "globalStorage", "state.vscdb"),
      join(
        appData,
        "Cursor - Insiders",
        "User",
        "globalStorage",
        "state.vscdb",
      ),
      join(localAppData, "Cursor", "User", "globalStorage", "state.vscdb"),
      join(
        localAppData,
        "Programs",
        "Cursor",
        "User",
        "globalStorage",
        "state.vscdb",
      ),
    ];
  }

  return [join(home, ".config/Cursor/User/globalStorage/state.vscdb")];
}

/** Cursor stores some values as JSON-encoded strings; unwrap those, leave raw strings alone. */
const unwrapJsonString = (value) => {
  if (typeof value !== "string") return value;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : value;
  } catch {
    return value;
  }
};

function pickExactTokens(rows) {
  const byKey = new Map();
  for (const row of rows || []) {
    if (row && typeof row.key === "string") byKey.set(row.key, row.value);
  }

  let accessToken = null;
  for (const key of ACCESS_TOKEN_KEYS) {
    const raw = byKey.get(key);
    if (raw) {
      accessToken = unwrapJsonString(raw);
      break;
    }
  }

  let machineId = null;
  for (const key of MACHINE_ID_KEYS) {
    const raw = byKey.get(key);
    if (raw) {
      machineId = unwrapJsonString(raw);
      break;
    }
  }

  return { accessToken, machineId };
}

/** Key names drift between Cursor releases, so match on the trailing concept. */
function pickFuzzyTokens(rows) {
  let accessToken = null;
  let machineId = null;
  for (const row of rows || []) {
    if (!row || typeof row.key !== "string") continue;
    if (!accessToken && /accesstoken/i.test(row.key)) {
      accessToken = unwrapJsonString(row.value);
    }
    if (!machineId && /machineid/i.test(row.key)) {
      machineId = unwrapJsonString(row.value);
    }
  }
  return { accessToken, machineId };
}

function readTokensFromDb(db) {
  const placeholders = LOOKUP_KEYS.map(() => "?").join(", ");
  const exact = db
    .prepare(`SELECT key, value FROM itemTable WHERE key IN (${placeholders})`)
    .all(...LOOKUP_KEYS);
  const fromExact = pickExactTokens(exact);
  if (fromExact.accessToken && fromExact.machineId) return fromExact;

  const fuzzy = db
    .prepare(
      "SELECT key, value FROM itemTable WHERE key LIKE ? OR key LIKE ?",
    )
    .all("%accessToken%", "%machineId%");
  const fromFuzzy = pickFuzzyTokens(fuzzy);

  return {
    accessToken: fromExact.accessToken || fromFuzzy.accessToken,
    machineId: fromExact.machineId || fromFuzzy.machineId,
  };
}

/** Native module load is lazy so the route stays importable when bindings are unavailable. */
async function loadBetterSqlite() {
  const mod = await import("better-sqlite3");
  return mod.default ?? mod;
}

/** Fallback used only when the native module cannot be loaded at all. */
async function extractTokensViaCLI(dbPath) {
  const query = async (key) => {
    const { stdout } = await execFileAsync(
      "sqlite3",
      [dbPath, `SELECT value FROM itemTable WHERE key='${key}' LIMIT 1`],
      { timeout: 10000 },
    );
    return stdout.trim();
  };

  let accessToken = null;
  for (const key of ACCESS_TOKEN_KEYS) {
    try {
      const raw = await query(key);
      if (raw) {
        accessToken = unwrapJsonString(raw);
        break;
      }
    } catch {
      /* try next */
    }
  }

  let machineId = null;
  for (const key of MACHINE_ID_KEYS) {
    try {
      const raw = await query(key);
      if (raw) {
        machineId = unwrapJsonString(raw);
        break;
      }
    } catch {
      /* try next */
    }
  }

  return { accessToken, machineId };
}

async function isCursorInstalled() {
  try {
    await execFileAsync("which", ["cursor"], { timeout: 5000 });
    return true;
  } catch {
    try {
      const desktopFile = join(
        homedir(),
        ".local/share/applications/cursor.desktop",
      );
      await access(desktopFile, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

const notFoundResponse = (platform, candidates) =>
  NextResponse.json({
    found: false,
    error:
      platform === "darwin"
        ? `Cursor database not found in known macOS locations. Checked:\n${candidates.join("\n")}\n\nMake sure Cursor IDE is installed and opened at least once.`
        : `Cursor database not found. Checked locations:\n${candidates.join("\n")}\n\nMake sure Cursor IDE is installed and opened at least once.`,
  });

/**
 * GET /api/oauth/cursor/auto-import
 * Auto-detect and extract Cursor tokens from the local SQLite database.
 * Strategy: better-sqlite3 → sqlite3 CLI (when native bindings are missing)
 */
export async function GET() {
  const platform = process.platform;
  if (platform !== "darwin" && platform !== "win32" && platform !== "linux") {
    return NextResponse.json(
      { found: false, error: "Unsupported platform" },
      { status: 400 },
    );
  }

  const candidates = getCandidatePaths(platform);

  // Linux has exactly one known location: no probing, the open attempt is the detection.
  let dbPath = platform === "linux" ? candidates[0] : null;
  if (!dbPath) {
    for (const candidate of candidates) {
      try {
        await access(candidate, constants.R_OK);
        dbPath = candidate;
        break;
      } catch {
        // Try next candidate
      }
    }
    if (!dbPath) return notFoundResponse(platform, candidates);
  }

  let tokens = null;
  let openFailed = false;

  let Database = null;
  try {
    Database = await loadBetterSqlite();
  } catch {
    // Native bindings unavailable — fall back to the sqlite3 CLI below.
  }

  if (Database) {
    try {
      const db = new Database(dbPath, { readonly: true, fileMustExist: true });
      try {
        tokens = readTokensFromDb(db);
      } finally {
        db.close();
      }
    } catch {
      openFailed = true;
    }
  } else {
    try {
      tokens = await extractTokensViaCLI(dbPath);
    } catch {
      openFailed = true;
    }
  }

  if (tokens?.accessToken && tokens?.machineId) {
    return NextResponse.json({
      found: true,
      accessToken: tokens.accessToken,
      machineId: tokens.machineId,
    });
  }

  if (openFailed) {
    // Preserve the original linux/win32 message; macOS gets the actionable one.
    if (platform === "darwin") {
      return NextResponse.json({
        found: false,
        error: `Cursor database found but could not open it: SQLITE_CANTOPEN`,
      });
    }
    return NextResponse.json({
      found: false,
      error:
        "Cursor database not found. Make sure Cursor IDE is installed and you are logged in.",
    });
  }

  // Opened but no usable tokens: distinguish leftover config from a logged-out IDE.
  if (platform === "linux" && !(await isCursorInstalled())) {
    return NextResponse.json({
      found: false,
      error:
        "Cursor config files found but Cursor IDE does not appear to be installed. Skipping auto-import.",
    });
  }

  return NextResponse.json({
    found: false,
    error: "Please login to Cursor IDE first.",
  });
}
