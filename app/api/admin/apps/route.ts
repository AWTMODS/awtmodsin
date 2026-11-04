import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createApplication, getApplications } from "@/lib/db";
import { applicationSchema } from "@/lib/validation/app-schemas";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const validated = applicationSchema.parse(json);

    const app = await createApplication(validated as any);
    return NextResponse.json({ success: true, app });
  } catch (err: any) {
    if (err instanceof ZodError) {
      const formatted = err.issues.map((i) => i.message).join(". ");
      return NextResponse.json(
        { error: formatted, issues: err.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: err.message || "Failed to create application" },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const { applications } = await getApplications({ limit: 100 });
    return NextResponse.json({ applications });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

