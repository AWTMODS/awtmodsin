import { NextResponse } from "next/server";
import { updateModRequestStatus } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, status, completedAppSlug } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status are required" }, { status: 400 });
    }

    const success = await updateModRequestStatus(id, status, completedAppSlug);
    if (!success) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
