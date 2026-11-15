import { NextResponse } from "next/server";
import { getModRequests, createModRequest } from "@/lib/db";

export async function GET() {
  try {
    const requests = await getModRequests();
    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { app_name, package_name, features_requested, requester_name } = body;

    if (!app_name || !features_requested) {
      return NextResponse.json(
        { error: "App Name and Requested Features are required." },
        { status: 400 }
      );
    }

    const created = await createModRequest({
      app_name,
      package_name,
      features_requested,
      requester_name,
    });

    return NextResponse.json({ success: true, request: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
