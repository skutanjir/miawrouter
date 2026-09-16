"use server";

import { NextResponse } from "next/server";
import { getProviderConnections } from "@/models";
import { getModelsByProviderId, PROVIDER_ID_TO_ALIAS } from "@/shared/constants/models";
import {
  detectInstalledTools,
  resolveOptimalSubagentRoles,
  autoConfigureAllTools,
} from "@/lib/agents/subagentAutomator";

// GET /api/cli-tools/subagents - Gather installed tools and optimal subagent roles
export async function GET() {
  try {
    const installedTools = await detectInstalledTools();

    // Fetch active provider models
    let connections = [];
    try {
      connections = await getProviderConnections();
    } catch {
      connections = [];
    }

    const candidateModels = [];
    const seen = new Set();

    connections
      .filter((c) => c.isActive !== false)
      .forEach((conn) => {
        const alias = PROVIDER_ID_TO_ALIAS[conn.provider] || conn.provider;
        const pModels = getModelsByProviderId(conn.provider);
        pModels.forEach((m) => {
          const val = `${alias}/${m.id}`;
          if (!seen.has(val)) {
            seen.add(val);
            candidateModels.push(val);
          }
        });

        if (conn.defaultModel) {
          const val = `${alias}/${conn.defaultModel}`;
          if (!seen.has(val)) {
            seen.add(val);
            candidateModels.push(val);
          }
        }
      });

    const recommendedRoles = resolveOptimalSubagentRoles(candidateModels);

    return NextResponse.json({
      installedTools,
      candidateModels,
      recommendedRoles,
    });
  } catch (error) {
    console.log("Error querying subagents status:", error);
    return NextResponse.json({ error: "Failed to query subagents status" }, { status: 500 });
  }
}

// POST /api/cli-tools/subagents - Auto-configure subagents across tools
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      baseUrl = "http://127.0.0.1:21128/v1",
      apiKey = "sk_miawrouter",
      candidateModels = [],
      customRoles = null,
      targetTools = "all",
    } = body;

    let effectiveCandidates = candidateModels;
    if (!effectiveCandidates || effectiveCandidates.length === 0) {
      try {
        const connections = await getProviderConnections();
        const seen = new Set();
        effectiveCandidates = [];
        connections
          .filter((c) => c.isActive !== false)
          .forEach((conn) => {
            const alias = PROVIDER_ID_TO_ALIAS[conn.provider] || conn.provider;
            getModelsByProviderId(conn.provider).forEach((m) => {
              const val = `${alias}/${m.id}`;
              if (!seen.has(val)) {
                seen.add(val);
                effectiveCandidates.push(val);
              }
            });
            if (conn.defaultModel) {
              const val = `${alias}/${conn.defaultModel}`;
              if (!seen.has(val)) {
                seen.add(val);
                effectiveCandidates.push(val);
              }
            }
          });
      } catch {
        effectiveCandidates = [];
      }
    }

    const result = await autoConfigureAllTools({
      baseUrl,
      apiKey,
      candidateModels: effectiveCandidates,
      customRoles,
      targetTools,
    });

    return NextResponse.json({
      success: result.ok,
      configured: result.configured,
      skipped: result.skipped,
      errors: result.errors,
      roles: result.roles,
      message: `Successfully configured subagents for ${result.configured.length} tools!`,
    });
  } catch (error) {
    console.log("Error auto-configuring subagents:", error);
    return NextResponse.json({ error: "Failed to auto-configure subagents" }, { status: 500 });
  }
}
