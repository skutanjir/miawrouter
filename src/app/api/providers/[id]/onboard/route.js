import { NextResponse } from "next/server";
import { getProviderConnectionById, updateProviderConnection } from "@/lib/localDb";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { checkAndRefreshToken } from "@/sse/services/tokenRefresh.js";
import {
  getManualOnboardingInstructions,
  onboardProjectForConnection,
} from "open-sse/services/projectId.js";

const GOOGLE_PROJECT_PROVIDERS = new Set(["antigravity", "gemini-cli"]);

function credentialsFromConnection(connection) {
  return {
    connectionId: connection.id,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    idToken: connection.idToken,
    expiresAt: connection.expiresAt || connection.tokenExpiresAt,
    lastRefreshAt: connection.lastRefreshAt,
    providerSpecificData: connection.providerSpecificData || {},
  };
}

// POST /api/providers/[id]/onboard - Refresh and onboard a Google Cloud Code connection
export async function POST(_request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    if (!GOOGLE_PROJECT_PROVIDERS.has(connection.provider)) {
      return NextResponse.json({ error: "This provider does not use Google Cloud Code onboarding" }, { status: 400 });
    }

    const refreshed = await checkAndRefreshToken(connection.provider, credentialsFromConnection(connection));
    if (!refreshed?.accessToken) {
      return NextResponse.json({ error: "Google token is missing or revoked. Reconnect this account and retry." }, { status: 401 });
    }

    const proxy = await resolveConnectionProxyConfig(refreshed.providerSpecificData || connection.providerSpecificData || {});
    const projectId = await onboardProjectForConnection(
      connection.id,
      refreshed.accessToken,
      connection.provider,
      {
        timeoutMs: 60_000,
        proxyOptions: {
          connectionProxyEnabled: proxy.connectionProxyEnabled === true,
          connectionProxyUrl: proxy.connectionProxyUrl || "",
          connectionNoProxy: proxy.connectionNoProxy || "",
          vercelRelayUrl: proxy.vercelRelayUrl || "",
          strictProxy: proxy.strictProxy === true,
        },
      },
    );

    if (!projectId) {
      return NextResponse.json({
        error: "Google Cloud Code onboarding could not complete. Check account region, eligibility, quota, or token status, then reconnect and retry.",
        manualRecovery: getManualOnboardingInstructions(connection.provider),
        safety: {
          realProjectIdOnly: true,
          syntheticProjectIds: false,
          googlePolicyChecksStillApply: true,
        },
      }, { status: 422 });
    }

    await updateProviderConnection(connection.id, { projectId });
    return NextResponse.json({ ok: true, projectId });
  } catch (error) {
    console.log("Error onboarding Google Cloud Code connection:", error);
    return NextResponse.json({ error: "Google Cloud Code onboarding failed. Reconnect the account and retry." }, { status: 502 });
  }
}
