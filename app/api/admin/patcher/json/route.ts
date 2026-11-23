import { NextResponse } from "next/server";
import { getDbClient, invalidateDbCache, getApplicationByPackage } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: fetch current JSON payload for a package (custom or auto-generated default)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pkg = searchParams.get("package") || searchParams.get("pkg") || "";
    const cleanPackage = pkg.trim().toLowerCase();

    if (!cleanPackage) {
      return NextResponse.json({ error: "package parameter is required" }, { status: 400 });
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    // 1. Check if a custom JSON override exists in site_settings
    const { data: settingRow } = await supabase
      .from("site_settings")
      .select("setting_value")
      .eq("setting_key", `update_json_${cleanPackage}`)
      .maybeSingle();

    if (settingRow && settingRow.setting_value) {
      return NextResponse.json({
        success: true,
        package_name: cleanPackage,
        isCustom: true,
        payload: settingRow.setting_value,
      });
    }

    // 2. Otherwise generate default Dalvik update payload
    const app = await getApplicationByPackage(cleanPackage);
    const versions = app?.versions || [];
    const publishedVersions = versions.filter((v: any) => v.status === "published");
    const activeVersion =
      publishedVersions.find((v: any) => v.is_latest) ||
      publishedVersions.sort((a: any, b: any) => (b.version_code || 0) - (a.version_code || 0))[0] ||
      app?.latest_version;

    const sources = activeVersion?.download_sources || [];
    const primarySource = sources.find((s: any) => s.is_primary && s.is_active) || sources[0];
    const downloadUrl = primarySource?.download_url || "https://telegram.me/ARTWEBTECHOFFICIAL";

    const defaultPayload = [
      {
        Header: app?.name || cleanPackage,
        package_name: cleanPackage,
        version_code: activeVersion?.version_code || 1,
        force_update: true,
        title: "Update version ",
        description_type: 2,
        html_formatted: false,
        description: activeVersion?.release_notes || "Base Update\nNew Features\nFixed Bugs",
        update_button_text: "Update Now",
        Update_dismiss_button_text: "Dismiss",
        update_url: downloadUrl,
        auto_redirect_enabled: false,
        auto_redirect_delay: 6,
        show_only_update_button: true,
      },
    ];

    return NextResponse.json({
      success: true,
      package_name: cleanPackage,
      isCustom: false,
      payload: defaultPayload,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load JSON" }, { status: 500 });
  }
}

// POST: Save or reset custom JSON payload for a package
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cleanPackage = (body.package_name || "").trim().toLowerCase();
    const reset = Boolean(body.resetToDefault);

    if (!cleanPackage) {
      return NextResponse.json({ error: "package_name is required" }, { status: 400 });
    }

    const supabase = getDbClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
    }

    const settingKey = `update_json_${cleanPackage}`;

    if (reset) {
      await supabase.from("site_settings").delete().eq("setting_key", settingKey);
      invalidateDbCache();
      return NextResponse.json({
        success: true,
        reset: true,
        message: `Reset custom JSON for ${cleanPackage} to default auto-generated format.`,
      });
    }

    let payload = body.payload;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (jsonErr: any) {
        return NextResponse.json(
          { error: `Invalid JSON syntax: ${jsonErr.message}` },
          { status: 400 }
        );
      }
    }

    if (!payload || (typeof payload !== "object")) {
      return NextResponse.json({ error: "Payload must be a valid JSON object or array" }, { status: 400 });
    }

    // Save custom payload into site_settings
    const { error: saveErr } = await supabase.from("site_settings").upsert(
      {
        setting_key: settingKey,
        setting_value: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "setting_key" }
    );

    if (saveErr) {
      return NextResponse.json({ error: saveErr.message }, { status: 500 });
    }

    // If payload contains version_code or update_url, synchronize back to database
    const primaryObj = Array.isArray(payload) ? payload[0] : payload;
    if (primaryObj && typeof primaryObj === "object") {
      const app = await getApplicationByPackage(cleanPackage);
      if (app && app.id) {
        const activeVer = app.latest_version || app.versions?.find((v: any) => v.is_latest) || app.versions?.[0];
        if (activeVer) {
          const verUpdates: any = {};
          if (typeof primaryObj.version_code === "number") {
            verUpdates.version_code = primaryObj.version_code;
          }
          if (typeof primaryObj.description === "string") {
            verUpdates.release_notes = primaryObj.description;
          }
          if (Object.keys(verUpdates).length > 0) {
            await supabase.from("application_versions").update(verUpdates).eq("id", activeVer.id);
          }

          if (primaryObj.update_url && typeof primaryObj.update_url === "string") {
            const { data: existingSrc } = await supabase
              .from("download_sources")
              .select("id")
              .eq("version_id", activeVer.id)
              .maybeSingle();

            if (existingSrc) {
              await supabase
                .from("download_sources")
                .update({ download_url: primaryObj.update_url, is_active: true })
                .eq("id", existingSrc.id);
            }
          }
        }
      }
    }

    invalidateDbCache();
    return NextResponse.json({
      success: true,
      message: `Custom update JSON for ${cleanPackage} saved successfully!`,
      payload,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save JSON" }, { status: 500 });
  }
}
