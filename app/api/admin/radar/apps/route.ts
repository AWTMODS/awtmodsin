import { NextResponse } from "next/server";
import { getRadarTrackedApps, addRadarApp, removeRadarApp } from "@/lib/radar-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const activeOnly = searchParams.get("activeOnly") === "true";
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined;

    const apps = await getRadarTrackedApps({ search, status, activeOnly, limit });
    return NextResponse.json({ apps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load radar apps" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await addRadarApp({
      package_name: body.package_name,
      play_store_url: body.play_store_url,
      app_name: body.app_name,
      admin_name: body.admin_name || "Admin",
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to add application" }, { status: 400 });
    }

    return NextResponse.json({ success: true, app: result.app });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add application" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "App ID is required" }, { status: 400 });
    }

    const success = await removeRadarApp(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to remove app" }, { status: 500 });
  }
}
