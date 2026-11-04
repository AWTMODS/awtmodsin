import { NextResponse } from "next/server";
import { submitReport, getReports } from "@/lib/db";
import { reportSchema } from "@/lib/validation/app-schemas";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const validated = reportSchema.parse(json);

    const report = await submitReport(validated);
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit report" },
      { status: 400 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const reports = await getReports(status);
    return NextResponse.json({ reports });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

