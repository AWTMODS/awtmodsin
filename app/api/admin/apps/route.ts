import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { createApplication, getApplications } from "@/lib/db";
import { applicationSchema } from "@/lib/validation/app-schemas";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const validated = applicationSchema.parse(json);

    const app = await createApplication(validated as any);

    // Immediately purge and revalidate cache so new app appears instantly on main site and admin dashboard
    try {
      revalidatePath("/");
      revalidatePath("/apps");
      revalidatePath("/categories");
      revalidatePath("/search");
      revalidatePath("/admin");
      revalidatePath("/admin/apps");
      if (app.slug) {
        const clean = app.slug.replace(/\.html$/i, "");
        revalidatePath(`/apps/${clean}`);
        revalidatePath(`/apps/${clean}.html`);
        revalidatePath(`/download/${clean}`);
        revalidatePath(`/download/${clean}.html`);
      }
    } catch {
      // Ignore cache revalidation errors
    }

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
    const { applications } = await getApplications({ limit: 100, status: "all" });
    return NextResponse.json({ applications });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
