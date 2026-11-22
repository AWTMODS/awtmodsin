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
    const { data: existingApp } = await supabase
      .from("applications")
      .select("id, name, package_name")
      .ilike("package_name", packageName)
      .maybeSingle();

    if (existingApp) {
      appId = existingApp.id;
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

      const slug = packageName.replace(/[^a-z0-9]/gi, "-").toLowerCase();
      const { data: newApp, error: newAppErr } = await supabase
        .from("applications")
        .insert({
          name: appName,
          slug: `${slug}-${Date.now().toString(36)}`,
          package_name: packageName,
          developer: "AWTMods",
          category_id: catId,
          short_description: `${appName} modded APK with unlocked premium features.`,
          description: `${appName} modded APK by AWTMods. Latest clean release.`,
          icon_url: "https://www.awtmods.in/icon.png",
          android_requirement: "Android 7.0+",
          status: "published",
        })
        .select("id")
        .single();

      if (newAppErr || !newApp) {
        console.error("App insert error:", newAppErr);
        return NextResponse.json(
          { error: newAppErr?.message || "Failed to create application" },
          { status: 500 }
        );
      }
      appId = newApp.id;
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
