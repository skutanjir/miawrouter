import { NextResponse } from "next/server";
import { canAccessLocalOnlyRoute } from "@/dashboardGuard";
import { getMemoryHealth } from "@/lib/db/repos/memoryRepo.js";
import { errorResponse } from "../_validation.js";

const unauthorized = () => NextResponse.json({ error: "Local authentication required" }, { status: 403 });

export async function GET(request) {
  if (!(await canAccessLocalOnlyRoute(request))) return unauthorized();
  try {
    const health = await getMemoryHealth();
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (error) { return errorResponse(error, "Memory FTS5 unavailable"); }
}
