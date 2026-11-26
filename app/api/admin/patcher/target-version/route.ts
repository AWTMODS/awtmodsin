import { NextResponse } from "next/server";
import { getDbClient } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pkg = (searchParams.get("package") || searchParams.get("packageName") || "")
      .trim()
      .toLowerCase();

    if (!pkg) {
      return NextResponse.json(
        { success: false, error: "package query parameter is required" },
        { status: 400 }
      );
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Database unavailable" },
        { status: 500 }
      );
    }

    let targetVersionName: string | null = null;
    let workflowStatus: string | null = null;
    let siteVersionCode: number | null = null;

    // 1. Check Radar Engine Full State (Modding Queue & Active Radar)
    const { data: engineDoc } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", "radar_engine_full_state")
      .maybeSingle();

    const engineApps = (engineDoc?.setting_value?.apps || []) as any[];
    const engineCycles = (engineDoc?.setting_value?.cycles || []) as any[];

    const matchedRadarApp = engineApps.find(
      (a) => (a.package_name || "").trim().toLowerCase() === pkg
    );

    if (matchedRadarApp) {
      const activeCycle = engineCycles.find(
        (c) => c.radar_app_id === matchedRadarApp.id
      );
      const rawTarget =
        activeCycle?.target_play_store_version ||
        matchedRadarApp.current_play_store_version ||
        "";
      if (rawTarget) {
        targetVersionName = String(rawTarget).replace(/^v+/i, "").trim();
      }
      workflowStatus = matchedRadarApp.workflow_status || null;
    }

    // 2. Fallback / cross-check Play Store Radar State
    if (!targetVersionName) {
      const { data: radarDoc } = await supabase
        .from("site_settings")
        .select("setting_value")
        .eq("setting_key", "playstore_radar_state")
        .maybeSingle();

      const updates = (radarDoc?.setting_value?.updates || {}) as Record<string, any>;
      const matchedUpdate = Object.values(updates).find(
        (u: any) => (u?.packageName || "").trim().toLowerCase() === pkg
      );
      if (matchedUpdate?.playStoreVersion) {
        targetVersionName = String(matchedUpdate.playStoreVersion)
          .replace(/^v+/i, "")
          .trim();
        workflowStatus = workflowStatus || matchedUpdate.workflowStatus || null;
      }
    }

    // 3. Check existing site application_versions for latest version_code
    const { data: appRow } = await supabase
      .from("applications")
      .select("id, versions:application_versions(version_name, version_code, is_latest)")
      .ilike("package_name", pkg)
      .maybeSingle();

    if (appRow?.versions && Array.isArray(appRow.versions) && appRow.versions.length > 0) {
      const latestVer =
        appRow.versions.find((v: any) => v.is_latest) ||
        [...appRow.versions].sort((a: any, b: any) => (b.version_code || 0) - (a.version_code || 0))[0];
      if (latestVer?.version_code) {
        siteVersionCode = Number(latestVer.version_code);
      }
      if (!targetVersionName && latestVer?.version_name) {
        targetVersionName = String(latestVer.version_name).replace(/^v+/i, "").trim();
      }
    }

    return NextResponse.json({
      success: true,
      packageName: pkg,
      targetVersionName,
      siteVersionCode,
      workflowStatus,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to resolve target version" },
      { status: 500 }
    );
  }
}
