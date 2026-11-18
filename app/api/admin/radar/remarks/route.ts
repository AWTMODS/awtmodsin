import { NextResponse } from "next/server";
import { addRadarRemark } from "@/lib/radar-engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { appId, adminName = "Admin", remarks, internalInstructions, testingRequirements } = body;

    if (!appId || !remarks) {
      return NextResponse.json({ error: "appId and remarks are required" }, { status: 400 });
    }

    const newRemark = await addRadarRemark({
      appId,
      adminName,
      remarks,
      internalInstructions,
      testingRequirements,
    });

    if (!newRemark) {
      return NextResponse.json({ error: "Failed to add remark" }, { status: 400 });
    }

    return NextResponse.json({ success: true, remark: newRemark });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add remark" }, { status: 500 });
  }
}
