import { NextResponse } from "next/server";
import os from "node:os";
import path from "node:path";

import { getProviderConnections } from "@/lib/localDb";
import { isLocalRequest } from "@/dashboardGuard";
import { getUsageForProvider } from "open-sse/services/usage.js";

const PROVIDER_ALIASES = {
  antigravity: "antigravity",
  claude: "claude",
  codex: "codex",
  gemini: "gemini-cli",
  deepseek: "deepseek",
  "opencode-go": "opencode-go",
  "opencode-zen": "opencode-zen",
};

export const dynamic = "force-dynamic";

async function loadMiawAgentConnections(provider) {
  const dbPath = path.join(os.homedir(), ".miawagent", "router.sqlite");
  try {
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(dbPath, { readOnly: true });
    return db
      .prepare("SELECT * FROM router_accounts WHERE provider = ? AND isActive = 1")
      .all(provider)
      .map((row) => ({
        ...row,
        isActive: true,
        providerSpecificData: row.providerSpecificData
          ? JSON.parse(row.providerSpecificData)
          : null,
      }));
  } catch {
    return [];
  }
}

export async function GET(request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Local access only" }, { status: 403 });
  }

  const requestedProvider = new URL(request.url).searchParams.get("provider") || "";
  const provider = PROVIDER_ALIASES[requestedProvider];
  if (!provider) {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  const miawConnections = await loadMiawAgentConnections(provider);
  const connections = [
    ...(await getProviderConnections({ provider, isActive: true })),
    ...miawConnections,
  ];
  const results = await Promise.all(
    connections.map(async (connection) => {
      try {
        return await getUsageForProvider(connection);
      } catch {
        return null;
      }
    }),
  );

  const quotas = {};
  for (const result of results) {
    if (!result?.quotas || typeof result.quotas !== "object") continue;
    Object.assign(quotas, result.quotas);
  }

  return NextResponse.json({
    provider: requestedProvider,
    updatedAt: new Date().toISOString(),
    quotas,
  });
}
