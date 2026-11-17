import { NextResponse } from "next/server";
import { checkPlayStoreUpdates, getRadarState } from "@/lib/playstore-radar";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const forceScan = searchParams.get("scan") === "true";
    const state = await getRadarState();

    // Auto-check: If scan is forced OR radar state is older than 20 minutes, perform auto-scan!
    const lastScanMs = state.lastScanAt ? new Date(state.lastScanAt).getTime() : 0;
    const isStale = !lastScanMs || Date.now() - lastScanMs > 20 * 60 * 1000;

    if (forceScan || isStale) {
      try {
        const scanRes = await checkPlayStoreUpdates({ limit: 100, notifyTelegram: true });
        const freshState = await getRadarState();
        return NextResponse.json(
          {
            success: true,
            radar: freshState,
            autoScanned: true,
            updatesFound: scanRes.updatesFound,
          },
          {
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );
      } catch (scanErr) {
        console.warn("Background auto-scan warning:", scanErr);
        // Fallback to existing state if scraping throttled
      }
    }

    return NextResponse.json(
      { success: true, radar: state },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
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
