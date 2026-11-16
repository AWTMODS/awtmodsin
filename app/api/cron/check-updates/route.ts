import { NextResponse } from "next/server";
import { checkPlayStoreUpdates } from "@/lib/playstore-radar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 30;

    const result = await checkPlayStoreUpdates({
      limit,
      notifyTelegram: true,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Cron scan failed" }, { status: 500 });
  }
}
