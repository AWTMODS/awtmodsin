import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const limitParam = searchParams.get("limit");
    const fetchAll = limitParam === "all";
    const liveLimit = fetchAll ? 1000 : Math.min(Math.max(parseInt(limitParam || "80", 10), 20), 500);

    // 1. Prepare parallel queries: Staged Drafts & Active Live Releases (Exclude PC software)
    let liveQuery = supabase
      .from("application_versions")
      .select(`
        id, version_name, version_code, release_notes, status, is_latest, created_at,
        application:applications!inner(id, name, package_name, slug, icon_url, platform)
      `, { count: "exact" })
      .eq("status", "published")
      .eq("is_latest", true)
      .neq("application.platform", "pc")
      .order("created_at", { ascending: false });

    if (search) {
      liveQuery = liveQuery.or(
        `name.ilike.%${search}%,package_name.ilike.%${search}%`,
        { foreignTable: "application" }
      );
    }

    if (!fetchAll) {
      liveQuery = liveQuery.limit(liveLimit);
    }

    const [stagedRes, liveRes] = await Promise.all([
      supabase
        .from("application_versions")
        .select(`
          id, version_name, version_code, release_notes, status, created_at,
          application:applications!inner(id, name, package_name, slug, icon_url, platform),
          download_sources(id, download_url, mirror_name, is_primary)
        `)
        .eq("status", "draft")
        .neq("application.platform", "pc")
        .order("created_at", { ascending: false }),
      liveQuery,
    ]);

    const stagedVersions = (stagedRes.data || []).filter(
      (v: any) => v.application?.platform !== "pc"
    );
    if (stagedRes.error) {
      console.error("Staged versions error:", stagedRes.error);
    }

    // Only query published versions for the specific applications that have drafts in queue
    const stagedAppIds = Array.from(
      new Set(stagedVersions.map((v: any) => v.application?.id).filter(Boolean))
    );
    const maxPublishedCodeByApp = new Map<string, number>();

    if (stagedAppIds.length > 0) {
      const { data: publishedVers } = await supabase
        .from("application_versions")
        .select("application_id, version_code")
        .eq("status", "published")
        .in("application_id", stagedAppIds);

      for (const pv of (publishedVers || [])) {
        const cur = maxPublishedCodeByApp.get(pv.application_id) || 0;
        if ((pv.version_code || 0) > cur) {
          maxPublishedCodeByApp.set(pv.application_id, pv.version_code || 0);
        }
      }
    }

    // Only allow the latest version per application / package in the staging queue
    const seenKeys = new Set<string>();
    const uniqueStaged: any[] = [];
    const sortedStaged = stagedVersions.sort(
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

    // Deduplicate live versions so each package appears at most once in active list
    const liveVersions = (liveRes.data || []).filter(
      (v: any) => v.application?.platform !== "pc"
    );
    const totalLiveCount = liveRes.count ?? liveVersions.length;
    const seenLiveKeys = new Set<string>();
    const uniqueLive: any[] = [];
    const sortedLive = liveVersions.sort(
      (a: any, b: any) => (b.version_code || 0) - (a.version_code || 0)
    );
    for (const v of sortedLive) {
      const pkg = v.application?.package_name?.toLowerCase();
      const dedupKey = pkg || v.application?.id || v.id;
      if (dedupKey && !seenLiveKeys.has(dedupKey)) {
        seenLiveKeys.add(dedupKey);
        uniqueLive.push(v);
      }
    }

    return NextResponse.json(
      {
        success: true,
        staged: uniqueStaged,
        live: uniqueLive,
        totalLiveCount: totalLiveCount,
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

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, version_name, version_code, release_notes, download_url } = body;
    if (!id) {
      return NextResponse.json({ error: "Version ID is required" }, { status: 400 });
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    const updateData: any = {};
    if (version_name !== undefined) updateData.version_name = version_name;
    if (version_code !== undefined) {
      const code = parseInt(version_code, 10);
      if (!isNaN(code)) updateData.version_code = code;
    }
    if (release_notes !== undefined) updateData.release_notes = release_notes;

    if (Object.keys(updateData).length > 0) {
      const { error: vErr } = await supabase
        .from("application_versions")
        .update(updateData)
        .eq("id", id);
      if (vErr) throw vErr;
    }

    if (download_url !== undefined) {
      const { data: src } = await supabase
        .from("download_sources")
        .select("id")
        .eq("version_id", id)
        .maybeSingle();

      if (src) {
        await supabase
          .from("download_sources")
          .update({
            download_url,
            hosting_provider: download_url.includes("t.me") ? "telegram" : "custom",
            is_active: true,
            is_primary: true,
          })
          .eq("id", src.id);
      }
    }

    return NextResponse.json({ success: true, message: "Draft updated successfully" });
  } catch (err: any) {
    console.error("Patcher draft update error:", err);
    return NextResponse.json({ error: err.message || "Failed to update draft" }, { status: 500 });
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
