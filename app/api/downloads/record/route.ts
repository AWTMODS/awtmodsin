import { NextResponse } from "next/server";
import { recordDownload } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { application_id, version_id, download_source_id, event_type } = body;

    if (!application_id || !version_id) {
      return NextResponse.json(
        { error: "Missing required download parameters" },
        { status: 400 }
      );
    }

    await recordDownload({
      application_id,
      version_id,
      download_source_id,
      event_type: event_type || "initiated",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to record download event" },
      { status: 500 }
    );
  }
}

