import { NextResponse } from "next/server";
import { upvoteModRequest } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Request ID is required" }, { status: 400 });
    }

    const newUpvotes = await upvoteModRequest(id);
    return NextResponse.json({ success: true, upvotes: newUpvotes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
