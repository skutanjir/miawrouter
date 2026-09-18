import { NextResponse } from "next/server";
import { canAccessLocalOnlyRoute } from "@/dashboardGuard";
import { reindexMemories } from "@/lib/db/repos/memoryRepo.js";
import { errorResponse } from "../_validation.js";

const unauthorized = () => NextResponse.json({ error: "Local authentication required" }, { status: 403 });

export async function POST(request) {
  if (!(await canAccessLocalOnlyRoute(request))) return unauthorized();
  try { return NextResponse.json(await reindexMemories()); }
  catch (error) { return errorResponse(error, "Failed to reindex memories"); }
}
