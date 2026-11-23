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

    // Fetch all currently published versions to ensure we never display or keep drafts for versions already live
    const { data: publishedVers } = await supabase
      .from("application_versions")
      .select("application_id, version_code")
      .eq("status", "published");

    const maxPublishedCodeByApp = new Map<string, number>();
    for (const pv of (publishedVers || [])) {
      const cur = maxPublishedCodeByApp.get(pv.application_id) || 0;
      if ((pv.version_code || 0) > cur) {
        maxPublishedCodeByApp.set(pv.application_id, pv.version_code || 0);
      }
    }

    // Only allow the latest version per application / package in the staging queue
    const seenKeys = new Set<string>();
    const uniqueStaged: any[] = [];
    const sortedStaged = (stagedVersions || []).sort(
      (a: any, b: any) => (b.version_code || 0) - (a.version_code || 0)
    );
    for (const v of sortedStaged) {
      const appId = v.application?.id;
      const pkg = v.application?.package_name?.toLowerCase();
      const dedupKey = pkg || appId;

      // If already published live with this or higher code, prune it from staging queue immediately
      const maxLiveCode = appId ? (maxPublishedCodeByApp.get(appId) || 0) : 0;
      if (appId && maxLiveCode >= (v.version_code || 0)) {
        supabase.from("download_sources").delete().eq("version_id", v.id).then(() => {
          supabase.from("application_versions").delete().eq("id", v.id);
        });
        continue;
      }

      if (dedupKey && !seenKeys.has(dedupKey)) {
        seenKeys.add(dedupKey);
        uniqueStaged.push(v);
      } else if (v.id) {
        // Automatically prune duplicate older draft
        supabase.from("download_sources").delete().eq("version_id", v.id).then(() => {
          supabase.from("application_versions").delete().eq("id", v.id);
        });
      }
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
        staged: uniqueStaged,
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

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Version ID is required" }, { status: 400 });
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    // Delete download sources first
    await supabase.from("download_sources").delete().eq("version_id", id);
    // Delete version draft
    const { error } = await supabase.from("application_versions").delete().eq("id", id).eq("status", "draft");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Draft discarded successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
