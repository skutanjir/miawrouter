import { NextResponse } from "next/server";
import { canAccessLocalOnlyRoute } from "@/dashboardGuard";
import { searchMemories } from "@/lib/db/repos/memoryRepo.js";
import { errorResponse, integerFrom, queryFrom, scopeFrom } from "../_validation.js";

const unauthorized = () => NextResponse.json({ error: "Local authentication required" }, { status: 403 });

export async function GET(request) {
  if (!(await canAccessLocalOnlyRoute(request))) return unauthorized();
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const scope = scopeFrom(params);
    const query = queryFrom(params.q);
    const limit = integerFrom(params.limit, "limit", 20, 100);
    return NextResponse.json({ memories: await searchMemories({ ...scope, query, limit }) });
  } catch (error) { return errorResponse(error, "Failed to search memories"); }
}
