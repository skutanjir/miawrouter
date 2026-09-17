import { NextResponse } from "next/server";
import { handleChat } from "@/sse/handlers/chat.js";
import { initTranslators } from "open-sse/translator/index.js";
import { getApiKeys, createApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { hasValidCliToken, isAuthenticated, isLocalRequest } from "@/dashboardGuard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await initTranslators();
    initialized = true;
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export async function POST(request) {
  const isAuthorized =
    (await isAuthenticated(request)) ||
    (await hasValidCliToken(request)) ||
    isLocalRequest(request);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureInitialized();

  const machineId = await getConsistentMachineId("miaw-cli-auth");
  let activeKey = null;

  try {
    const keys = await getApiKeys();
    activeKey = keys.find((k) => k.isActive !== false)?.key || null;
    if (!activeKey) {
      const newKey = await createApiKey("Playground Default", machineId);
      activeKey = newKey?.key || null;
    }
  } catch {
    // Fallback if localDb key retrieval fails
  }

  const bodyText = await request.text();

  const headers = new Headers(request.headers);
  if (activeKey) {
    headers.set("Authorization", `Bearer ${activeKey}`);
  }
  if (machineId) {
    headers.set("x-miaw-cli-token", machineId);
  }

  const forwardedRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: bodyText,
  });

  return await handleChat(forwardedRequest);
}
