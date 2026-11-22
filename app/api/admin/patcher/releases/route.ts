import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    // 1. Fetch staged drafts
    const { data: stagedVersions, error: stagedErr } = await supabase
      .from("application_versions")
      .select(`
        id, version_name, version_code, release_notes, status, created_at,
        application:applications(id, name, package_name, slug, icon_url),
        download_sources(id, download_url, mirror_name, is_primary)
      `)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (stagedErr) {
      console.error("Staged versions error:", stagedErr);
    }

    // 2. Fetch live published versions
    const { data: liveVersions, error: liveErr } = await supabase
      .from("application_versions")
      .select(`
        id, version_name, version_code, release_notes, status, is_latest, created_at,
        application:applications(id, name, package_name, slug, icon_url),
        download_sources(id, download_url, mirror_name, is_primary)
      `)
      .eq("status", "published")
      .eq("is_latest", true)
      .order("created_at", { ascending: false });

    if (liveErr) {
      console.error("Live versions error:", liveErr);
    }

    return NextResponse.json(
      {
        success: true,
        staged: stagedVersions || [],
        live: liveVersions || [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error: any) {
    console.error("Patcher releases list error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
