import { NextResponse } from "next/server";
import { getRadarDashboardStats } from "@/lib/radar-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getRadarDashboardStats();
    return NextResponse.json({ stats });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load radar stats" }, { status: 500 });
  }
}
