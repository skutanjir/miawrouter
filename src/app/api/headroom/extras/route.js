import { NextResponse } from "next/server";
import { findPython310, getInstalledHeadroomExtras, HEADROOM_COMPRESSION_EXTRAS } from "@/lib/headroom/detect";
import { uninstallHeadroomExtras, getInstallLogTail } from "@/lib/headroom/process";
import { getHeadroomInstallJob, startHeadroomInstallJob } from "@/lib/headroom/installJob";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function GET(req) {
  try {
    // `?log=1` returns the live install/uninstall log tail for progress polling.
    if (new URL(req.url).searchParams.get("log") === "1") {
      return NextResponse.json({ log: getInstallLogTail(), job: getHeadroomInstallJob() });
    }
    const python = findPython310();
    const status = getInstalledHeadroomExtras(python);
    return NextResponse.json({
      available: HEADROOM_COMPRESSION_EXTRAS,
      ...status,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.extras) ? body.extras : [];
    const installer = body.installer || "auto";
    if (!["auto", "uv", "pip"].includes(installer)) return NextResponse.json({ error: "Installer must be auto, uv, or pip" }, { status: 400 });
    const job = startHeadroomInstallJob(requested, { installer });
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    const status = ["NOT_INSTALLED", "NO_PYTHON", "NO_INSTALLER", "INVALID_INSTALLER"].includes(error.code) ? 400 : 500;
    return NextResponse.json({ error: error.message, code: error.code || null }, { status });
  }
}

export async function DELETE(req) {
  try {
    if (getHeadroomInstallJob()?.status === "running") return NextResponse.json({ error: "Setup is still running. Wait for it to finish before removing extras." }, { status: 409 });
    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.extras) ? body.extras : [];
    const result = await uninstallHeadroomExtras(requested);
    return NextResponse.json(result);
  } catch (error) {
    const status = error.code === "NO_PYTHON" || error.code === "INVALID_EXTRAS" ? 400 : 500;
    return NextResponse.json({ error: error.message, code: error.code || null }, { status });
  }
}
