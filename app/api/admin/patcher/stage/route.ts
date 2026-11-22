import { NextResponse } from "next/server";
import { getDbClient, invalidateDbCache } from "@/lib/db";

// Endpoint called by Android Patcher when an APK is patched
// Holds the new release as "draft" in the Admin Panel queue
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const packageName = (body.package_name || body.packageName || "").trim().toLowerCase();
    const appName = (body.app_name || body.Header || packageName).trim();
    const versionCode = parseInt(body.version_code || body.versionCode, 10);
    const updateUrl = body.update_url || "https://telegram.me/ARTWEBTECHOFFICIAL";
    const releaseNotes = body.description || "Base Update\nNew Features\nFixed Bugs";

    if (!packageName || isNaN(versionCode)) {
      return NextResponse.json(
        { error: "package_name and version_code are required" },
        { status: 400 }
      );
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Database client unavailable" },
        { status: 500 }
      );
    }

    // 1. Find or create the Application
    let appId: string | null = null;
    let appIconUrl = "https://www.awtmods.in/icon.png";
    let appBannerUrl: string | null = null;
    let appSlug = "";

    const { data: existingApp } = await supabase
      .from("applications")
      .select("id, name, package_name, slug, icon_url, banner_url")
      .ilike("package_name", packageName)
      .maybeSingle();

    if (existingApp) {
      appId = existingApp.id;
      if (existingApp.icon_url) appIconUrl = existingApp.icon_url;
      if (existingApp.banner_url) appBannerUrl = existingApp.banner_url;
      if (existingApp.slug) appSlug = existingApp.slug;
    } else {
      // Find default category
      const { data: cat } = await supabase
        .from("categories")
        .select("id")
        .limit(1)
        .maybeSingle();

      const catId = cat?.id;
      if (!catId) {
        return NextResponse.json(
          { error: "No category available to register new application" },
          { status: 500 }
        );
      }

      appSlug = `${packageName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now().toString(36)}`;
      const { data: newApp, error: newAppErr } = await supabase
        .from("applications")
        .insert({
          name: appName,
          slug: appSlug,
          package_name: packageName,
          developer: "AWTMods",
          category_id: catId,
          short_description: `${appName} modded APK with unlocked premium features.`,
          description: `${appName} modded APK by AWTMods. Latest clean release.`,
          icon_url: "https://www.awtmods.in/icon.png",
          android_requirement: "Android 7.0+",
          status: "published",
        })
        .select("id, icon_url, banner_url, slug")
        .single();

      if (newAppErr || !newApp) {
        console.error("App insert error:", newAppErr);
        return NextResponse.json(
          { error: newAppErr?.message || "Failed to create application" },
          { status: 500 }
        );
      }
      appId = newApp.id;
      if (newApp.icon_url) appIconUrl = newApp.icon_url;
      if (newApp.banner_url) appBannerUrl = newApp.banner_url;
      if (newApp.slug) appSlug = newApp.slug;
    }

    // 2. Find or create the version as DRAFT (staged)
    const { data: existingVer } = await supabase
      .from("application_versions")
      .select("id, status")
      .eq("application_id", appId)
      .eq("version_code", versionCode)
      .maybeSingle();

    let verId: string;

    if (existingVer) {
      verId = existingVer.id;
      await supabase
        .from("application_versions")
        .update({
          release_notes: releaseNotes,
          status: "draft", // Ensure held in staged draft queue
        })
        .eq("id", verId);
    } else {
      const { data: newVer, error: verErr } = await supabase
        .from("application_versions")
        .insert({
          application_id: appId,
          version_name: `v${versionCode}`,
          version_code: versionCode,
          file_size: "50 MB",
          architecture: "arm64-v8a",
          android_requirement: "Android 7.0+",
          release_notes: releaseNotes,
          is_latest: false,
          status: "draft", // Staged: NOT live yet
        })
        .select("id")
        .single();

      if (verErr || !newVer) {
        console.error("Version insert error:", verErr);
        return NextResponse.json(
          { error: verErr?.message || "Failed to create version" },
          { status: 500 }
        );
      }
      verId = newVer.id;
    }

    // 3. Attach default download source mirror
    const { data: existingSource } = await supabase
      .from("download_sources")
      .select("id")
      .eq("version_id", verId)
      .maybeSingle();

    if (existingSource) {
      await supabase
        .from("download_sources")
        .update({
          download_url: updateUrl,
          hosting_provider: updateUrl.includes("t.me") ? "telegram" : "custom",
          mirror_name: updateUrl.includes("t.me") ? "Telegram Channel" : "Download Mirror",
          is_active: true,
          is_primary: true,
        })
        .eq("id", existingSource.id);
    } else {
      await supabase.from("download_sources").insert({
        version_id: verId,
        download_type: "external",
        hosting_provider: updateUrl.includes("t.me") ? "telegram" : "custom",
        download_url: updateUrl,
        mirror_name: updateUrl.includes("t.me") ? "Telegram Channel" : "Download Mirror",
        is_primary: true,
        is_active: true,
      });
    }

    invalidateDbCache();

    // 4. Feature 4: Play Store Radar Matcher
    let radarMatchText = "📡 <b>Radar:</b> No pending Play Store alert.";
    try {
      const { getRadarTrackedApps } = await import("@/lib/radar-engine");
      const radarApps = await getRadarTrackedApps();
      const matchedRadar = radarApps.find(
        (ra) => (ra.package_name || "").toLowerCase() === packageName && ra.workflow_status !== "MOD_RELEASED"
      );
      if (matchedRadar) {
        radarMatchText = `📡 <b>Radar Match:</b> Play Store detected <code>v${matchedRadar.current_play_store_version || "New"}</code> (Active) ➔ <i>Will auto-archive on publish!</i>`;
      }
    } catch (rErr) {
      console.warn("Radar check note (non-fatal):", rErr);
    }

    // 5. Feature 1: Instant Telegram DM Alert with App Logo to Admin
    try {
      const { sendPatcherStagedAlertToAdmin } = await import("@/lib/telegram-broadcast");
      await sendPatcherStagedAlertToAdmin({
        app: {
          id: appId,
          name: existingApp?.name || appName,
          package_name: packageName,
          icon_url: appIconUrl,
          banner_url: appBannerUrl,
          slug: appSlug,
        },
        versionId: verId,
        versionCode: versionCode,
        versionName: `v${versionCode}`,
        releaseNotes: releaseNotes,
        downloadUrl: updateUrl,
        radarMatchText,
      });
    } catch (tgErr) {
      console.warn("Telegram alert error (non-fatal):", tgErr);
    }

    return NextResponse.json({
      success: true,
      status: "draft",
      message: `Release for ${appName} (v${versionCode}) staged in Admin Panel queue.`,
      package_name: packageName,
      version_code: versionCode,
      version_id: verId,
    });
  } catch (error: any) {
    console.error("Patcher stage error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
