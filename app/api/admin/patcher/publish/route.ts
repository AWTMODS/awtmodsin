import { NextResponse } from "next/server";
import { getDbClient, getApplicationById, invalidateDbCache } from "@/lib/db";
import { broadcastToTelegram } from "@/lib/telegram-broadcast";
import { getRadarTrackedApps, transitionToModReleased } from "@/lib/radar-engine";

// Called when Admin approves and publishes a staged release
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const versionId = body.version_id;
    const updateUrl = body.update_url;
    const releaseNotes = body.release_notes;
    const broadcast = Boolean(body.broadcast_telegram);

    if (!versionId) {
      return NextResponse.json({ error: "version_id is required" }, { status: 400 });
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    // 1. Get version details to find application_id
    const { data: ver, error: verErr } = await supabase
      .from("application_versions")
      .select("id, application_id, version_name, version_code")
      .eq("id", versionId)
      .single();

    if (verErr || !ver) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // 2. Mark all other versions for this app as is_latest = false
    await supabase
      .from("application_versions")
      .update({ is_latest: false })
      .eq("application_id", ver.application_id);

    // 3. Mark this version as published and is_latest = true
    const updateData: any = {
      status: "published",
      is_latest: true,
    };
    if (releaseNotes) updateData.release_notes = releaseNotes;

    await supabase
      .from("application_versions")
      .update(updateData)
      .eq("id", versionId);

    // 4. Update download source URL if modified by Admin
    if (updateUrl) {
      const { data: src } = await supabase
        .from("download_sources")
        .select("id")
        .eq("version_id", versionId)
        .maybeSingle();

      if (src) {
        await supabase
          .from("download_sources")
          .update({
            download_url: updateUrl,
            hosting_provider: updateUrl.includes("t.me") ? "telegram" : "custom",
            is_active: true,
            is_primary: true,
          })
          .eq("id", src.id);
      }
    }

    invalidateDbCache();

    // 5. Optionally Broadcast to Telegram channel
    if (broadcast) {
      try {
        const fullApp = await getApplicationById(ver.application_id);
        if (fullApp) {
          await broadcastToTelegram({
            app: fullApp,
            version: {
              version_name: ver.version_name,
              version_code: ver.version_code,
              release_notes: releaseNotes || fullApp.latest_version?.release_notes || "New version release",
              download_sources: updateUrl ? [{ download_url: updateUrl, is_primary: true, is_active: true, hosting_provider: "telegram" as any, id: "1", version_id: versionId, download_type: "external" }] : undefined,
              is_latest: true,
              id: versionId,
              application_id: ver.application_id,
              file_size: "50 MB",
              architecture: "arm64-v8a",
              android_requirement: "Android 7.0+",
              status: "published",
              created_at: new Date().toISOString(),
            }
          });
        }
      } catch (tgErr) {
        console.warn("Telegram broadcast error (non-fatal):", tgErr);
      }
    }

    // 6. Auto-resolve & archive from Active Play Store Radar if tracked
    try {
      const { data: appData } = await supabase
        .from("applications")
        .select("name, package_name")
        .eq("id", ver.application_id)
        .single();

      if (appData?.package_name) {
        const radarApps = await getRadarTrackedApps();
        const matchedRadarApp = radarApps.find(
          (ra) => ra.package_name.toLowerCase() === appData.package_name.toLowerCase()
        );

        if (matchedRadarApp) {
          await transitionToModReleased({
            appId: matchedRadarApp.id,
            adminName: "Patcher Admin",
            releasedModVersion: `v${ver.version_code}`,
            downloadUrl: updateUrl || "https://www.awtmods.in",
            changelog: releaseNotes || "Updated to latest version via Patcher",
          });
        }
      }
    } catch (radarErr) {
      console.warn("Radar auto-resolve note (non-fatal):", radarErr);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully published version ${ver.version_name} (code ${ver.version_code}) to LIVE!`,
      version_id: versionId,
    });
  } catch (error: any) {
    console.error("Publish error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
