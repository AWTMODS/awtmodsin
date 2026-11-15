import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getApplicationById, setLatestApplicationVersion, invalidateDbCache } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { appId, versionId } = body;

    if (!appId || !versionId) {
      return NextResponse.json(
        { error: "appId and versionId are required" },
        { status: 400 }
      );
    }

    const success = await setLatestApplicationVersion(appId, versionId);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update version in database" },
        { status: 500 }
      );
    }

    // Invalidate and fetch updated app
    invalidateDbCache();
    const updatedApp = await getApplicationById(appId);

    try {
      revalidatePath("/");
      revalidatePath("/apps");
      revalidatePath("/admin/versions");
      if (updatedApp?.slug) {
        revalidatePath(`/apps/${updatedApp.slug}`);
        revalidatePath(`/download/${updatedApp.slug}`);
      }
    } catch (revErr) {
      console.warn("Revalidation warning:", revErr);
    }

    return NextResponse.json({
      success: true,
      message: `Version successfully set as active release!`,
      app: updatedApp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Rollback error" },
      { status: 500 }
    );
  }
}
