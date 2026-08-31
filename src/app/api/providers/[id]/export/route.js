import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/models";

// Local-only bridge for clients that keep their own provider database.
export async function GET(request, { params }) {
  try {
    const origin = request.headers.get("origin");
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return NextResponse.json({ error: "Local clients only" }, { status: 403 });
    }
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    return NextResponse.json({ connection });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to export connection" }, { status: 500 });
  }
}
