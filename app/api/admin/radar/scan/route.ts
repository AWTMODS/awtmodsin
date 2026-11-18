import { NextResponse } from "next/server";
import { runPlayStoreRadarScan } from "@/lib/radar-engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await runPlayStoreRadarScan({
      triggerType: body.triggerType || "manual",
      adminName: body.adminName || "Admin",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Radar scan execution failed" }, { status: 500 });
  }
}
