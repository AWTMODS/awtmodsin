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
    const versionName = (body.version_name || body.versionName || (body.clean_ver ? `v${body.clean_ver}` : `v${versionCode}`)).trim();
    const fileSize = (body.file_size || body.fileSize || "50 MB").trim();
    const updateUrl = (body.update_url || body.download_url || "").trim() || "https://t.me/awtmods";
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

    // 1. Resolve application icon & metadata
    const reqIconUrl = (body.icon_url || body.image || body.thumbnail || body.icon || "").trim();
    let resolvedIcon = reqIconUrl;
    let resolvedBanner: string | null = null;
    let resolvedTitle: string | null = null;

    if (!resolvedIcon && packageName && packageName.includes(".") && !packageName.startsWith("com.awt")) {
      try {
        const mod = await import("google-play-scraper");
        const gplay = (mod as any).default || mod;
        const playData = await gplay.app({ appId: packageName });
        if (playData?.icon) resolvedIcon = playData.icon;
        if (playData?.headerImage) resolvedBanner = playData.headerImage;
        if (playData?.title) resolvedTitle = playData.title;
      } catch (e) {
        // non-fatal Play Store scraper lookup
      }
    }

    if (!resolvedIcon || resolvedIcon.includes("icon.png") || resolvedIcon.includes("default-app.png")) {
      resolvedIcon = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60";
    }

    // 2. Find or create the Application
    let appId: string | null = null;
    let appIconUrl = resolvedIcon;
    let appBannerUrl: string | null = resolvedBanner;
    let appSlug = "";

    const { data: existingApps } = await supabase
      .from("applications")
      .select("id, name, package_name, slug, icon_url, banner_url")
      .ilike("package_name", packageName)
      .order("created_at", { ascending: true });

    const existingApp = existingApps && existingApps.length > 0 ? existingApps[0] : null;

    if (existingApp) {
      appId = existingApp.id;
      appIconUrl = existingApp.icon_url || resolvedIcon;
      appBannerUrl = existingApp.banner_url || resolvedBanner;
      appSlug = existingApp.slug;

      // If existing app is missing an icon or has the old placeholder icon.png, update it now
      if (!existingApp.icon_url || existingApp.icon_url.includes("icon.png") || existingApp.icon_url.includes("default-app.png")) {
        appIconUrl = resolvedIcon;
        await supabase
          .from("applications")
          .update({
            icon_url: resolvedIcon,
            banner_url: appBannerUrl || resolvedBanner,
          })
          .eq("id", appId);
      }
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

      const finalAppName = resolvedTitle || appName;
      appSlug = `${packageName.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${Date.now().toString(36)}`;
      const { data: newApp, error: newAppErr } = await supabase
        .from("applications")
        .insert({
          name: finalAppName,
          slug: appSlug,
          package_name: packageName,
          developer: "AWTMods",
          category_id: catId,
          short_description: `${finalAppName} modded APK with unlocked premium features.`,
          description: `${finalAppName} modded APK by AWTMods. Latest clean release.`,
          icon_url: resolvedIcon,
          banner_url: resolvedBanner,
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

    // 2. Check if a published live version already exists with this or higher version code
    const { data: publishedVersions } = await supabase
      .from("application_versions")
      .select("id, version_code, version_name, status, is_latest")
      .eq("application_id", appId)
      .eq("status", "published");

    const alreadyLive = (publishedVersions as any[])?.find((v: any) => (v.version_code || 0) >= versionCode);
    if (alreadyLive) {
      // If already live, synchronize download mirror directly without re-staging as a duplicate draft
      if (alreadyLive.version_code === versionCode && updateUrl) {
        const isDevUploads = updateUrl.includes("devuploads.com") || updateUrl.includes("devupload.com");
        const hostingProvider = isDevUploads ? "custom" : (updateUrl.includes("t.me") ? "telegram" : "custom");
        const mirrorName = isDevUploads ? "DevUploads Fast Mirror" : (updateUrl.includes("t.me") ? "Telegram VIP Direct File" : "Direct Mirror");

        const { data: existingSrc } = await supabase
          .from("download_sources")
          .select("id")
          .eq("version_id", alreadyLive.id)
          .eq("hosting_provider", hostingProvider);

        if (existingSrc && existingSrc.length > 0) {
          await supabase
            .from("download_sources")
            .update({ download_url: updateUrl, mirror_name: mirrorName, is_active: true })
            .eq("id", existingSrc[0].id);
        } else {
          await supabase
            .from("download_sources")
            .insert({
              version_id: alreadyLive.id,
              download_type: "external",
              hosting_provider: hostingProvider,
              download_url: updateUrl,
              mirror_name: mirrorName,
              is_primary: isDevUploads,
              is_active: true,
            });
        }
      }

      invalidateDbCache();
      return NextResponse.json({
        success: true,
        already_published: true,
        message: `Version ${alreadyLive.version_name || alreadyLive.version_code} is already live on AWTMods! Download mirror synced.`,
        package_name: packageName,
        version_code: versionCode,
      });
    }

    // 3. Only allow the latest version: clean up older drafts or reject if newer already exists
    const { data: existingDrafts } = await supabase
      .from("application_versions")
      .select("id, version_code")
      .eq("application_id", appId)
      .eq("status", "draft");

    const higherDraft = (existingDrafts as any[])?.find((d: any) => (d.version_code || 0) > versionCode);
    if (higherDraft) {
      return NextResponse.json({
        success: false,
        message: `A newer version (v${higherDraft.version_code}) is already staged. Older version v${versionCode} was ignored.`,
        package_name: packageName,
        version_code: versionCode,
      });
    }

    if (existingDrafts && existingDrafts.length > 0) {
      const olderIds = (existingDrafts as any[]).filter((d: any) => d.version_code !== versionCode).map((d: any) => d.id);
      if (olderIds.length > 0) {
        await supabase.from("download_sources").delete().in("version_id", olderIds);
        await supabase.from("application_versions").delete().in("id", olderIds);
      }
    }

    // Find or create the version as DRAFT (staged)
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
          version_name: versionName,
          file_size: fileSize,
          release_notes: releaseNotes,
          status: "draft", // Ensure held in staged draft queue
        })
        .eq("id", verId);
    } else {
      const { data: newVer, error: verErr } = await supabase
        .from("application_versions")
        .insert({
          application_id: appId,
          version_name: versionName,
          version_code: versionCode,
          file_size: fileSize,
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

    const isDevUploads = updateUrl.includes("devuploads.com");
    const isTelegram = updateUrl.includes("t.me") || updateUrl.includes("telegram.me");
    const hostingProvider = isTelegram ? "telegram" : "custom";
    const mirrorName = isDevUploads
      ? "DevUploads Fast Mirror"
      : isTelegram
      ? "Telegram Channel"
      : "Download Mirror";

    if (existingSource) {
      await supabase
        .from("download_sources")
        .update({
          download_url: updateUrl,
          hosting_provider: hostingProvider,
          mirror_name: mirrorName,
          is_active: true,
          is_primary: true,
        })
        .eq("id", existingSource.id);
    } else {
      await supabase.from("download_sources").insert({
        version_id: verId,
        download_type: "external",
        hosting_provider: hostingProvider,
        download_url: updateUrl,
        mirror_name: mirrorName,
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
        versionName: versionName,
        fileSize: fileSize,
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
