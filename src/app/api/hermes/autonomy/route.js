import { NextResponse } from "next/server";
import {
  saveHermesMemory,
  createHermesSkill,
  createHermesSubagent,
  getHermesAutonomyOverview,
} from "@/lib/hermes/autonomy.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overview = await getHermesAutonomyOverview();
    return NextResponse.json(overview);
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to load autonomy overview" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === "save_memory" || action === "memory") {
      const result = await saveHermesMemory(body);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "create_skill" || action === "skill") {
      const result = await createHermesSkill(body);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (action === "create_subagent" || action === "subagent") {
      const result = await createHermesSubagent(body);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || "Internal error in Hermes autonomy" }, { status: 500 });
  }
}
