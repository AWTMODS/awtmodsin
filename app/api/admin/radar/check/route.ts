import { NextResponse } from "next/server";
import { checkPlayStoreUpdates, getRadarState } from "@/lib/playstore-radar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const state = await getRadarState();
    return NextResponse.json({ success: true, radar: state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load radar state" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? body.limit : undefined;
    const notifyTelegram = body.notifyTelegram !== false;

    const result = await checkPlayStoreUpdates({
      limit,
      notifyTelegram,
    });

    return NextResponse.json({
      success: true,
      message: `Checked ${result.checked} apps. Found ${result.updatesFound} new updates.`,
      ...result,
    });
  } catch (err: any) {
    console.error("Radar check API error:", err);
    return NextResponse.json({ error: err.message || "Failed to run radar scan" }, { status: 500 });
  }
}
