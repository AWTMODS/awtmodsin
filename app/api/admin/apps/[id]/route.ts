import { NextResponse } from "next/server";
import { updateApplication, deleteApplication } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const updated = await updateApplication(params.id, body);
    if (!updated) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, app: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteApplication(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

